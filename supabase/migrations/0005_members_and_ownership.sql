-- Members and ownership.
--
-- The tree's creator (trees.created_by) is its owner. The owner is the only
-- person who can delete the tree, and can't be removed or demoted by anyone.
-- That rules out an admin demoting the owner and then wiping the archive, and
-- guarantees every tree always keeps at least one admin.

-- 1. Who has access. Emails and names live in auth.users, which the client
--    can't read, hence a security definer function — admins only.
create or replace function list_members (p_tree uuid)
returns table (
  user_id    uuid,
  email      text,
  name       text,
  avatar_url text,
  role       member_role,
  joined_at  timestamptz,
  is_owner   boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin (p_tree) then
    raise exception 'Only admins can see who has access to this tree';
  end if;
  return query
    select
      m.user_id,
      u.email::text,
      coalesce (u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email)::text,
      (u.raw_user_meta_data->>'avatar_url')::text,
      m.role,
      m.joined_at,
      t.created_by = m.user_id
    from memberships m
    join auth.users u on u.id = m.user_id
    join trees t on t.id = m.tree_id
    where m.tree_id = p_tree
    order by (t.created_by = m.user_id) desc, m.joined_at;
end;
$$;

revoke all on function list_members (uuid) from public;
grant execute on function list_members (uuid) to authenticated;

-- 2. The owner's membership can't be removed or downgraded. A trigger rather
--    than a policy so it holds for every path: direct writes, RPCs, anything.
create or replace function protect_tree_owner ()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select created_by into owner from trees where id = old.tree_id;
  -- No tree row means the tree itself is being deleted and this is the
  -- cascade clearing its memberships: let it through.
  if owner is null then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;

  if old.user_id = owner then
    if TG_OP = 'DELETE' then
      raise exception 'The tree''s owner can''t be removed';
    end if;
    if new.role <> 'admin' or new.user_id <> old.user_id or new.tree_id <> old.tree_id then
      raise exception 'The tree''s owner must stay an admin';
    end if;
  end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists memberships_protect_owner on memberships;
create trigger memberships_protect_owner before update or delete on memberships
  for each row execute function protect_tree_owner ();

-- 3. Only the owner can delete a tree (previously: any admin).
drop policy if exists trees_delete on trees;
create policy trees_delete on trees for delete using (created_by = auth.uid ());

-- 4. Deleting a whole tree cascades to every person in it, and the existing
--    "can't delete someone with children" rule would stop that cascade at the
--    first parent — so no real tree could ever be deleted. Same rule, with an
--    exception for when the tree itself is going.
create or replace function block_delete_with_children ()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- The tree row is already gone: this is the tree-deletion cascade.
  if not exists (select 1 from trees where id = old.tree_id) then
    return old;
  end if;

  if exists (
    select 1
    from unions u
    join union_children uc on uc.union_id = u.id
    where u.partner_a = old.id or u.partner_b = old.id
  ) then
    raise exception 'Cannot delete a person who has children in the tree';
  end if;
  return old;
end;
$$;

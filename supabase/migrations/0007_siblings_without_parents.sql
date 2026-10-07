-- Brothers and sisters can be recorded before (or without) their parents.
--
-- Siblings are the children of one union. Until now a union had to have at
-- least one partner, so siblings of someone with no recorded parents (the
-- tree's founder, or anyone who married in) couldn't be added at all. A union
-- with no partners now stands for "parents not recorded"; adding a father or
-- mother later fills one of its empty slots.

alter table unions drop constraint if exists unions_need_a_partner;

-- Removing the last partner used to delete the union outright, taking its
-- children's sibling links with it. Now only an empty one goes.
create or replace function prune_empty_unions ()
returns trigger language plpgsql as $$
begin
  delete from unions u
  where u.id = old.id
    and not exists (select 1 from union_children c where c.union_id = u.id);
  return null;
end;
$$;

-- And a parentless union whose last child is removed has nothing left to say.
create or replace function prune_childless_sibling_union ()
returns trigger language plpgsql as $$
begin
  delete from unions u
  where u.id = old.union_id
    and u.partner_a is null and u.partner_b is null
    and not exists (select 1 from union_children c where c.union_id = u.id);
  return null;
end;
$$;

drop trigger if exists union_children_prune on union_children;
create trigger union_children_prune after delete on union_children
  for each row execute function prune_childless_sibling_union ();

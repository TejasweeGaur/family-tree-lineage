-- Family Tree & Heritage Archive — initial schema
--
-- Access model: every table is gated on membership in the owning tree.
-- `viewer` reads; `admin` writes. Role always comes from `memberships`,
-- never from anything the client sends.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type gender    as enum ('Male', 'Female', 'Other');
create type member_role as enum ('admin', 'viewer');
create type media_kind as enum ('Photo', 'Video Clip');

-- ---------------------------------------------------------------- core

create table trees (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  origin_notes   text not null default '',
  root_person_id uuid,
  created_by     uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now()
);

create table memberships (
  tree_id   uuid not null references trees (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      member_role not null default 'viewer',
  joined_at timestamptz not null default now(),
  primary key (tree_id, user_id)
);

create table persons (
  id                  uuid primary key default gen_random_uuid(),
  tree_id             uuid not null references trees (id) on delete cascade,
  first               text not null,
  last                text not null default '',
  maiden              text not null default '',
  gender              gender not null default 'Other',
  -- Dates are text: genealogy sources are often year-only ('1912' or '1912-04-15').
  dob                 text not null default '',
  pob                 text not null default '',
  dod                 text not null default '',
  pod                 text not null default '',
  occupation          text not null default '',
  residency           text not null default '',
  gotra               text not null default '',
  shasan              text not null default '',
  label               text not null default '',
  bio                 text not null default '',
  photo_url           text,
  origin_father       text not null default '',
  origin_father_dates text not null default '',
  origin_mother       text not null default '',
  origin_mother_dates text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index persons_tree_idx on persons (tree_id);

alter table trees
  add constraint trees_root_fk
  foreign key (root_person_id) references persons (id) on delete set null;

-- A union is one marriage/parental unit. Either partner may be null
-- (single-parent records), but not both.
create table unions (
  id         uuid primary key default gen_random_uuid(),
  tree_id    uuid not null references trees (id) on delete cascade,
  partner_a  uuid references persons (id) on delete set null,
  partner_b  uuid references persons (id) on delete set null,
  date       text not null default '',
  place      text not null default '',
  created_at timestamptz not null default now(),
  constraint unions_need_a_partner check (partner_a is not null or partner_b is not null),
  constraint unions_distinct_partners check (partner_a is null or partner_b is null or partner_a <> partner_b)
);

create index unions_tree_idx on unions (tree_id);
create index unions_a_idx on unions (partner_a);
create index unions_b_idx on unions (partner_b);

-- Child membership in a union. The primary key enforces the integrity rule
-- that a person has at most one parent union.
create table union_children (
  union_id uuid not null references unions (id) on delete cascade,
  child_id uuid not null references persons (id) on delete cascade,
  primary key (child_id),
  unique (union_id, child_id)
);

create index union_children_union_idx on union_children (union_id);

create table archive_records (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references persons (id) on delete cascade,
  title      text not null,
  year       text not null default '',
  category   text not null default '',
  descr      text not null default '',
  origin     text not null default '',
  file_url   text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index archive_person_idx on archive_records (person_id);

create table media_items (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references persons (id) on delete cascade,
  title      text not null,
  kind       media_kind not null default 'Photo',
  size_bytes bigint not null default 0,
  url        text,
  thumb_url  text,
  created_at timestamptz not null default now()
);

create index media_person_idx on media_items (person_id);

-- Invite tokens are server-issued. Sign-in reads the role from THIS row,
-- never from the ?role= query parameter on the invite link.
create table invites (
  token      text primary key,
  tree_id    uuid not null references trees (id) on delete cascade,
  role       member_role not null default 'viewer',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create index invites_tree_idx on invites (tree_id);

-- ---------------------------------------------------------------- helpers

-- security definer so the policies below can consult memberships without
-- recursing through memberships' own RLS.
create or replace function is_member (t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.tree_id = t and m.user_id = auth.uid()
  );
$$;

create or replace function is_admin (t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.tree_id = t and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

create or replace function tree_of_person (p uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select tree_id from persons where id = p;
$$;

create or replace function touch_updated_at ()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger persons_touch before update on persons
  for each row execute function touch_updated_at ();

-- ---------------------------------------------------------------- RLS

alter table trees           enable row level security;
alter table memberships     enable row level security;
alter table persons         enable row level security;
alter table unions          enable row level security;
alter table union_children  enable row level security;
alter table archive_records enable row level security;
alter table media_items     enable row level security;
alter table invites         enable row level security;

create policy trees_read   on trees for select using (is_member (id));
create policy trees_insert on trees for insert with check (created_by = auth.uid ());
create policy trees_write  on trees for update using (is_admin (id)) with check (is_admin (id));
create policy trees_delete on trees for delete using (is_admin (id));

create policy memberships_read on memberships for select using (is_member (tree_id));
-- Only admins add members directly. A user CANNOT insert their own row: that
-- would let anyone self-grant `admin` on any tree_id they can guess. Joining is
-- possible only through redeem_invite(), which derives the role from the invite.
create policy memberships_admin_add on memberships for insert with check (is_admin (tree_id));
create policy memberships_admin on memberships for update using (is_admin (tree_id)) with check (is_admin (tree_id));
create policy memberships_leave on memberships for delete using (user_id = auth.uid () or is_admin (tree_id));

create policy persons_read  on persons for select using (is_member (tree_id));
create policy persons_write on persons for all    using (is_admin (tree_id)) with check (is_admin (tree_id));

create policy unions_read  on unions for select using (is_member (tree_id));
create policy unions_write on unions for all    using (is_admin (tree_id)) with check (is_admin (tree_id));

create policy union_children_read on union_children for select
  using (is_member (tree_of_person (child_id)));
create policy union_children_write on union_children for all
  using (is_admin (tree_of_person (child_id)))
  with check (is_admin (tree_of_person (child_id)));

create policy archives_read on archive_records for select
  using (is_member (tree_of_person (person_id)));
create policy archives_write on archive_records for all
  using (is_admin (tree_of_person (person_id)))
  with check (is_admin (tree_of_person (person_id)));

create policy media_read on media_items for select
  using (is_member (tree_of_person (person_id)));
create policy media_write on media_items for all
  using (is_admin (tree_of_person (person_id)))
  with check (is_admin (tree_of_person (person_id)));

-- Admins only, deliberately. A viewer who could list invite rows would see any
-- outstanding `admin` token and could redeem it to promote themselves.
-- Invitees never select from this table; redeem_invite() reads it for them.
create policy invites_read  on invites for select using (is_admin (tree_id));
create policy invites_write on invites for all    using (is_admin (tree_id)) with check (is_admin (tree_id));

-- ---------------------------------------------------------------- integrity

-- Mirrors the app-level rule: a person with children cannot be deleted.
create or replace function block_delete_with_children ()
returns trigger language plpgsql as $$
begin
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

create trigger persons_block_delete before delete on persons
  for each row execute function block_delete_with_children ();

-- Drop unions once both partners are gone. The `when` clause keeps this off the
-- hot path for ordinary edits; the delete fires no update trigger, so the
-- self-referencing delete cannot recurse.
create or replace function prune_empty_unions ()
returns trigger language plpgsql as $$
begin
  delete from unions where id = old.id;
  return null;
end;
$$;

create trigger unions_prune after update on unions
  for each row when (new.partner_a is null and new.partner_b is null)
  execute function prune_empty_unions ();

-- ---------------------------------------------------------------- rpc

-- Bootstrapping a tree needs both the row and the creator's admin membership,
-- and neither insert can satisfy the other's RLS on its own: trees_read wants a
-- membership that does not exist yet, and memberships_admin_add wants an admin
-- that does not exist yet. Doing both here, security definer, breaks the cycle.
create or replace function create_tree (tree_name text, notes text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare t_id uuid;
begin
  if auth.uid () is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(trim(tree_name), '') = '' then
    raise exception 'Tree name is required';
  end if;

  insert into trees (name, origin_notes, created_by)
  values (trim(tree_name), coalesce(notes, ''), auth.uid ())
  returning id into t_id;

  insert into memberships (tree_id, user_id, role)
  values (t_id, auth.uid (), 'admin');

  return t_id;
end;
$$;

-- The ONLY path by which a user joins a tree they do not already belong to.
-- The role comes from the stored invite row, never from the caller, so the
-- ?role= parameter on an invite link is cosmetic and cannot be tampered with.
create or replace function redeem_invite (invite_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv invites%rowtype;
begin
  if auth.uid () is null then
    raise exception 'Not authenticated';
  end if;

  select * into inv from invites where token = invite_token;

  if not found then
    raise exception 'This invite link is not valid';
  end if;
  if inv.revoked_at is not null then
    raise exception 'This invite link has been revoked';
  end if;
  if inv.expires_at is not null and inv.expires_at < now () then
    raise exception 'This invite link has expired';
  end if;

  -- Redeeming may promote a viewer to admin, but never demotes an existing
  -- admin who happens to open a viewer link.
  insert into memberships (tree_id, user_id, role)
  values (inv.tree_id, auth.uid (), inv.role)
  on conflict (tree_id, user_id) do update
    set role = case when excluded.role = 'admin' then 'admin' else memberships.role end;

  return inv.tree_id;
end;
$$;

revoke all on function create_tree (text, text) from public;
revoke all on function redeem_invite (text) from public;
grant execute on function create_tree (text, text) to authenticated;
grant execute on function redeem_invite (text) to authenticated;

-- ---------------------------------------------------------------- storage

-- Both buckets are private: this archive holds photographs and documents of
-- living people. Reads go through short-lived signed URLs, not public links.
-- Object paths are `<tree_id>/<rest...>`, which is what the policies key on.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos',   'photos',   false, 5242880,  array['image/jpeg','image/png','image/webp']),
  ('archives', 'archives', false, 15728640, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Compared as text so a non-uuid first path segment fails the check instead of
-- raising a cast error.
create or replace function storage_tree_member (object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid ()
      and m.tree_id::text = (storage.foldername (object_name))[1]
  );
$$;

create or replace function storage_tree_admin (object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid ()
      and m.role = 'admin'
      and m.tree_id::text = (storage.foldername (object_name))[1]
  );
$$;

create policy storage_read on storage.objects for select
  using (bucket_id in ('photos', 'archives') and storage_tree_member (name));

create policy storage_insert on storage.objects for insert
  with check (bucket_id in ('photos', 'archives') and storage_tree_admin (name));

create policy storage_update on storage.objects for update
  using (bucket_id in ('photos', 'archives') and storage_tree_admin (name))
  with check (bucket_id in ('photos', 'archives') and storage_tree_admin (name));

create policy storage_delete on storage.objects for delete
  using (bucket_id in ('photos', 'archives') and storage_tree_admin (name));

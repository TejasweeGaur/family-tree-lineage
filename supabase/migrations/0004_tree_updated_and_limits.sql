-- 1. When was this tree last changed?
--
-- Shown in the app footer. Maintained by triggers rather than by the client so
-- it is accurate whoever makes the change, and it also moves on deletions,
-- which a client-side max(updated_at) over rows could never see.

alter table trees add column if not exists updated_at timestamptz not null default now ();

-- Backfill from what the tree already contains.
update trees t set updated_at = greatest (
  t.created_at,
  coalesce ((select max (p.updated_at) from persons p where p.tree_id = t.id), t.created_at),
  coalesce ((select max (u.created_at) from unions u where u.tree_id = t.id), t.created_at)
);

-- security definer: it only bumps a timestamp, and must work whichever path
-- caused the change (direct writes, cascades, the import function).
create or replace function touch_tree ()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec record;
  t   uuid;
begin
  if TG_OP = 'DELETE' then rec := OLD; else rec := NEW; end if;

  if TG_TABLE_NAME in ('persons', 'unions') then
    t := rec.tree_id;
  elsif TG_TABLE_NAME in ('archive_records', 'media_items') then
    select tree_id into t from persons where id = rec.person_id;
  elsif TG_TABLE_NAME = 'union_children' then
    select tree_id into t from unions where id = rec.union_id;
  end if;

  -- During a cascade the parent row may already be gone; its own trigger has
  -- touched the tree in that case.
  if t is not null then
    update trees set updated_at = now () where id = t;
  end if;
  return null;
end;
$$;

drop trigger if exists persons_touch_tree on persons;
drop trigger if exists unions_touch_tree on unions;
drop trigger if exists union_children_touch_tree on union_children;
drop trigger if exists archives_touch_tree on archive_records;
drop trigger if exists media_touch_tree on media_items;

create trigger persons_touch_tree after insert or update or delete on persons
  for each row execute function touch_tree ();
create trigger unions_touch_tree after insert or update or delete on unions
  for each row execute function touch_tree ();
create trigger union_children_touch_tree after insert or update or delete on union_children
  for each row execute function touch_tree ();
create trigger archives_touch_tree after insert or update or delete on archive_records
  for each row execute function touch_tree ();
create trigger media_touch_tree after insert or update or delete on media_items
  for each row execute function touch_tree ();

-- 2. Hard limit on archive uploads.
--
-- The app compresses images and rejects oversized PDFs before uploading, but
-- client checks can be bypassed. This is the limit storage itself enforces.
update storage.buckets set file_size_limit = 10485760 where id = 'archives'; -- 10 MB

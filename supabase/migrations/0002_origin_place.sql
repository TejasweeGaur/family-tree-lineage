-- Replace the free-text origin note with a structured ancestral place.
--
-- `origin_notes` asked for something no living relative reliably knows, and
-- nothing in the app ever rendered it. Place and country are answerable, and
-- country matters because families outside India use this too.

alter table trees add column origin_place   text not null default '';
alter table trees add column origin_country text not null default '';
alter table trees drop column origin_notes;

-- The old two-arg signature has to go explicitly: Postgres would otherwise keep
-- it alongside the new one as an overload and the client could resolve either.
drop function if exists create_tree (text, text);

create or replace function create_tree (
  tree_name text,
  place     text default '',
  country   text default ''
)
returns uuid language plpgsql security definer set search_path = public as $$
declare t_id uuid;
begin
  if auth.uid () is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(trim(tree_name), '') = '' then
    raise exception 'Family name is required';
  end if;

  insert into trees (name, origin_place, origin_country, created_by)
  values (trim(tree_name), coalesce(trim(place), ''), coalesce(trim(country), ''), auth.uid ())
  returning id into t_id;

  insert into memberships (tree_id, user_id, role)
  values (t_id, auth.uid (), 'admin');

  return t_id;
end;
$$;

revoke all on function create_tree (text, text, text) from public;
grant execute on function create_tree (text, text, text) to authenticated;

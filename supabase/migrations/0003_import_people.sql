-- Atomic CSV import.
--
-- The client validates the file and sends the whole plan in one call. Doing
-- the inserts here means one transaction: a failure part-way (a dropped
-- connection, a bad value) rolls back everything instead of leaving half a
-- family in the tree.
--
-- security invoker, deliberately: RLS still applies to every insert, so this
-- grants nothing an admin couldn't already do one row at a time.

create or replace function import_people (
  p_tree   uuid,
  p_people jsonb,
  p_unions jsonb,
  p_root   text
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  ids      jsonb := '{}'::jsonb;
  p        jsonb;
  u        jsonb;
  child    text;
  new_id   uuid;
  union_id uuid;
begin
  if not is_admin (p_tree) then
    raise exception 'Only admins of this tree can import';
  end if;
  -- Importing into a populated tree would duplicate people on a re-import and
  -- leave the new family disconnected from the existing one.
  if exists (select 1 from persons where tree_id = p_tree) then
    raise exception 'Import only works on an empty tree. Create a new tree first.';
  end if;

  for p in select * from jsonb_array_elements (p_people) loop
    insert into persons (
      tree_id, first, last, maiden, gender, dob, pob, dod, pod,
      occupation, residency, gotra, shasan, label, bio
    ) values (
      p_tree, p->>'first', coalesce (p->>'last', ''), coalesce (p->>'maiden', ''),
      coalesce (p->>'gender', 'Other')::gender,
      coalesce (p->>'dob', ''), coalesce (p->>'pob', ''),
      coalesce (p->>'dod', ''), coalesce (p->>'pod', ''),
      coalesce (p->>'occupation', ''), coalesce (p->>'residency', ''),
      coalesce (p->>'gotra', ''), coalesce (p->>'shasan', ''),
      coalesce (p->>'label', ''), coalesce (p->>'bio', '')
    )
    returning id into new_id;
    ids := ids || jsonb_build_object (p->>'ref', new_id);
  end loop;

  for u in select * from jsonb_array_elements (p_unions) loop
    insert into unions (tree_id, partner_a, partner_b, date, place)
    values (
      p_tree,
      (ids->>(u->>'a'))::uuid,
      (ids->>(u->>'b'))::uuid,
      coalesce (u->>'date', ''),
      coalesce (u->>'place', '')
    )
    returning id into union_id;

    for child in select jsonb_array_elements_text (u->'children') loop
      insert into union_children (union_id, child_id)
      values (union_id, (ids->>child)::uuid);
    end loop;
  end loop;

  update trees set root_person_id = (ids->>p_root)::uuid where id = p_tree;

  return ids;
end;
$$;

revoke all on function import_people (uuid, jsonb, jsonb, text) from public;
grant execute on function import_people (uuid, jsonb, jsonb, text) to authenticated;

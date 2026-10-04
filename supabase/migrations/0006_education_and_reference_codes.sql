-- Education history on each person, and a shared reference list of codes
-- (education levels, gotras, shasans) that the app's super admins curate.
--
-- Run this BEFORE deploying the app version that uses it: the app saves the
-- new persons.education column, and saves fail until the column exists.

-- ---------------------------------------------------------------- education

-- A short list per person, edited and saved together with the profile, so a
-- JSON array on the row is simpler than a table of its own. Each entry is
-- {"level": "...", "branch": "...", "institution": "...", "year": "..."}.
alter table persons
  add column if not exists education jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------- super admins

-- The people who run the app itself (not any one tree). Managed by hand in the
-- SQL editor; nothing in the app can add a row here.
create table if not exists super_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table super_admins enable row level security;
-- No policies: the table is read only through is_super_admin() below.

create or replace function is_super_admin ()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from super_admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- reference codes

create table if not exists ref_codes (
  code_category  text not null check (code_category in ('EDUCATION_LEVEL', 'GOTRA', 'SHASAN')),
  code           text not null check (length(trim(code)) > 0),
  description    text not null default '',
  aud_created_ts timestamptz not null default now(),
  primary key (code_category, code)
);

alter table ref_codes enable row level security;

-- Every signed-in user reads the shared lists; only super admins change them.
create policy ref_codes_read on ref_codes for select
  to authenticated using (true);
create policy ref_codes_write on ref_codes for all
  to authenticated using (is_super_admin ()) with check (is_super_admin ());

-- Starting education levels, in the order they appear in the dropdown.
insert into ref_codes (code_category, code, description, aud_created_ts) values
  ('EDUCATION_LEVEL', 'Class X',       'Secondary school (10th standard)',          now() + interval '1 second'),
  ('EDUCATION_LEVEL', 'Class XII',     'Senior secondary school (12th standard)',   now() + interval '2 seconds'),
  ('EDUCATION_LEVEL', 'Diploma',       'Polytechnic or vocational diploma',         now() + interval '3 seconds'),
  ('EDUCATION_LEVEL', 'Undergraduate', 'Studying for a bachelor''s degree',          now() + interval '4 seconds'),
  ('EDUCATION_LEVEL', 'Graduate',      'Bachelor''s degree, e.g. B.A., B.Sc., B.Tech', now() + interval '5 seconds'),
  ('EDUCATION_LEVEL', 'Postgraduate',  'Master''s degree, e.g. M.A., M.Sc., MBA',    now() + interval '6 seconds'),
  ('EDUCATION_LEVEL', 'Doctorate',     'Ph.D. or equivalent',                         now() + interval '7 seconds'),
  ('EDUCATION_LEVEL', 'Other',         '',                                            now() + interval '8 seconds')
on conflict do nothing;

-- ---------------------------------------------------------------- the first super admin

-- The app's creator. Their email is already public on the About page.
insert into super_admins (user_id)
select id from auth.users where email = 'tejasweegaur111@gmail.com'
on conflict do nothing;

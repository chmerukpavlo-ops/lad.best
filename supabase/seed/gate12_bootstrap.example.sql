-- EXAMPLE ONLY — review and edit before running in Supabase SQL Editor.
-- Not applied by the app. Do not put emails/passwords/secrets in git.
-- Prerequisites:
--   1) Foundation migration applied.
--   2) Two Auth users created in Dashboard (no public signup).
--   3) profiles rows exist (auth.users trigger) for both user UUIDs.
--
-- Replace the two profile UUIDs below with real auth.users.id values from Dashboard.

begin;

insert into public.workspaces (name)
values ('Лад');

with ws as (
  select id from public.workspaces limit 1
)
insert into public.memberships (workspace_id, profile_id)
select ws.id, v.profile_id
from ws
cross join (
  values
    ('6e40da94-eba7-4e99-8d77-908dffa54f79'::uuid),
    ('86b79b5b-e5ac-4343-ae7b-f2306b77925f'::uuid)
) as v(profile_id);

select private.write_system_audit_event(
  (select id from public.workspaces limit 1),
  'workspace.bootstrapped',
  'workspaces',
  (select id from public.workspaces limit 1),
  null,
  jsonb_build_object('member_count', 2)
);

commit;

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

-- Capture the singleton workspace id
-- (only one row allowed by migration constraints)

with ws as (
  select id from public.workspaces limit 1
)
insert into public.memberships (workspace_id, profile_id)
select ws.id, v.profile_id
from ws
cross join (
  values
    ('00000000-0000-0000-0000-000000000001'::uuid),
    ('00000000-0000-0000-0000-000000000002'::uuid)
) as v(profile_id);

select private.write_audit_event(
  (select id from public.workspaces limit 1),
  'system',
  null,
  'workspace.bootstrapped',
  'workspaces',
  (select id from public.workspaces limit 1),
  null,
  jsonb_build_object('member_count', 2)
);

commit;

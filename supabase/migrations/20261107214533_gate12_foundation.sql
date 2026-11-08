-- Gate 1.2 foundation for Лад
-- Review only — do not apply until explicitly permitted.
-- Scope: profiles, workspaces, memberships, audit_events + RLS/grants.
-- No listings / ads / sales / calendar / profit shares.

begin;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to postgres;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one workspace row for MVP (blocks concurrent second insert).
create unique index workspaces_singleton_uidx on public.workspaces ((true));

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, profile_id)
);

create index memberships_profile_id_idx on public.memberships (profile_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete restrict,
  actor_kind text not null check (actor_kind in ('user', 'system')),
  -- Historical actor UUID (auth.users / profiles id). No FK: deleting an
  -- account must not null out past user events (would break actor_origin_chk).
  actor_id uuid,
  action text not null check (char_length(trim(action)) > 0),
  entity_type text not null check (char_length(trim(entity_type)) > 0),
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_actor_origin_chk check (
    (actor_kind = 'user' and actor_id is not null)
    or (actor_kind = 'system' and actor_id is null)
  )
);

create index audit_events_workspace_created_idx
  on public.audit_events (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER, fixed search_path; not for Data API exposure)
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.workspace_id = p_workspace_id
      and m.profile_id = auth.uid()
  );
$$;

create or replace function private.enforce_membership_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_count integer;
begin
  -- Serialize concurrent inserts for the same workspace.
  perform pg_advisory_xact_lock(842151, hashtext(new.workspace_id::text));

  select count(*)::integer
    into member_count
  from public.memberships
  where workspace_id = new.workspace_id;

  if member_count >= 2 then
    raise exception 'workspace already has the maximum of 2 members'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_single_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
begin
  perform pg_advisory_xact_lock(842150, hashtext('lad:workspaces:singleton'));

  select count(*)::integer into existing_count from public.workspaces;
  if existing_count >= 1 then
    raise exception 'only one workspace is allowed'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Keep profiles.id immutable. Never rewrite id from auth.uid() on INSERT
-- (admin/bootstrap and auth.users trigger supply auth.users.id explicitly).
-- Authenticated users may UPDATE only via RLS (own row); this trigger locks id/created_at.
create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- User audit: actor always from auth.uid(); callers cannot forge actor_id.
create or replace function private.write_user_audit_event(
  p_workspace_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb default null,
  p_after jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'user audit requires authenticated auth.uid()';
  end if;

  insert into public.audit_events (
    workspace_id,
    actor_kind,
    actor_id,
    action,
    entity_type,
    entity_id,
    before,
    after
  ) values (
    p_workspace_id,
    'user',
    actor,
    p_action,
    p_entity_type,
    p_entity_id,
    p_before,
    p_after
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- System/bootstrap audit: trusted definer path only (no authenticated EXECUTE).
create or replace function private.write_system_audit_event(
  p_workspace_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb default null,
  p_after jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.audit_events (
    workspace_id,
    actor_kind,
    actor_id,
    action,
    entity_type,
    entity_id,
    before,
    after
  ) values (
    p_workspace_id,
    'system',
    null,
    p_action,
    p_entity_type,
    p_entity_id,
    p_before,
    p_after
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- Create profile when Auth user is created (Dashboard admin or invite).
-- Uses NEW.id from auth.users — never auth.uid().
create or replace function private.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_name text;
begin
  chosen_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if chosen_name is null then
    chosen_name := split_part(coalesce(new.email, new.id::text), '@', 1);
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, chosen_name)
  on conflict (id) do nothing;

  perform private.write_system_audit_event(
    null,
    'profile.created',
    'profiles',
    new.id,
    null,
    jsonb_build_object('id', new.id, 'display_name', chosen_name)
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function private.set_updated_at();

create trigger workspaces_enforce_singleton
before insert on public.workspaces
for each row execute function private.enforce_single_workspace();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger profiles_protect_columns
before update on public.profiles
for each row execute function private.protect_profile_columns();

create trigger memberships_enforce_limit
before insert on public.memberships
for each row execute function private.enforce_membership_limit();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_auth_user_created();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_events enable row level security;

alter table public.workspaces force row level security;
alter table public.profiles force row level security;
alter table public.memberships force row level security;
alter table public.audit_events force row level security;

-- workspaces: members can read; no insert/update/delete for authenticated
create policy workspaces_select_member
  on public.workspaces
  for select
  to authenticated
  using (private.is_workspace_member(id));

-- profiles: members of the same workspace can read each other; self update display_name
create policy profiles_select_same_workspace
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.memberships my
      join public.memberships their
        on their.workspace_id = my.workspace_id
      where my.profile_id = auth.uid()
        and their.profile_id = profiles.id
    )
  );

create policy profiles_update_own_display_name
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- memberships: read if member of that workspace; no insert/update/delete for users
create policy memberships_select_member
  on public.memberships
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

-- audit: members may read workspace events; system-wide (null workspace) hidden from users
create policy audit_events_select_member
  on public.audit_events
  for select
  to authenticated
  using (
    workspace_id is not null
    and private.is_workspace_member(workspace_id)
  );

-- No INSERT/UPDATE/DELETE policies on audit_events or memberships for authenticated.
-- Bootstrap uses SQL as postgres/supabase_admin in Dashboard (separate reviewed script).

-- ---------------------------------------------------------------------------
-- Grants (explicit; do not rely on default Data API openness)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema public to authenticated;

grant select on table public.workspaces to authenticated;
grant select, update on table public.profiles to authenticated;
grant select on table public.memberships to authenticated;
grant select on table public.audit_events to authenticated;

-- Helper used inside policies must be executable by the role evaluating RLS.
grant execute on function private.is_workspace_member(uuid) to authenticated;

-- Authenticated must not call audit writers or bootstrap helpers directly.
revoke execute on function private.write_user_audit_event(uuid, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function private.write_system_audit_event(uuid, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function private.enforce_membership_limit() from public, anon, authenticated;
revoke execute on function private.enforce_single_workspace() from public, anon, authenticated;
revoke execute on function private.handle_auth_user_created() from public, anon, authenticated;
revoke execute on function private.protect_profile_columns() from public, anon, authenticated;
revoke execute on function private.set_updated_at() from public, anon, authenticated;

commit;

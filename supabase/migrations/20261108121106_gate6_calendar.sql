-- Gate 6: one-off busy/free availability (no recurrence / notifications)
-- Review only — do not apply until explicitly permitted.

begin;

-- Workspace day bounds in Europe/Kyiv local minutes [start, end).
create table public.workspace_schedule_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete restrict,
  day_start_minute integer not null default 480
    constraint workspace_schedule_day_start_chk check (
      day_start_minute >= 0 and day_start_minute < 1440
    ),
  day_end_minute integer not null default 1320
    constraint workspace_schedule_day_end_chk check (
      day_end_minute > 0 and day_end_minute <= 1440
    ),
  constraint workspace_schedule_order_chk check (day_end_minute > day_start_minute),
  updated_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  version integer not null default 1
    constraint workspace_schedule_version_positive_chk check (version > 0)
);

revoke all on table public.workspace_schedule_settings from public, anon, authenticated;

create table public.availability_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  participant_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null
    constraint availability_events_kind_chk check (kind in ('busy', 'free')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text
    constraint availability_events_note_len_chk check (
      note is null or char_length(note) <= 2000
    ),
  version integer not null default 1
    constraint availability_events_version_positive_chk check (version > 0),
  deleted_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_events_range_chk check (ends_at > starts_at)
);

create index availability_events_workspace_starts_idx
  on public.availability_events (workspace_id, starts_at)
  where deleted_at is null;

create index availability_events_participant_starts_idx
  on public.availability_events (workspace_id, participant_id, starts_at)
  where deleted_at is null;

revoke all on table public.availability_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Protect / audit
-- ---------------------------------------------------------------------------

create or replace function private.protect_schedule_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'schedule changes require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.is_workspace_member(new.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' then
    new.workspace_id := old.workspace_id;
    new.version := old.version + 1;
  else
    new.version := 1;
  end if;
  new.updated_by := actor;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.audit_schedule_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_user_audit_event(
      new.workspace_id, 'schedule_settings.created', 'workspace_schedule_settings',
      new.workspace_id, null, to_jsonb(new)
    );
  else
    perform private.write_user_audit_event(
      new.workspace_id, 'schedule_settings.updated', 'workspace_schedule_settings',
      new.workspace_id, to_jsonb(old), to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

create trigger workspace_schedule_settings_protect
before insert or update on public.workspace_schedule_settings
for each row execute function private.protect_schedule_settings();

create trigger workspace_schedule_settings_audit
after insert or update on public.workspace_schedule_settings
for each row execute function private.audit_schedule_settings();

create or replace function private.protect_availability_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  member_ok boolean;
begin
  if actor is null then
    raise exception 'availability changes require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'INSERT' then
    if not private.is_workspace_member(new.workspace_id) then
      raise exception 'not a workspace member'
        using errcode = 'insufficient_privilege';
    end if;
    select exists (
      select 1 from public.memberships m
      where m.workspace_id = new.workspace_id and m.profile_id = new.participant_id
    ) into member_ok;
    if not coalesce(member_ok, false) then
      raise exception 'participant must be a workspace member'
        using errcode = 'check_violation';
    end if;
    new.created_by := actor;
    new.updated_by := actor;
    new.created_at := now();
    new.updated_at := now();
    new.version := 1;
    new.deleted_at := null;
    new.note := nullif(trim(coalesce(new.note, '')), '');
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := actor;
    new.updated_at := now();
    new.version := old.version + 1;
    new.note := nullif(trim(coalesce(new.note, '')), '');

    select exists (
      select 1 from public.memberships m
      where m.workspace_id = new.workspace_id and m.profile_id = new.participant_id
    ) into member_ok;
    if not coalesce(member_ok, false) then
      raise exception 'participant must be a workspace member'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  return new;
end;
$$;

create or replace function private.audit_availability_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text;
begin
  if tg_op = 'INSERT' then
    perform private.write_user_audit_event(
      new.workspace_id, 'availability.created', 'availability_events',
      new.id, null, to_jsonb(new)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      action_name := 'availability.deleted';
    else
      action_name := 'availability.updated';
    end if;
    perform private.write_user_audit_event(
      new.workspace_id, action_name, 'availability_events',
      new.id, to_jsonb(old), to_jsonb(new)
    );
    return new;
  end if;
  return null;
end;
$$;

create trigger availability_events_protect
before insert or update on public.availability_events
for each row execute function private.protect_availability_event();

create trigger availability_events_audit
after insert or update on public.availability_events
for each row execute function private.audit_availability_event();

create or replace function private.forbid_availability_hard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'availability_events cannot be hard-deleted; set deleted_at'
    using errcode = 'check_violation';
end;
$$;

create trigger availability_events_forbid_delete
before delete on public.availability_events
for each row execute function private.forbid_availability_hard_delete();

create or replace function private.forbid_schedule_settings_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'workspace_schedule_settings cannot be deleted'
    using errcode = 'check_violation';
end;
$$;

create trigger workspace_schedule_settings_forbid_delete
before delete on public.workspace_schedule_settings
for each row execute function private.forbid_schedule_settings_delete();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.workspace_schedule_settings enable row level security;
alter table public.workspace_schedule_settings force row level security;
alter table public.availability_events enable row level security;
alter table public.availability_events force row level security;

create policy schedule_settings_select_member
  on public.workspace_schedule_settings for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy schedule_settings_insert_member
  on public.workspace_schedule_settings for insert to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy schedule_settings_update_member
  on public.workspace_schedule_settings for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy availability_select_member
  on public.availability_events for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy availability_insert_member
  on public.availability_events for insert to authenticated
  with check (
    private.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.memberships m
      where m.workspace_id = workspace_id and m.profile_id = participant_id
    )
  );

create policy availability_update_member
  on public.availability_events for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (
    private.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.memberships m
      where m.workspace_id = workspace_id and m.profile_id = participant_id
    )
  );

grant select, insert, update on table public.workspace_schedule_settings to authenticated;
grant select, insert, update on table public.availability_events to authenticated;

revoke all on function private.protect_schedule_settings() from public, anon, authenticated;
revoke all on function private.audit_schedule_settings() from public, anon, authenticated;
revoke all on function private.protect_availability_event() from public, anon, authenticated;
revoke all on function private.audit_availability_event() from public, anon, authenticated;
revoke all on function private.forbid_availability_hard_delete() from public, anon, authenticated;
revoke all on function private.forbid_schedule_settings_delete() from public, anon, authenticated;

commit;

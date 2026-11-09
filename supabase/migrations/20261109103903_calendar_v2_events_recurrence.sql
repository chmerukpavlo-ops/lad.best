-- Calendar v2: typed events, recurrence rules, exceptions, weekly availability.
-- Local date + minute-of-day (Europe/Kyiv). Expand occurrences in app code.
-- Gate 6 tables (availability_events, workspace_schedule_settings) stay for now.
-- Applied on lad remote as calendar_v2_events_recurrence.

begin;

create type public.calendar_event_type as enum (
  'class',
  'work',
  'shared_work',
  'free',
  'personal'
);

-- ---------------------------------------------------------------------------
-- calendar_events
-- ---------------------------------------------------------------------------

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  participants uuid[] not null,
  event_type public.calendar_event_type not null,
  title text not null
    constraint calendar_events_title_len_chk check (
      char_length(trim(title)) >= 1 and char_length(title) <= 200
    ),
  note text
    constraint calendar_events_note_len_chk check (
      note is null or char_length(note) <= 2000
    ),
  tz text not null default 'Europe/Kyiv'
    constraint calendar_events_tz_chk check (tz = 'Europe/Kyiv'),
  start_date date not null,
  start_minute integer not null
    constraint calendar_events_start_minute_chk check (
      start_minute >= 0 and start_minute < 1440
    ),
  end_minute integer not null
    constraint calendar_events_end_minute_chk check (
      end_minute > 0 and end_minute <= 1440
    ),
  repeat_freq text not null default 'none'
    constraint calendar_events_repeat_freq_chk check (
      repeat_freq in ('none', 'weekly')
    ),
  repeat_interval smallint not null default 1
    constraint calendar_events_repeat_interval_chk check (
      repeat_interval between 1 and 4
    ),
  -- ISO weekdays 1=Mon .. 7=Sun; null → weekday of start_date
  repeat_weekdays smallint[]
    constraint calendar_events_repeat_weekdays_chk check (
      repeat_weekdays is null
      or (
        array_length(repeat_weekdays, 1) >= 1
        and repeat_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
      )
    ),
  repeat_until date,
  version integer not null default 1
    constraint calendar_events_version_positive_chk check (version > 0),
  deleted_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_range_chk check (end_minute > start_minute),
  constraint calendar_events_participants_len_chk check (
    array_length(participants, 1) >= 1
  ),
  constraint calendar_events_repeat_until_chk check (
    repeat_freq = 'none'
    or repeat_until is null
    or repeat_until >= start_date
  ),
  constraint calendar_events_owner_participant_chk check (
    event_type = 'shared_work'
    or participants = array[owner_id]::uuid[]
  )
);

create index calendar_events_ws_start_idx
  on public.calendar_events (workspace_id, start_date)
  where deleted_at is null;

create index calendar_events_ws_owner_idx
  on public.calendar_events (workspace_id, owner_id)
  where deleted_at is null;

revoke all on table public.calendar_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- calendar_event_exceptions
-- ---------------------------------------------------------------------------

create table public.calendar_event_exceptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  event_id uuid not null references public.calendar_events (id) on delete restrict,
  occurrence_date date not null,
  is_cancelled boolean not null default false,
  title text
    constraint calendar_exc_title_len_chk check (
      title is null
      or (char_length(trim(title)) >= 1 and char_length(title) <= 200)
    ),
  start_minute integer
    constraint calendar_exc_start_minute_chk check (
      start_minute is null
      or (start_minute >= 0 and start_minute < 1440)
    ),
  end_minute integer
    constraint calendar_exc_end_minute_chk check (
      end_minute is null
      or (end_minute > 0 and end_minute <= 1440)
    ),
  version integer not null default 1
    constraint calendar_exc_version_positive_chk check (version > 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, occurrence_date),
  constraint calendar_exc_range_chk check (
    start_minute is null
    or end_minute is null
    or end_minute > start_minute
  )
);

create index calendar_exc_ws_event_idx
  on public.calendar_event_exceptions (workspace_id, event_id);

revoke all on table public.calendar_event_exceptions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- availability_rules (weekly template per member)
-- ---------------------------------------------------------------------------

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  member_id uuid not null references public.profiles (id) on delete restrict,
  weekday smallint not null
    constraint availability_rules_weekday_chk check (weekday between 1 and 7),
  start_minute integer not null
    constraint availability_rules_start_chk check (
      start_minute >= 0 and start_minute < 1440
    ),
  end_minute integer not null
    constraint availability_rules_end_chk check (
      end_minute > 0 and end_minute <= 1440
    ),
  version integer not null default 1
    constraint availability_rules_version_positive_chk check (version > 0),
  deleted_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_rules_range_chk check (end_minute > start_minute)
);

create index availability_rules_member_weekday_idx
  on public.availability_rules (workspace_id, member_id, weekday)
  where deleted_at is null;

revoke all on table public.availability_rules from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Protect / audit helpers
-- ---------------------------------------------------------------------------

create or replace function private.calendar_participants_valid(
  p_workspace_id uuid,
  p_participants uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from unnest(p_participants) as p(pid)
    where not private.is_workspace_member_of(p.pid, p_workspace_id)
  );
$$;

create or replace function private.protect_calendar_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'calendar events require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.is_workspace_member(new.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.calendar_participants_valid(new.workspace_id, new.participants) then
    raise exception 'participants must belong to workspace'
      using errcode = 'check_violation';
  end if;
  if not (new.owner_id = any (new.participants)) then
    raise exception 'owner must be a participant'
      using errcode = 'check_violation';
  end if;

  new.title := trim(new.title);
  new.note := nullif(trim(coalesce(new.note, '')), '');
  new.tz := 'Europe/Kyiv';

  if tg_op = 'INSERT' then
    new.version := 1;
    new.deleted_at := null;
    new.created_by := actor;
    new.created_at := now();
  else
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.version := old.version + 1;
  end if;

  new.updated_by := actor;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.audit_calendar_event()
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
      new.workspace_id, 'calendar_event.created', 'calendar_events',
      new.id, null, to_jsonb(new)
    );
    return new;
  end if;
  if old.deleted_at is null and new.deleted_at is not null then
    action_name := 'calendar_event.deleted';
  else
    action_name := 'calendar_event.updated';
  end if;
  perform private.write_user_audit_event(
    new.workspace_id, action_name, 'calendar_events',
    new.id, to_jsonb(old), to_jsonb(new)
  );
  return new;
end;
$$;

create trigger calendar_events_protect
before insert or update on public.calendar_events
for each row execute function private.protect_calendar_event();

create trigger calendar_events_audit
after insert or update on public.calendar_events
for each row execute function private.audit_calendar_event();

create or replace function private.forbid_calendar_events_hard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'calendar_events cannot be hard-deleted; set deleted_at'
    using errcode = 'check_violation';
end;
$$;

create trigger calendar_events_forbid_delete
before delete on public.calendar_events
for each row execute function private.forbid_calendar_events_hard_delete();

create or replace function private.protect_calendar_exception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  event_ws uuid;
  event_deleted timestamptz;
begin
  if actor is null then
    raise exception 'calendar exceptions require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;

  select e.workspace_id, e.deleted_at
  into event_ws, event_deleted
  from public.calendar_events e
  where e.id = new.event_id;

  if event_ws is null then
    raise exception 'event not found' using errcode = 'foreign_key_violation';
  end if;
  if event_deleted is not null then
    raise exception 'cannot change exceptions of deleted event'
      using errcode = 'check_violation';
  end if;
  if event_ws is distinct from new.workspace_id then
    raise exception 'exception workspace mismatch'
      using errcode = 'check_violation';
  end if;
  if not private.is_workspace_member(new.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;

  if new.title is not null then
    new.title := trim(new.title);
  end if;

  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_by := actor;
    new.created_at := now();
  else
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.event_id := old.event_id;
    new.occurrence_date := old.occurrence_date;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.version := old.version + 1;
  end if;

  new.updated_by := actor;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.audit_calendar_exception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_user_audit_event(
      new.workspace_id, 'calendar_exception.created', 'calendar_event_exceptions',
      new.id, null, to_jsonb(new)
    );
  else
    perform private.write_user_audit_event(
      new.workspace_id, 'calendar_exception.updated', 'calendar_event_exceptions',
      new.id, to_jsonb(old), to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

create trigger calendar_event_exceptions_protect
before insert or update on public.calendar_event_exceptions
for each row execute function private.protect_calendar_exception();

create trigger calendar_event_exceptions_audit
after insert or update on public.calendar_event_exceptions
for each row execute function private.audit_calendar_exception();

-- Exceptions may be hard-deleted when cancelling a one-off override undo
-- is not needed; prefer is_cancelled. Still allow delete for "this only" undo.
-- Soft path preferred in app; hard delete granted below with RLS.

create or replace function private.protect_availability_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'availability rules require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.is_workspace_member(new.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.is_workspace_member_of(new.member_id, new.workspace_id) then
    raise exception 'member must belong to workspace'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    new.version := 1;
    new.deleted_at := null;
    new.created_by := actor;
    new.created_at := now();
  else
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.version := old.version + 1;
  end if;

  new.updated_by := actor;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.audit_availability_rule()
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
      new.workspace_id, 'availability_rule.created', 'availability_rules',
      new.id, null, to_jsonb(new)
    );
    return new;
  end if;
  if old.deleted_at is null and new.deleted_at is not null then
    action_name := 'availability_rule.deleted';
  else
    action_name := 'availability_rule.updated';
  end if;
  perform private.write_user_audit_event(
    new.workspace_id, action_name, 'availability_rules',
    new.id, to_jsonb(old), to_jsonb(new)
  );
  return new;
end;
$$;

create trigger availability_rules_protect
before insert or update on public.availability_rules
for each row execute function private.protect_availability_rule();

create trigger availability_rules_audit
after insert or update on public.availability_rules
for each row execute function private.audit_availability_rule();

create or replace function private.forbid_availability_rules_hard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'availability_rules cannot be hard-deleted; set deleted_at'
    using errcode = 'check_violation';
end;
$$;

create trigger availability_rules_forbid_delete
before delete on public.availability_rules
for each row execute function private.forbid_availability_rules_hard_delete();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.calendar_events enable row level security;
alter table public.calendar_events force row level security;
alter table public.calendar_event_exceptions enable row level security;
alter table public.calendar_event_exceptions force row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_rules force row level security;

create policy calendar_events_select_member
  on public.calendar_events for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy calendar_events_insert_member
  on public.calendar_events for insert to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy calendar_events_update_member
  on public.calendar_events for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy calendar_exc_select_member
  on public.calendar_event_exceptions for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy calendar_exc_insert_member
  on public.calendar_event_exceptions for insert to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy calendar_exc_update_member
  on public.calendar_event_exceptions for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy calendar_exc_delete_member
  on public.calendar_event_exceptions for delete to authenticated
  using (private.is_workspace_member(workspace_id));

create policy availability_rules_select_member
  on public.availability_rules for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy availability_rules_insert_member
  on public.availability_rules for insert to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy availability_rules_update_member
  on public.availability_rules for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

grant select, insert, update on table public.calendar_events to authenticated;
grant select, insert, update, delete on table public.calendar_event_exceptions to authenticated;
grant select, insert, update on table public.availability_rules to authenticated;

-- Realtime (optional clients subscribe later)
alter publication supabase_realtime add table
  public.calendar_events,
  public.calendar_event_exceptions,
  public.availability_rules;

revoke all on function private.calendar_participants_valid(uuid, uuid[]) from public, anon, authenticated;
revoke all on function private.protect_calendar_event() from public, anon, authenticated;
revoke all on function private.audit_calendar_event() from public, anon, authenticated;
revoke all on function private.forbid_calendar_events_hard_delete() from public, anon, authenticated;
revoke all on function private.protect_calendar_exception() from public, anon, authenticated;
revoke all on function private.audit_calendar_exception() from public, anon, authenticated;
revoke all on function private.protect_availability_rule() from public, anon, authenticated;
revoke all on function private.audit_availability_rule() from public, anon, authenticated;
revoke all on function private.forbid_availability_rules_hard_delete() from public, anon, authenticated;

commit;

-- Workspace finance split defaults + rating weights/events.
-- Applied on lad remote as workspace_finance_rating_settings (20261108235219).
-- Shares: optional display on sales (no payouts/debts).
-- Rating: weights apply only to new rating_events after save.

begin;

create or replace function private.is_workspace_member_of(
  p_profile_id uuid,
  p_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = p_workspace_id and m.profile_id = p_profile_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Finance defaults (workspace)
-- ---------------------------------------------------------------------------

create table public.workspace_finance_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete restrict,
  split_enabled boolean not null default false,
  member_a_id uuid not null references public.profiles (id) on delete restrict,
  member_b_id uuid not null references public.profiles (id) on delete restrict,
  percent_a integer not null default 40
    constraint finance_percent_a_chk check (percent_a >= 0 and percent_a <= 100),
  percent_b integer not null default 60
    constraint finance_percent_b_chk check (percent_b >= 0 and percent_b <= 100),
  constraint finance_percent_sum_chk check (percent_a + percent_b = 100),
  constraint finance_members_distinct_chk check (member_a_id <> member_b_id),
  updated_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  version integer not null default 1
    constraint finance_version_positive_chk check (version > 0)
);

revoke all on table public.workspace_finance_settings from public, anon, authenticated;

create or replace function private.protect_finance_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'finance settings require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.is_workspace_member(new.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.is_workspace_member_of(new.member_a_id, new.workspace_id)
     or not private.is_workspace_member_of(new.member_b_id, new.workspace_id) then
    raise exception 'share members must belong to workspace'
      using errcode = 'check_violation';
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

create or replace function private.audit_finance_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_user_audit_event(
      new.workspace_id, 'finance_settings.created', 'workspace_finance_settings',
      new.workspace_id, null, to_jsonb(new)
    );
  else
    perform private.write_user_audit_event(
      new.workspace_id, 'finance_settings.updated', 'workspace_finance_settings',
      new.workspace_id, to_jsonb(old), to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

create trigger workspace_finance_settings_protect
before insert or update on public.workspace_finance_settings
for each row execute function private.protect_finance_settings();

create trigger workspace_finance_settings_audit
after insert or update on public.workspace_finance_settings
for each row execute function private.audit_finance_settings();

create or replace function private.forbid_finance_settings_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'workspace_finance_settings cannot be deleted'
    using errcode = 'check_violation';
end;
$$;

create trigger workspace_finance_settings_forbid_delete
before delete on public.workspace_finance_settings
for each row execute function private.forbid_finance_settings_delete();

alter table public.workspace_finance_settings enable row level security;
alter table public.workspace_finance_settings force row level security;

create policy finance_settings_select_member
  on public.workspace_finance_settings for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy finance_settings_insert_member
  on public.workspace_finance_settings for insert to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy finance_settings_update_member
  on public.workspace_finance_settings for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

grant select, insert, update on table public.workspace_finance_settings to authenticated;

-- Snapshot of split on a sale (no payouts).
create table public.sale_profit_splits (
  sale_id uuid primary key references public.sales (id) on delete restrict,
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  enabled boolean not null default false,
  member_a_id uuid not null references public.profiles (id) on delete restrict,
  member_b_id uuid not null references public.profiles (id) on delete restrict,
  percent_a integer not null
    constraint sale_split_percent_a_chk check (percent_a >= 0 and percent_a <= 100),
  percent_b integer not null
    constraint sale_split_percent_b_chk check (percent_b >= 0 and percent_b <= 100),
  constraint sale_split_percent_sum_chk check (percent_a + percent_b = 100),
  constraint sale_split_members_distinct_chk check (member_a_id <> member_b_id),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  version integer not null default 1
    constraint sale_split_version_positive_chk check (version > 0)
);

revoke all on table public.sale_profit_splits from public, anon, authenticated;

create or replace function private.protect_sale_profit_splits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  sale_ws uuid;
  sale_status text;
begin
  if actor is null then
    raise exception 'sale splits require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;

  select s.workspace_id, s.status into sale_ws, sale_status
  from public.sales s where s.id = new.sale_id;

  if sale_ws is null then
    raise exception 'sale not found' using errcode = 'foreign_key_violation';
  end if;
  if sale_ws is distinct from new.workspace_id then
    raise exception 'sale split workspace mismatch'
      using errcode = 'check_violation';
  end if;
  if not private.is_workspace_member(new.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.is_workspace_member_of(new.member_a_id, new.workspace_id)
     or not private.is_workspace_member_of(new.member_b_id, new.workspace_id) then
    raise exception 'share members must belong to workspace'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    if sale_status <> 'open' then
      raise exception 'splits can only be created for open sales'
        using errcode = 'check_violation';
    end if;
    new.version := 1;
    new.created_by := actor;
    new.created_at := now();
  else
    if sale_status <> 'open' then
      raise exception 'splits on closed sales cannot be edited'
        using errcode = 'check_violation';
    end if;
    new.sale_id := old.sale_id;
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

create trigger sale_profit_splits_protect
before insert or update on public.sale_profit_splits
for each row execute function private.protect_sale_profit_splits();

create or replace function private.forbid_sale_profit_splits_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'sale_profit_splits cannot be deleted'
    using errcode = 'check_violation';
end;
$$;

create trigger sale_profit_splits_forbid_delete
before delete on public.sale_profit_splits
for each row execute function private.forbid_sale_profit_splits_delete();

alter table public.sale_profit_splits enable row level security;
alter table public.sale_profit_splits force row level security;

create policy sale_splits_select_member
  on public.sale_profit_splits for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy sale_splits_insert_member
  on public.sale_profit_splits for insert to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy sale_splits_update_member
  on public.sale_profit_splits for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

grant select, insert, update on table public.sale_profit_splits to authenticated;

-- ---------------------------------------------------------------------------
-- Rating settings + append-only events
-- ---------------------------------------------------------------------------

create table public.workspace_rating_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete restrict,
  rating_enabled boolean not null default false,
  weights jsonb not null default '{
    "listing_create": 2,
    "listing_update": 1,
    "listing_description": 2,
    "ad_review": 1,
    "ad_payment": 1,
    "buyer_reply": 0,
    "order_received": 2,
    "sale_completed": 3
  }'::jsonb,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  version integer not null default 1
    constraint rating_settings_version_positive_chk check (version > 0)
);

revoke all on table public.workspace_rating_settings from public, anon, authenticated;

create or replace function private.protect_rating_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'rating settings require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.is_workspace_member(new.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(new.weights) is distinct from 'object' then
    raise exception 'weights must be a json object'
      using errcode = 'check_violation';
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

create or replace function private.audit_rating_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_user_audit_event(
      new.workspace_id, 'rating_settings.created', 'workspace_rating_settings',
      new.workspace_id, null, to_jsonb(new)
    );
  else
    perform private.write_user_audit_event(
      new.workspace_id, 'rating_settings.updated', 'workspace_rating_settings',
      new.workspace_id, to_jsonb(old), to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

create trigger workspace_rating_settings_protect
before insert or update on public.workspace_rating_settings
for each row execute function private.protect_rating_settings();

create trigger workspace_rating_settings_audit
after insert or update on public.workspace_rating_settings
for each row execute function private.audit_rating_settings();

create or replace function private.forbid_rating_settings_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'workspace_rating_settings cannot be deleted'
    using errcode = 'check_violation';
end;
$$;

create trigger workspace_rating_settings_forbid_delete
before delete on public.workspace_rating_settings
for each row execute function private.forbid_rating_settings_delete();

alter table public.workspace_rating_settings enable row level security;
alter table public.workspace_rating_settings force row level security;

create policy rating_settings_select_member
  on public.workspace_rating_settings for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy rating_settings_insert_member
  on public.workspace_rating_settings for insert to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy rating_settings_update_member
  on public.workspace_rating_settings for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

grant select, insert, update on table public.workspace_rating_settings to authenticated;

create table public.rating_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action_key text not null,
  points integer not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict
);

revoke all on table public.rating_events from public, anon, authenticated;

create index rating_events_workspace_actor_idx
  on public.rating_events (workspace_id, actor_id, created_at desc);

create or replace function private.protect_rating_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'UPDATE' then
    raise exception 'rating_events are append-only'
      using errcode = 'check_violation';
  end if;
  if actor is null then
    raise exception 'rating events require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.is_workspace_member(new.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;
  new.created_by := actor;
  new.created_at := now();
  if new.actor_id is null then
    new.actor_id := actor;
  end if;
  return new;
end;
$$;

create trigger rating_events_protect
before insert or update on public.rating_events
for each row execute function private.protect_rating_events();

create or replace function private.forbid_rating_events_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'rating_events cannot be deleted'
    using errcode = 'check_violation';
end;
$$;

create trigger rating_events_forbid_delete
before delete on public.rating_events
for each row execute function private.forbid_rating_events_delete();

alter table public.rating_events enable row level security;
alter table public.rating_events force row level security;

create policy rating_events_select_member
  on public.rating_events for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy rating_events_insert_member
  on public.rating_events for insert to authenticated
  with check (private.is_workspace_member(workspace_id));

grant select, insert on table public.rating_events to authenticated;

revoke all on function private.is_workspace_member_of(uuid, uuid) from public, anon, authenticated;
revoke all on function private.protect_finance_settings() from public, anon, authenticated;
revoke all on function private.audit_finance_settings() from public, anon, authenticated;
revoke all on function private.forbid_finance_settings_delete() from public, anon, authenticated;
revoke all on function private.protect_sale_profit_splits() from public, anon, authenticated;
revoke all on function private.forbid_sale_profit_splits_delete() from public, anon, authenticated;
revoke all on function private.protect_rating_settings() from public, anon, authenticated;
revoke all on function private.audit_rating_settings() from public, anon, authenticated;
revoke all on function private.forbid_rating_settings_delete() from public, anon, authenticated;
revoke all on function private.protect_rating_events() from public, anon, authenticated;
revoke all on function private.forbid_rating_events_delete() from public, anon, authenticated;

commit;

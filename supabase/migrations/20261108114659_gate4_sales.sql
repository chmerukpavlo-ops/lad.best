-- Gate 4: sales + controlled complete/correct
-- Review only — do not apply until explicitly permitted.
-- Scope: sales table, RLS, locks on completed snapshot. No returns / shares / payouts / dashboard.

begin;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  listing_id uuid not null references public.listings (id) on delete restrict,

  sale_price numeric(12, 2) not null
    constraint sales_sale_price_nonneg_chk check (sale_price >= 0)
    constraint sales_sale_price_scale_chk check (scale(sale_price) <= 2),
  cost_price numeric(12, 2) not null
    constraint sales_cost_price_nonneg_chk check (cost_price >= 0)
    constraint sales_cost_price_scale_chk check (scale(cost_price) <= 2),
  direct_expenses numeric(12, 2) not null default 0
    constraint sales_direct_expenses_nonneg_chk check (direct_expenses >= 0)
    constraint sales_direct_expenses_scale_chk check (scale(direct_expenses) <= 2),

  color_text text
    constraint sales_color_text_len_chk check (
      color_text is null or char_length(color_text) <= 200
    ),
  size_text text
    constraint sales_size_text_len_chk check (
      size_text is null or char_length(size_text) <= 100
    ),
  note text
    constraint sales_note_len_chk check (
      note is null or char_length(note) <= 4000
    ),

  executor_id uuid not null references public.profiles (id) on delete restrict,
  sold_on date not null,

  status text not null default 'open'
    constraint sales_status_chk check (status in ('open', 'completed', 'cancelled')),

  -- Snapshot: set only by controlled complete/correct. Null while open/cancelled.
  margin numeric(12, 2)
    constraint sales_margin_scale_chk check (margin is null or scale(margin) <= 2),
  completed_on date,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete restrict,

  correction_reason text
    constraint sales_correction_reason_len_chk check (
      correction_reason is null or char_length(correction_reason) <= 2000
    ),

  version integer not null default 1
    constraint sales_version_positive_chk check (version > 0),
  client_request_id uuid not null,
  complete_request_id uuid,

  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sales_completed_snapshot_chk check (
    (
      status = 'completed'
      and margin is not null
      and completed_on is not null
      and completed_at is not null
      and completed_by is not null
      and complete_request_id is not null
    )
    or (
      status <> 'completed'
      and margin is null
      and completed_on is null
      and completed_at is null
      and completed_by is null
    )
  )
);

create unique index sales_workspace_client_request_uidx
  on public.sales (workspace_id, client_request_id);

create unique index sales_workspace_complete_request_uidx
  on public.sales (workspace_id, complete_request_id)
  where complete_request_id is not null;

create index sales_workspace_status_sold_on_idx
  on public.sales (workspace_id, status, sold_on desc);

create index sales_listing_status_idx
  on public.sales (listing_id, status);

create index sales_workspace_updated_idx
  on public.sales (workspace_id, updated_at desc);

revoke all on table public.sales from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers: controlled op flag (session-local)
-- ---------------------------------------------------------------------------

create or replace function private.sale_op()
returns text
language sql
stable
as $$
  select nullif(current_setting('lad.sale_op', true), '');
$$;

create or replace function private.compute_sale_margin(
  p_sale_price numeric,
  p_cost_price numeric,
  p_direct_expenses numeric
)
returns numeric
language sql
immutable
as $$
  select round(p_sale_price, 2) - round(p_cost_price, 2) - round(p_direct_expenses, 2);
$$;

-- ---------------------------------------------------------------------------
-- Protect columns / state machine for ordinary writes
-- ---------------------------------------------------------------------------

create or replace function private.protect_sale_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  listing_workspace uuid;
  executor_ok boolean;
  op text := private.sale_op();
begin
  if actor is null then
    raise exception 'sale changes require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'INSERT' then
    select l.workspace_id into listing_workspace
    from public.listings l
    where l.id = new.listing_id;

    if listing_workspace is null then
      raise exception 'listing not found for sale'
        using errcode = 'foreign_key_violation';
    end if;

    new.workspace_id := listing_workspace;

    if not private.is_workspace_member(new.workspace_id) then
      raise exception 'not a workspace member'
        using errcode = 'insufficient_privilege';
    end if;

    select exists (
      select 1 from public.memberships m
      where m.workspace_id = new.workspace_id and m.profile_id = new.executor_id
    ) into executor_ok;

    if not coalesce(executor_ok, false) then
      raise exception 'executor must be a workspace member'
        using errcode = 'check_violation';
    end if;

    -- Never allow inserting already completed/cancelled with forged snapshot.
    new.status := 'open';
    new.margin := null;
    new.completed_on := null;
    new.completed_at := null;
    new.completed_by := null;
    new.complete_request_id := null;
    new.correction_reason := null;

    new.created_by := actor;
    new.updated_by := actor;
    new.created_at := now();
    new.updated_at := now();
    new.version := 1;

    new.sale_price := round(new.sale_price, 2);
    new.cost_price := round(new.cost_price, 2);
    new.direct_expenses := round(coalesce(new.direct_expenses, 0), 2);
    new.color_text := nullif(trim(coalesce(new.color_text, '')), '');
    new.size_text := nullif(trim(coalesce(new.size_text, '')), '');
    new.note := nullif(trim(coalesce(new.note, '')), '');
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.listing_id := old.listing_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.client_request_id := old.client_request_id;
    new.updated_by := actor;
    new.updated_at := now();
    new.version := old.version + 1;

    -- Controlled paths set lad.sale_op and may change completed snapshot / status.
    if op = 'complete' then
      if old.status <> 'open' then
        raise exception 'only open sales can be completed'
          using errcode = 'check_violation';
      end if;
      if new.status <> 'completed' then
        raise exception 'complete op must set status=completed'
          using errcode = 'check_violation';
      end if;
      return new;
    end if;

    if op = 'correct_completed' then
      if old.status <> 'completed' then
        raise exception 'correct_completed requires completed sale'
          using errcode = 'check_violation';
      end if;
      if new.status <> 'completed' then
        raise exception 'correct_completed must keep status=completed'
          using errcode = 'check_violation';
      end if;
      if nullif(trim(coalesce(new.correction_reason, '')), '') is null
         or char_length(trim(new.correction_reason)) < 3 then
        raise exception 'correction_reason required'
          using errcode = 'check_violation';
      end if;
      new.correction_reason := trim(new.correction_reason);
      new.complete_request_id := old.complete_request_id;
      new.completed_by := old.completed_by;
      new.completed_at := old.completed_at;
      return new;
    end if;

    if op = 'cancel_open' then
      if old.status <> 'open' then
        raise exception 'only open sales can be cancelled'
          using errcode = 'check_violation';
      end if;
      if new.status <> 'cancelled' then
        raise exception 'cancel op must set status=cancelled'
          using errcode = 'check_violation';
      end if;
      new.margin := null;
      new.completed_on := null;
      new.completed_at := null;
      new.completed_by := null;
      new.complete_request_id := null;
      return new;
    end if;

    -- Ordinary UPDATE: open only; no status/snapshot forgery.
    if old.status <> 'open' then
      raise exception 'closed sales cannot be edited via ordinary update'
        using errcode = 'check_violation';
    end if;

    if new.status is distinct from 'open' then
      raise exception 'status changes require controlled operations'
        using errcode = 'check_violation';
    end if;

    new.margin := null;
    new.completed_on := null;
    new.completed_at := null;
    new.completed_by := null;
    new.complete_request_id := null;
    new.correction_reason := null;

    new.sale_price := round(new.sale_price, 2);
    new.cost_price := round(new.cost_price, 2);
    new.direct_expenses := round(coalesce(new.direct_expenses, 0), 2);
    new.color_text := nullif(trim(coalesce(new.color_text, '')), '');
    new.size_text := nullif(trim(coalesce(new.size_text, '')), '');
    new.note := nullif(trim(coalesce(new.note, '')), '');

    select exists (
      select 1 from public.memberships m
      where m.workspace_id = new.workspace_id and m.profile_id = new.executor_id
    ) into executor_ok;

    if not coalesce(executor_ok, false) then
      raise exception 'executor must be a workspace member'
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  return new;
end;
$$;

create or replace function private.audit_sale_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text;
  op text := private.sale_op();
begin
  if tg_op = 'INSERT' then
    perform private.write_user_audit_event(
      new.workspace_id, 'sale.created', 'sales', new.id, null, to_jsonb(new)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if op = 'complete' then
      action_name := 'sale.completed';
    elsif op = 'correct_completed' then
      action_name := 'sale.corrected';
    elsif op = 'cancel_open' then
      action_name := 'sale.cancelled';
    else
      action_name := 'sale.updated';
    end if;

    perform private.write_user_audit_event(
      new.workspace_id, action_name, 'sales', new.id, to_jsonb(old), to_jsonb(new)
    );
    return new;
  end if;

  return null;
end;
$$;

create trigger sales_protect_columns
before insert or update on public.sales
for each row execute function private.protect_sale_columns();

create trigger sales_audit
after insert or update on public.sales
for each row execute function private.audit_sale_change();

create or replace function private.forbid_sale_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'sales cannot be deleted; cancel or correct instead'
    using errcode = 'check_violation';
end;
$$;

create trigger sales_forbid_delete
before delete on public.sales
for each row execute function private.forbid_sale_delete();

-- ---------------------------------------------------------------------------
-- Controlled RPCs (SECURITY DEFINER; membership + version checked)
-- ---------------------------------------------------------------------------

create or replace function public.complete_sale(
  p_sale_id uuid,
  p_expected_version integer,
  p_completed_on date,
  p_complete_request_id uuid
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.sales;
  locked public.sales;
  computed_margin numeric(12, 2);
begin
  if actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid version' using errcode = 'check_violation';
  end if;
  if p_completed_on is null then
    raise exception 'completed_on required' using errcode = 'check_violation';
  end if;
  if p_complete_request_id is null then
    raise exception 'complete_request_id required' using errcode = 'check_violation';
  end if;

  select * into locked
  from public.sales s
  where s.id = p_sale_id
  for update;

  if not found then
    raise exception 'sale not found' using errcode = 'no_data_found';
  end if;

  if not private.is_workspace_member(locked.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;

  -- Idempotent replay of the same complete request
  if locked.status = 'completed'
     and locked.complete_request_id is not distinct from p_complete_request_id then
    return locked;
  end if;

  if locked.status = 'completed' then
    raise exception 'sale already completed' using errcode = 'check_violation';
  end if;
  if locked.status <> 'open' then
    raise exception 'only open sales can be completed' using errcode = 'check_violation';
  end if;
  if locked.version <> p_expected_version then
    raise exception 'version conflict' using errcode = 'check_violation';
  end if;

  -- Another sale already used this complete_request_id
  if exists (
    select 1 from public.sales s
    where s.workspace_id = locked.workspace_id
      and s.complete_request_id = p_complete_request_id
      and s.id <> locked.id
  ) then
    raise exception 'complete_request_id already used' using errcode = 'unique_violation';
  end if;

  computed_margin := private.compute_sale_margin(
    locked.sale_price, locked.cost_price, locked.direct_expenses
  );

  perform set_config('lad.sale_op', 'complete', true);

  update public.sales s
  set
    status = 'completed',
    margin = computed_margin,
    completed_on = p_completed_on,
    completed_at = now(),
    completed_by = actor,
    complete_request_id = p_complete_request_id,
    correction_reason = null
  where s.id = locked.id
  returning * into row;

  perform set_config('lad.sale_op', '', true);
  return row;
exception
  when others then
    perform set_config('lad.sale_op', '', true);
    raise;
end;
$$;

create or replace function public.correct_completed_sale(
  p_sale_id uuid,
  p_expected_version integer,
  p_sale_price numeric,
  p_cost_price numeric,
  p_direct_expenses numeric,
  p_completed_on date,
  p_executor_id uuid,
  p_color_text text,
  p_size_text text,
  p_note text,
  p_sold_on date,
  p_correction_reason text
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  locked public.sales;
  row public.sales;
  executor_ok boolean;
  reason text := nullif(trim(coalesce(p_correction_reason, '')), '');
  computed_margin numeric(12, 2);
begin
  if actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid version' using errcode = 'check_violation';
  end if;
  if reason is null or char_length(reason) < 3 then
    raise exception 'correction_reason required' using errcode = 'check_violation';
  end if;
  if p_sale_price is null or p_sale_price < 0
     or p_cost_price is null or p_cost_price < 0
     or p_direct_expenses is null or p_direct_expenses < 0 then
    raise exception 'amounts must be non-negative' using errcode = 'check_violation';
  end if;
  if p_completed_on is null or p_sold_on is null then
    raise exception 'dates required' using errcode = 'check_violation';
  end if;

  select * into locked from public.sales s where s.id = p_sale_id for update;
  if not found then
    raise exception 'sale not found' using errcode = 'no_data_found';
  end if;
  if not private.is_workspace_member(locked.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;
  if locked.status <> 'completed' then
    raise exception 'only completed sales can be corrected this way'
      using errcode = 'check_violation';
  end if;
  if locked.version <> p_expected_version then
    raise exception 'version conflict' using errcode = 'check_violation';
  end if;

  select exists (
    select 1 from public.memberships m
    where m.workspace_id = locked.workspace_id and m.profile_id = p_executor_id
  ) into executor_ok;
  if not coalesce(executor_ok, false) then
    raise exception 'executor must be a workspace member'
      using errcode = 'check_violation';
  end if;

  computed_margin := private.compute_sale_margin(
    p_sale_price, p_cost_price, p_direct_expenses
  );

  perform set_config('lad.sale_op', 'correct_completed', true);

  update public.sales s
  set
    sale_price = round(p_sale_price, 2),
    cost_price = round(p_cost_price, 2),
    direct_expenses = round(p_direct_expenses, 2),
    margin = computed_margin,
    completed_on = p_completed_on,
    sold_on = p_sold_on,
    executor_id = p_executor_id,
    color_text = nullif(trim(coalesce(p_color_text, '')), ''),
    size_text = nullif(trim(coalesce(p_size_text, '')), ''),
    note = nullif(trim(coalesce(p_note, '')), ''),
    correction_reason = reason
  where s.id = locked.id
  returning * into row;

  perform set_config('lad.sale_op', '', true);
  return row;
exception
  when others then
    perform set_config('lad.sale_op', '', true);
    raise;
end;
$$;

create or replace function public.cancel_open_sale(
  p_sale_id uuid,
  p_expected_version integer
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  locked public.sales;
  row public.sales;
begin
  if actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  select * into locked from public.sales s where s.id = p_sale_id for update;
  if not found then
    raise exception 'sale not found' using errcode = 'no_data_found';
  end if;
  if not private.is_workspace_member(locked.workspace_id) then
    raise exception 'not a workspace member'
      using errcode = 'insufficient_privilege';
  end if;
  if locked.status <> 'open' then
    raise exception 'only open sales can be cancelled' using errcode = 'check_violation';
  end if;
  if locked.version <> p_expected_version then
    raise exception 'version conflict' using errcode = 'check_violation';
  end if;

  perform set_config('lad.sale_op', 'cancel_open', true);
  update public.sales s
  set status = 'cancelled'
  where s.id = locked.id
  returning * into row;
  perform set_config('lad.sale_op', '', true);
  return row;
exception
  when others then
    perform set_config('lad.sale_op', '', true);
    raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.sales enable row level security;
alter table public.sales force row level security;

create policy sales_select_member
  on public.sales for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy sales_insert_member
  on public.sales for insert to authenticated
  with check (
    private.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.workspace_id = workspace_id
    )
    and exists (
      select 1 from public.memberships m
      where m.workspace_id = workspace_id and m.profile_id = executor_id
    )
  );

create policy sales_update_member
  on public.sales for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (
    private.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.workspace_id = workspace_id
    )
    and exists (
      select 1 from public.memberships m
      where m.workspace_id = workspace_id and m.profile_id = executor_id
    )
  );

-- No DELETE policy.

grant select, insert, update on table public.sales to authenticated;

grant execute on function public.complete_sale(uuid, integer, date, uuid) to authenticated;
grant execute on function public.correct_completed_sale(
  uuid, integer, numeric, numeric, numeric, date, uuid, text, text, text, date, text
) to authenticated;
grant execute on function public.cancel_open_sale(uuid, integer) to authenticated;

revoke all on function private.protect_sale_columns() from public, anon, authenticated;
revoke all on function private.audit_sale_change() from public, anon, authenticated;
revoke all on function private.forbid_sale_delete() from public, anon, authenticated;
revoke all on function private.sale_op() from public, anon, authenticated;
revoke all on function private.compute_sale_margin(numeric, numeric, numeric) from public, anon, authenticated;

commit;

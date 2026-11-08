-- Gate 3: advertising payments on listings
-- Review only — do not apply until explicitly permitted.
-- Scope: ad_payments + RLS/triggers/audit/idempotency. No sales / coverage / ad_cost.

begin;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.ad_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  listing_id uuid not null references public.listings (id) on delete restrict,
  amount numeric(12, 2) not null
    constraint ad_payments_amount_nonneg_chk check (amount >= 0)
    constraint ad_payments_amount_scale_chk check (scale(amount) <= 2),
  paid_on date not null,
  payer_id uuid not null references public.profiles (id) on delete restrict,
  note text
    constraint ad_payments_note_len_chk check (
      note is null or char_length(note) <= 4000
    ),
  status text not null default 'valid'
    constraint ad_payments_status_chk check (status in ('valid', 'void')),
  correction_reason text
    constraint ad_payments_correction_reason_len_chk check (
      correction_reason is null or char_length(correction_reason) <= 2000
    ),
  version integer not null default 1
    constraint ad_payments_version_positive_chk check (version > 0),
  client_request_id uuid not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_payments_valid_amount_positive_chk check (
    status <> 'valid' or amount > 0
  ),
  constraint ad_payments_correction_reason_on_void_chk check (
    status <> 'void' or (
      correction_reason is not null
      and char_length(trim(correction_reason)) >= 3
    )
  )
);

-- Idempotent create: same workspace + client request → one payment.
create unique index ad_payments_workspace_client_request_uidx
  on public.ad_payments (workspace_id, client_request_id);

create index ad_payments_workspace_paid_on_idx
  on public.ad_payments (workspace_id, paid_on desc);

create index ad_payments_listing_status_paid_on_idx
  on public.ad_payments (listing_id, status, paid_on desc);

create index ad_payments_workspace_updated_idx
  on public.ad_payments (workspace_id, updated_at desc);

-- Strip default table extras immediately (TRUNCATE bypasses RLS).
revoke all on table public.ad_payments from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Consistency + authorship
-- ---------------------------------------------------------------------------

create or replace function private.protect_ad_payment_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  listing_workspace uuid;
  payer_ok boolean;
  reason text;
begin
  if actor is null then
    raise exception 'ad payment changes require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'INSERT' then
    select l.workspace_id
      into listing_workspace
    from public.listings l
    where l.id = new.listing_id;

    if listing_workspace is null then
      raise exception 'listing not found for ad payment'
        using errcode = 'foreign_key_violation';
    end if;

    new.workspace_id := listing_workspace;

    if not private.is_workspace_member(new.workspace_id) then
      raise exception 'not a workspace member'
        using errcode = 'insufficient_privilege';
    end if;

    select exists (
      select 1
      from public.memberships m
      where m.workspace_id = new.workspace_id
        and m.profile_id = new.payer_id
    )
    into payer_ok;

    if not coalesce(payer_ok, false) then
      raise exception 'payer must be a workspace member'
        using errcode = 'check_violation';
    end if;

    new.created_by := actor;
    new.updated_by := actor;
    new.created_at := now();
    new.updated_at := now();
    new.version := 1;
    new.correction_reason := null;
    if new.status is null then
      new.status := 'valid';
    end if;
    if new.status <> 'valid' then
      raise exception 'new ad payment must start as valid'
        using errcode = 'check_violation';
    end if;
    new.note := nullif(trim(coalesce(new.note, '')), '');
    new.amount := round(new.amount, 2);
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
    new.note := nullif(trim(coalesce(new.note, '')), '');
    new.amount := round(new.amount, 2);

    reason := nullif(trim(coalesce(new.correction_reason, '')), '');
    if reason is null or char_length(reason) < 3 then
      raise exception 'correction_reason is required for ad payment changes'
        using errcode = 'check_violation';
    end if;
    new.correction_reason := reason;

    select exists (
      select 1
      from public.memberships m
      where m.workspace_id = new.workspace_id
        and m.profile_id = new.payer_id
    )
    into payer_ok;

    if not coalesce(payer_ok, false) then
      raise exception 'payer must be a workspace member'
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  return new;
end;
$$;

create or replace function private.audit_ad_payment_change()
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
      new.workspace_id,
      'ad_payment.created',
      'ad_payments',
      new.id,
      null,
      to_jsonb(new)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status is distinct from new.status and new.status = 'void' then
      action_name := 'ad_payment.voided';
    else
      action_name := 'ad_payment.corrected';
    end if;

    perform private.write_user_audit_event(
      new.workspace_id,
      action_name,
      'ad_payments',
      new.id,
      to_jsonb(old),
      to_jsonb(new)
    );
    return new;
  end if;

  return null;
end;
$$;

create trigger ad_payments_protect_columns
before insert or update on public.ad_payments
for each row execute function private.protect_ad_payment_columns();

create trigger ad_payments_audit
after insert or update on public.ad_payments
for each row execute function private.audit_ad_payment_change();

create or replace function private.forbid_ad_payment_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'ad payments cannot be deleted; void or correct instead'
    using errcode = 'check_violation';
end;
$$;

create trigger ad_payments_forbid_delete
before delete on public.ad_payments
for each row execute function private.forbid_ad_payment_delete();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ad_payments enable row level security;
alter table public.ad_payments force row level security;

create policy ad_payments_select_member
  on public.ad_payments
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy ad_payments_insert_member
  on public.ad_payments
  for insert
  to authenticated
  with check (
    private.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.workspace_id = workspace_id
    )
    and exists (
      select 1
      from public.memberships m
      where m.workspace_id = workspace_id
        and m.profile_id = payer_id
    )
  );

create policy ad_payments_update_member
  on public.ad_payments
  for update
  to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (
    private.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.workspace_id = workspace_id
    )
    and exists (
      select 1
      from public.memberships m
      where m.workspace_id = workspace_id
        and m.profile_id = payer_id
    )
  );

-- No DELETE policy.

-- ---------------------------------------------------------------------------
-- Grants (explicit; no TRUNCATE/REFERENCES/TRIGGER for API roles)
-- ---------------------------------------------------------------------------

grant select, insert, update on table public.ad_payments to authenticated;

revoke all on function private.protect_ad_payment_columns() from public, anon, authenticated;
revoke all on function private.audit_ad_payment_change() from public, anon, authenticated;
revoke all on function private.forbid_ad_payment_delete() from public, anon, authenticated;

commit;

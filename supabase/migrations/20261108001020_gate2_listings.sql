-- Gate 2: listings (оголошення)
-- Review only — do not apply until explicitly permitted.
-- Scope: listings + RLS/triggers/audit. No ads / sales / calendar.

begin;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  title text not null
    constraint listings_title_nonempty_chk check (char_length(trim(title)) > 0)
    constraint listings_title_len_chk check (char_length(title) <= 200),
  colors_text text
    constraint listings_colors_text_len_chk check (
      colors_text is null or char_length(colors_text) <= 4000
    ),
  description text
    constraint listings_description_len_chk check (
      description is null or char_length(description) <= 8000
    ),
  notes text
    constraint listings_notes_len_chk check (
      notes is null or char_length(notes) <= 8000
    ),
  publication_url text
    constraint listings_publication_url_len_chk check (
      publication_url is null or char_length(publication_url) <= 2000
    ),
  status text not null default 'active'
    constraint listings_status_chk check (status in ('active', 'archived')),
  version integer not null default 1
    constraint listings_version_positive_chk check (version > 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_workspace_status_updated_idx
  on public.listings (workspace_id, status, updated_at desc);

create index listings_workspace_updated_idx
  on public.listings (workspace_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Triggers: authorship, version, timestamps; audit via private writers
-- ---------------------------------------------------------------------------

create or replace function private.protect_listing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'listing changes require authenticated auth.uid()'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := actor;
    new.updated_by := actor;
    new.created_at := now();
    new.updated_at := now();
    new.version := 1;
    if new.status is null then
      new.status := 'active';
    end if;
    -- Empty optional text → null
    new.colors_text := nullif(trim(coalesce(new.colors_text, '')), '');
    new.description := nullif(trim(coalesce(new.description, '')), '');
    new.notes := nullif(trim(coalesce(new.notes, '')), '');
    new.publication_url := nullif(trim(coalesce(new.publication_url, '')), '');
    new.title := trim(new.title);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := actor;
    new.updated_at := now();
    -- Client cannot forge version; always bump from current row.
    new.version := old.version + 1;
    new.colors_text := nullif(trim(coalesce(new.colors_text, '')), '');
    new.description := nullif(trim(coalesce(new.description, '')), '');
    new.notes := nullif(trim(coalesce(new.notes, '')), '');
    new.publication_url := nullif(trim(coalesce(new.publication_url, '')), '');
    new.title := trim(new.title);
    return new;
  end if;

  return new;
end;
$$;

create or replace function private.audit_listing_change()
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
      'listing.created',
      'listings',
      new.id,
      null,
      to_jsonb(new)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status is distinct from new.status and new.status = 'archived' then
      action_name := 'listing.archived';
    elsif old.status is distinct from new.status and new.status = 'active' then
      action_name := 'listing.restored';
    else
      action_name := 'listing.updated';
    end if;

    perform private.write_user_audit_event(
      new.workspace_id,
      action_name,
      'listings',
      new.id,
      to_jsonb(old),
      to_jsonb(new)
    );
    return new;
  end if;

  return null;
end;
$$;

create trigger listings_protect_columns
before insert or update on public.listings
for each row execute function private.protect_listing_columns();

create trigger listings_audit
after insert or update on public.listings
for each row execute function private.audit_listing_change();

-- Block physical deletes for authenticated Data API (no policy + revoke).
-- Defense in depth: reject DELETE even for elevated roles that bypass RLS grants.
create or replace function private.forbid_listing_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'listings cannot be deleted; archive instead'
    using errcode = 'check_violation';
end;
$$;

create trigger listings_forbid_delete
before delete on public.listings
for each row execute function private.forbid_listing_delete();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.listings enable row level security;
alter table public.listings force row level security;

create policy listings_select_member
  on public.listings
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy listings_insert_member
  on public.listings
  for insert
  to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy listings_update_member
  on public.listings
  for update
  to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

-- No DELETE policy for authenticated.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update on table public.listings to authenticated;

revoke all on function private.protect_listing_columns() from public, anon, authenticated;
revoke all on function private.audit_listing_change() from public, anon, authenticated;
revoke all on function private.forbid_listing_delete() from public, anon, authenticated;

commit;

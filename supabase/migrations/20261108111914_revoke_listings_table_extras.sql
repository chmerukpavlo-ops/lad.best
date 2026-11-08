-- Gate 2 grant hygiene (local file only until explicit apply).
-- CREATE TABLE left default REFERENCES/TRIGGER/TRUNCATE on API roles;
-- RLS does not constrain TRUNCATE. Keep app grants: SELECT/INSERT/UPDATE for authenticated.

begin;

revoke truncate, references, trigger on table public.listings
  from anon, authenticated;

-- Idempotent: intended Data API privileges for the app.
grant select, insert, update on table public.listings to authenticated;

-- anon must have no table privileges on listings.
revoke all on table public.listings from anon;

commit;

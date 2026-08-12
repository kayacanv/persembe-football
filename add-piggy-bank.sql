-- Kumbara (piggy bank) — a one-off whip-round for a pitch fee that has to be
-- paid whether or not the match is played.
--
-- Deliberately STANDALONE: no foreign keys to matches / users / match_players.
-- A contribution is just "someone sent money with the campaign reference".
-- Campaign metadata (goal, reference code) lives in app/config/piggy.ts, so a
-- new campaign needs no schema change.
--
-- Apply manually (no migration framework here):
--   supabase db query --linked --file add-piggy-bank.sql

create table if not exists public.piggy_contributions (
  id            uuid primary key default gen_random_uuid(),
  campaign      text not null,                      -- slug from app/config/piggy.ts
  source        text not null default 'starling',   -- starling | manual
  external_id   text not null,                      -- Starling feed_item_uid; dedupe key
  amount_minor  integer not null,                   -- pence
  currency      text not null default 'GBP',
  display_name  text,                               -- payer name as the bank reported it
  paid_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Idempotency: re-processing the same Starling feed item never double-counts.
create unique index if not exists piggy_contributions_source_external_key
  on public.piggy_contributions (source, external_id);

create index if not exists piggy_contributions_campaign_idx
  on public.piggy_contributions (campaign, paid_at desc);

-- RLS: the contributor wall is public by design, but it only ever exposes a
-- name + an amount. The page reads THIS table, never `bank_payments` (which
-- holds the raw bank feed). Writes are service-role only (webhook + cron).
alter table public.piggy_contributions enable row level security;

drop policy if exists piggy_contributions_read on public.piggy_contributions;
create policy piggy_contributions_read
  on public.piggy_contributions for select
  using (true);

drop policy if exists piggy_contributions_service_write on public.piggy_contributions;
create policy piggy_contributions_service_write
  on public.piggy_contributions for all
  to service_role
  using (true)
  with check (true);

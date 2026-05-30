-- Starling bank payment tracking.
--
-- Stores every incoming Starling feed item we fetch (via webhook or cron), so
-- matching to a player's `match_players.has_paid` is idempotent and auditable.
-- Apply manually in the Supabase SQL editor (no migration framework here).

create table if not exists public.bank_payments (
  id                       uuid primary key default gen_random_uuid(),
  provider                 text not null default 'starling',
  feed_item_uid            text not null,            -- Starling's stable id; dedupe key
  amount_minor             integer not null,          -- pence
  currency                 text not null,
  direction                text,                      -- IN / OUT
  reference                text,                      -- payer-supplied text
  counterparty_name        text,
  transaction_time         timestamptz not null,
  matched_match_player_id  uuid references public.match_players(id) on delete set null,
  match_status             text not null default 'unmatched',  -- unmatched | matched
  raw                      jsonb not null,
  created_at               timestamptz not null default now()
);

-- Dedupe: one row per Starling feed item, per provider.
create unique index if not exists bank_payments_provider_feed_uid_key
  on public.bank_payments (provider, feed_item_uid);

create index if not exists bank_payments_match_status_idx
  on public.bank_payments (match_status);

-- RLS: reads allowed (admin reconcile screen uses the anon browser client like
-- the rest of the app); writes restricted to the service-role key used by the
-- webhook + cron routes.
alter table public.bank_payments enable row level security;

drop policy if exists bank_payments_read on public.bank_payments;
create policy bank_payments_read
  on public.bank_payments for select
  using (true);

drop policy if exists bank_payments_service_write on public.bank_payments;
create policy bank_payments_service_write
  on public.bank_payments for all
  to service_role
  using (true)
  with check (true);

-- Public result of the crowd-voted stats (plan-ratings.md, Phase 2).
--
-- One row per rated player, recomputed by app/actions/rating-actions.ts after
-- every saved rating. Holds only what the card shows: the five position
-- ratings (60-99, same scale as the votes) and how many people have rated the player.
-- Position ratings stay NULL until MIN_VOTERS have voted (the card shows "?").
-- The per-stat averages are deliberately not stored anywhere public.
--
-- Everyone can read it; nobody but the service role can write it.

create table if not exists public.player_ratings (
  user_id    uuid primary key references public.users (id) on delete cascade,
  voters     integer not null default 0,
  cf         smallint check (cf between 70 and 99),
  cm         smallint check (cm between 70 and 99),
  wm         smallint check (wm between 70 and 99),
  fb         smallint check (fb between 70 and 99),
  cb         smallint check (cb between 70 and 99),
  updated_at timestamptz not null default now()
);

alter table public.player_ratings enable row level security;

drop policy if exists "player_ratings public read" on public.player_ratings;
create policy "player_ratings public read" on public.player_ratings for select using (true);

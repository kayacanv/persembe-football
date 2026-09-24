-- Crowd-voted player stats (plan-ratings.md, Phase 1).
--
-- A signed-in player rates a teammate on all 8 stats at once; one row per
-- (voter, target, stat), overwritten when they change their mind. Values are
-- the fixed buttons 60/70/80/85/90/95/99. A skipped player goes to the back of
-- the voter's queue via stat_rating_skips.
--
-- Every vote is private. No policies, so the anon and authenticated keys get
-- nothing; app/actions/rating-actions.ts works with the service-role key,
-- always scoped to the session's player.

create table if not exists public.stat_ratings (
  voter_id   uuid not null references public.users (id) on delete cascade,
  target_id  uuid not null references public.users (id) on delete cascade,
  stat       text not null check (stat in ('pac', 'sho', 'pas', 'dri', 'def', 'phy', 'tw', 'wr')),
  value      smallint not null check (value in (60, 70, 80, 85, 90, 95, 99)),
  updated_at timestamptz not null default now(),
  primary key (voter_id, target_id, stat),
  check (voter_id <> target_id)
);

create index if not exists stat_ratings_target_idx on public.stat_ratings (target_id);

alter table public.stat_ratings enable row level security;

create table if not exists public.stat_rating_skips (
  voter_id   uuid not null references public.users (id) on delete cascade,
  target_id  uuid not null references public.users (id) on delete cascade,
  skipped_at timestamptz not null default now(),
  primary key (voter_id, target_id)
);

alter table public.stat_rating_skips enable row level security;

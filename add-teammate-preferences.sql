-- Teammate preferences: a signed-in player marks other regulars as "want"
-- (I'd like to be on their team) or "ok" (fine being on their team).
-- "No preference" is the absence of a row, and the team balancer will read it
-- as a soft negative (want = +1, ok = 0, nothing = -1).
--
-- Every vote is private, including from the target. No policies, so the anon
-- and authenticated keys get nothing; app/actions/preference-actions.ts reads
-- and writes with the service-role key, always scoped to the session's player.

create table if not exists public.teammate_preferences (
  voter_id   uuid not null references public.users (id) on delete cascade,
  target_id  uuid not null references public.users (id) on delete cascade,
  pref       text not null check (pref in ('want', 'ok')),
  updated_at timestamptz not null default now(),
  primary key (voter_id, target_id),
  check (voter_id <> target_id)
);

create index if not exists teammate_preferences_target_idx
  on public.teammate_preferences (target_id);

alter table public.teammate_preferences enable row level security;

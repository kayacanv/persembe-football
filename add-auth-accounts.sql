-- Login accounts: link existing player rows to Supabase Auth users and add a
-- login handle. Players keep their existing public.users.id (referenced by
-- match_players, mvp_votes, payments); auth is linked, never swapped in.
--
-- auth_id IS NOT NULL means "this player has claimed their account".
-- The auth identity itself is the player's E.164 phone (see app/lib/phone.ts);
-- the username is only a login handle so phones are never typed at sign-in.

alter table public.users
  add column if not exists auth_id uuid unique references auth.users (id) on delete set null,
  add column if not exists username text;

-- Usernames: lowercase slug, 3-24 chars, unique case-insensitively.
-- Mirrors USERNAME_REGEX in app/lib/username.ts — keep the two in sync.
do $$
begin
  alter table public.users
    add constraint users_username_format
      check (username is null or username ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$');
exception
  when duplicate_object then null;
end $$;

create unique index if not exists users_username_lower_key
  on public.users (lower(username));

-- Throttle account-claim attempts per target player (counted in claimAccount).
create table if not exists public.claim_attempts (
  id bigserial primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

create index if not exists claim_attempts_user_time_idx
  on public.claim_attempts (user_id, attempted_at desc);

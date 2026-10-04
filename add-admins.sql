-- Admins: players who get the admin shortcuts on the home page.
--
-- A separate table rather than a users.is_admin column on purpose: public.users
-- has no RLS and the anon key writes to it (names, profile cards), so a column
-- there could be flipped by anyone from the browser. This table is RLS-locked
-- with no policies, so only the service-role key (getCurrentPlayer) reads it and
-- only the SQL editor writes it.
--
-- Make someone an admin:
--   insert into public.admins (user_id)
--   select id from public.users where username = '<username>'
--   on conflict do nothing;

create table if not exists public.admins (
  user_id uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Kayacan (username 'kayacan') runs the match.
insert into public.admins (user_id)
select id from public.users where username = 'kayacan'
on conflict do nothing;

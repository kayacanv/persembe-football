-- Manual payments: an admin marks a registration paid by hand, for money that
-- reached an account the app cannot see (Revolut, another bank, cash).
--
-- match_players.has_paid stays the single "paid" flag every screen reads; this
-- table only records that the flag was set by hand, by whom, and the admin's
-- note ("sent to my Revolut"). One row per registration, so re-marking edits
-- the note, and undoing deletes the row and clears has_paid.
--
-- RLS-locked with no policies, like public.admins: notes are for admins only,
-- so every read and write goes through the service-role key in
-- app/actions/manual-payment-actions.ts after an admin check.

create table if not exists public.manual_payments (
  match_player_id uuid primary key references public.match_players (id) on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  marked_by uuid references public.users (id) on delete set null,
  marked_at timestamptz not null default now()
);

alter table public.manual_payments enable row level security;

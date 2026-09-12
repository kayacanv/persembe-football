-- Leaving a match is now a hard delete and a match has only two statuses.
--
-- Before this change match_players.status had a third value, 'canceled', kept
-- as a tombstone row with a cancellation_date, and matches.status had a manual
-- 'ready' step between 'registering' and 'done'. Both are gone: leaving deletes
-- the match_players row (a reserve is promoted if a playing slot opened), and a
-- match is 'registering' until the Thursday-21:00 cron flips it to 'done'. The
-- team view on the match page is derived from assigned teams, not from status.
--
-- Apply with: supabase db query --linked --file remove-soft-cancel.sql
-- Then re-apply add-mark-match-done-cron.sql so the pg_cron function is rebuilt.

-- 1. Drop the tombstone rows. Verified before writing this: all have
-- has_paid = false and none is referenced by bank_payments.matched_match_player_id.
delete from public.match_players where status = 'canceled';

-- 2. Drop the column no code reads any more.
alter table public.match_players drop column if exists cancellation_date;

-- 3. Collapse the match status set. No row is 'ready' today; the update is
-- defensive in case one is created between now and the deploy.
update public.matches set status = 'registering' where status = 'ready';
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status = any (array['registering'::text, 'done'::text]));

-- match_players.status deliberately stays without a check constraint, as today.

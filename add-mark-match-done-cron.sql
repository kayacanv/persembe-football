-- Mark the active match 'done' every Thursday at 21:00 UK time (Europe/London) via pg_cron.
--
-- "Active" match = status in ('registering','ready') (see getActiveMatch()).
-- This flips it to 'done' at kickoff time each week.
--
-- DST-safe: pg_cron fires in UTC, but 21:00 UK is 20:00 UTC in summer (BST)
-- and 21:00 UTC in winter (GMT). We schedule at BOTH 20:00 and 21:00 UTC on
-- Thursdays and guard inside the function so it only acts when the UK
-- wall-clock hour is actually 21. The update is idempotent, so a stray run is
-- harmless anyway.
--
-- Requirements: pg_cron enabled in Supabase (Database -> Extensions -> pg_cron).
-- Apply this file in the Supabase SQL editor (or via migration).

-- 1) Ensure pg_cron is available.
create extension if not exists pg_cron with schema extensions;

-- 2) The worker: mark the active match done (only at Thursday 21:00 UK time).
create or replace function public.mark_active_match_done()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard: only act at Thursday 21:xx UK wall-clock time (DST-safe).
  -- Postgres dow 4 = Thursday. now() at time zone 'Europe/London' yields the
  -- UK wall-clock timestamp regardless of BST/GMT.
  if not (
    extract(dow  from (now() at time zone 'Europe/London')) = 4 and
    extract(hour from (now() at time zone 'Europe/London')) = 21
  ) then
    return;
  end if;

  update public.matches
  set status = 'done'
  where status in ('registering', 'ready');
end;
$$;

-- 3) Schedule: Thursdays at 20:00 and 21:00 UTC (covers 21:00 UK in BST + GMT).
-- The function's guard ensures it only takes effect once, at 21:00 UK time.
-- Re-running this block just re-installs the schedule (matches the house style
-- of add-auto-create-match-cron.sql).
do $$
begin
  perform cron.unschedule('mark-active-match-done');
exception
  when others then null; -- not scheduled yet
end $$;

select cron.schedule(
  'mark-active-match-done',
  '0 20,21 * * 4',
  $cron$ select public.mark_active_match_done(); $cron$
);

-- Verify:
--   select * from cron.job where jobname = 'mark-active-match-done';
--   select * from cron.job_run_details order by start_time desc limit 10;
--
-- Remove later if needed:
--   select cron.unschedule('mark-active-match-done');

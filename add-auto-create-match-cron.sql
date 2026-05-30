-- Auto-create the next weekly match.
--
-- Trigger: once it is more than 1 day after the most recent match (in UK wall
-- time), create the following Thursday's match at 21:00 — unless one already
-- exists. Runs server-side via pg_cron (no visitor needed). Requires pg_cron:
--   create extension if not exists pg_cron;

-- Hard guard against duplicate matches on the same calendar date. Protects every
-- creation path (cron AND the manual "Maç Oluştur" button), not just the cron.
create unique index if not exists matches_date_key on matches (date);

-- The next Thursday strictly after a given date (dates are weekly Thursdays, but
-- this is robust for any input day).
create or replace function public.next_thursday_after(d date)
returns date
language sql
immutable
as $$
  select d + (((4 - extract(dow from d)::int + 6) % 7) + 1);
$$;

-- Creates the next match if due. Idempotent and safe to run repeatedly: it bails
-- out if it is too early, or if a match for the target date already exists.
-- SECURITY DEFINER so the pg_cron job can insert past row-level security.
create or replace function public.auto_create_next_match()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  last_match    matches%rowtype;
  last_dt       timestamptz;
  target_date   date;
  target_text   text;
begin
  -- Most recent match by real (parsed) date, regardless of status.
  select *
    into last_match
    from matches
   order by to_date(date, 'DD.MM.YYYY') desc
   limit 1;

  if found then
    -- Interpret the stored "DD.MM.YYYY" + "HH:MM" as UK wall-clock time.
    last_dt := (to_date(last_match.date, 'DD.MM.YYYY') + last_match.time::time)
               at time zone 'Europe/London';

    -- Not yet 1 full day past the last match — do nothing.
    if now() <= last_dt + interval '1 day' then
      return 'skip: not yet 1 day after last match (' || last_match.date || ')';
    end if;

    target_date := public.next_thursday_after(to_date(last_match.date, 'DD.MM.YYYY'));
  else
    -- No matches at all: schedule the upcoming Thursday (today if it is Thursday).
    target_date := current_date + ((4 - extract(dow from current_date)::int + 7) % 7);
  end if;

  target_text := to_char(target_date, 'DD.MM.YYYY');

  -- Duplicate guard #1 (the unique index is guard #2).
  if exists (select 1 from matches where date = target_text) then
    return 'skip: match already exists for ' || target_text;
  end if;

  insert into matches (date, time, status, price)
  values (target_text, '21:00', 'registering', coalesce(last_match.price, 7.5));

  return 'created match for ' || target_text;
exception
  -- If two runs race, the unique index wins and we treat it as already-created.
  when unique_violation then
    return 'skip: duplicate prevented for ' || target_text;
end;
$$;

-- Schedule it daily at 22:00 UTC (safely past Friday's "last match + 1 day" in
-- both BST and GMT). Re-running this block just re-installs the schedule.
do $$
begin
  perform cron.unschedule('auto-create-next-match');
exception
  when others then null; -- not scheduled yet
end $$;

select cron.schedule(
  'auto-create-next-match',
  '0 22 * * *',
  $cron$ select public.auto_create_next_match(); $cron$
);

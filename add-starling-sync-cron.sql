-- Starling sync backstop via Supabase pg_cron.
--
-- Every 15 minutes it pings the deployed Next.js route, which fetches recent
-- Starling transactions and reconciles them.
-- The webhook still does the real-time work; this is just a safety net.
--
-- Requires the pg_cron + pg_net extensions (both available on Supabase):
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- IMPORTANT: replace <CRON_SECRET> with the same value set in the app's env, and
-- confirm the deployed host. The secret lives in your own database only.

do $$
begin
  perform cron.unschedule('starling-sync');
exception
  when others then null; -- not scheduled yet
end $$;

select cron.schedule(
  'starling-sync',
  '*/15 * * * *',  -- every 15 minutes
  $cron$
    select net.http_get(
      url     := 'https://halisaha.klpir.com/api/cron/starling-sync',
      headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
    );
  $cron$
);

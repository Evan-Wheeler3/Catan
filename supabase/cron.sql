-- Run once per project (SQL editor) after deploying functions, to drive turn timers.
-- Replace <project-ref> and <cron-secret> (the same value as the CRON_SECRET function secret).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'tideholm-turn-timers',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/game-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<cron-secret>'),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule automation edge functions via pg_cron + pg_net.
-- Auth: both functions validate `Authorization: Bearer <CRON_SECRET>`. The secret lives in
-- Supabase Vault under the name 'cron_secret' (same value as the CRON_SECRET function secret)
-- and is read at job runtime — never stored in this file.
-- Prereq (one-time, per environment, done outside migrations):
--   1. npx supabase secrets set CRON_SECRET=<value>
--   2. select vault.create_secret('<value>', 'cron_secret');

create extension if not exists pg_net;

-- cron.schedule upserts by jobname, so re-running is safe.
select cron.schedule(
  'send-reminders',
  '*/30 * * * *',
  $cron$
  select net.http_post(
    url := 'https://qujteojdjxoqrjdpaljs.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);

select cron.schedule(
  'retention-alerts',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://qujteojdjxoqrjdpaljs.supabase.co/functions/v1/retention-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);

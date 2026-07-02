-- Daily coach digest email (check-ins waiting, at-risk clients, overdue payments).
-- Same auth pattern as 20260702120000: bearer read from Vault secret 'cron_secret' at runtime.

select cron.schedule(
  'coach-daily-digest',
  '0 7 * * *',
  $cron$
  select net.http_post(
    url := 'https://qujteojdjxoqrjdpaljs.supabase.co/functions/v1/coach-daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);

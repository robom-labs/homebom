-- 시간별 청약홈 수집을 놓쳤을 때 Vault 인증으로 한 번 더 재시도하는 독립 복구 작업이다.
do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'homebom-notices-refresh-watchdog';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end $$;

select cron.schedule(
  'homebom-notices-refresh-watchdog',
  '35,50 * * * *',
  $schedule$
  select net.http_post(
    url := 'https://neqjmxaneibobpedgsnl.supabase.co/functions/v1/notices?refresh=1',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-sync-token', coalesce((
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'homebom_notice_sync_token'
        limit 1
      ), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where not exists (
    select 1
    from public.notice_public_snapshots
    where feed_key = 'active'
      and verified_at >= now() - interval '75 minutes'
  );
  $schedule$
);

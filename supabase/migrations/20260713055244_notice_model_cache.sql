-- 청약홈 일반공급 주택형을 사용자 요청마다 반복 수집하지 않도록 서버 전용 캐시를 만든다.
create table if not exists public.notice_model_cache (
  notice_key text primary key,
  models jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null,
  retry_after timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.notice_model_cache enable row level security;

comment on table public.notice_model_cache is 'service role only official ApplyHome model cache';

create index if not exists notice_model_cache_retry_after_idx
  on public.notice_model_cache (retry_after);

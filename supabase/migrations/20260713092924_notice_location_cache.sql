-- 공고 주소의 서버측 지오코딩 결과와 실패 상태를 반복 호출 없이 보존한다.
create table if not exists public.notice_location_cache (
  notice_key text primary key,
  raw_address text not null,
  normalized_address text,
  query_used text,
  latitude double precision,
  longitude double precision,
  status text not null check (status in ('matched', 'not-found', 'not-configured')),
  provider text,
  fetched_at timestamptz not null,
  retry_after timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.notice_location_cache enable row level security;

comment on table public.notice_location_cache is 'service role only notice geocode cache';

create index if not exists notice_location_cache_retry_after_idx
  on public.notice_location_cache (retry_after);

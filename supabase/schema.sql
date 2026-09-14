-- Supabase SQL Editor에서 한 번 실행하세요.
-- 'live' 네임스페이스(실제 조회 기록)와 'fixture' 네임스페이스(합성 시험 상태)를
-- 하나의 테이블에 행 두 개로 저장합니다. 서버 라우트(service role key)만 이 테이블을
-- 읽고 씁니다. RLS를 켜고 공개 정책은 하나도 만들지 않으므로,
-- anon/public 키로는 아무것도 읽거나 쓸 수 없습니다.

create table if not exists public.t04_state (
  namespace text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.t04_state enable row level security;
-- 의도적으로 정책을 추가하지 않습니다: service role key만 통과합니다.

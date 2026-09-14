# T04 오늘의 진짜 정보판 — 서울 기온

과제4 "오늘의 진짜 정보판 — 데이터가 안 올 때" 구현체입니다.

- **실제 값**: 서울 기온 (Open-Meteo `current_weather` API, 비밀키 불필요, HTTPS)
- **DB**: Supabase (Postgres, `t04_state` 테이블 하나에 실제 기록과 합성 시험 상태를 namespace로 분리 저장)
- **배포**: Vercel (Next.js App Router)

## 1. 로컬 준비

```bash
npm install
cp .env.example .env.local
```

`.env.local`에 Supabase 값을 채워 넣으세요 (아래 2번 참고). 이 파일은 `.gitignore`에 있어서 Git에 올라가지 않습니다.

```bash
npm run dev
```

## 2. Supabase 프로젝트 만들기

1. https://supabase.com 에서 새 프로젝트 생성 (무료 플랜, 신용카드 불필요).
2. 프로젝트의 **SQL Editor**를 열고 `supabase/schema.sql` 내용을 그대로 실행 — `t04_state` 테이블이 생기고 RLS가 켜집니다 (공개 정책은 만들지 않으므로 service role key로만 접근 가능).
3. **Project Settings → API**에서 `Project URL`과 `service_role` 키(⚠️ `anon` 키 아님)를 복사.
4. 로컬은 `.env.local`, 배포는 Vercel 프로젝트의 **Settings → Environment Variables**에 다음 두 값만 넣습니다.
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY`는 `app/api/*/route.ts` (서버 라우트 핸들러)에서만 쓰이고, 브라우저로 내려가는 코드에는 절대 등장하지 않습니다. 브라우저는 `/api/live/*`, `/api/fixture/*` 같은 우리 서버 엔드포인트만 호출합니다.

## 3. Vercel 배포

1. 이 저장소를 GitHub에 올린다 (`git init && git add . && git commit -m "T04"` → GitHub에 새 저장소 만들고 push).
2. Vercel에서 "New Project" → 방금 만든 GitHub 저장소 선택 → 프레임워크 자동 인식(Next.js).
3. Environment Variables에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 추가 → Deploy.
4. 배포된 URL을 **새 시크릿 창**으로 열어서 로그인/인증 없이 잘 열리는지 확인 (C01, C02, C29~C33).

## 4. 실제 이틀 기록 남기기 (C22~C24)

배포 후 사이트에서 "지금 다시 조회" 버튼을 눌러 **오늘 실제로** 한 번 조회하세요. 그리고 **다른 실제 날짜(자정 KST 이후)**에 같은 사이트에서 다시 "지금 다시 조회"를 누르세요. 그러면 일별 기록 표에 서로 다른 날짜 행 2개가 쌓이고, 전일 대비 값이 자동으로 다시 계산되어 화면에 표시됩니다. 이 두 건이 과제가 요구하는 "서로 다른 실제 날짜의 기록 2건"입니다.

## 5. 합성 시험 패널 (C12~C19, C26)

메인 화면 아래쪽 "합성 시험 패널"은 과제 패키지에 들어있던 9개 결정론 fixture(`fixtures/*.json`, 원본 그대로 복사)를 그대로 재생합니다. 실제 서울 기온 기록과는 Supabase에서 완전히 다른 행(namespace `fixture`)에 저장되어 서로 섞이지 않습니다. 버튼을 누르면:

- 5가지 실패(느림·401·429·오프라인·형식 변경)를 각각 재생하고, 그때마다 상태가 `stale`로 바뀌면서 실패 종류(`error_code`)가 다르게 표시됩니다.
- 실패 중에도 마지막 정상값(105)과 기존 행이 지워지지 않고 "오래된 값" 표시만 붙습니다.
- "오류 후 회복 재생" 버튼은 timeout 이후 `T04-RECOVER-D2`를 재생해 `fresh/none`으로 돌아오고 다음 합성 날짜 신규 행이 정확히 1건 추가되는 것을 보여줍니다.

## 6. 비밀키 점검 (C11)

- 브라우저 쪽 코드(`app/page.tsx`, `components/*`)에는 Supabase 키가 전혀 등장하지 않습니다. 브라우저는 자체 API 라우트만 호출합니다.
- `.env.local`, `.env`는 `.gitignore`에 있어 커밋되지 않습니다. `git log`, GitHub 저장소, 브라우저 개발자 도구 Network 탭에서 실제 키 문자열을 검색해 0건인지 직접 확인하고 제출 전 스크린샷/확인 기록을 남기세요.

## 7. 코드 구조

```
lib/adapter.ts      정규화·저장·비교 로직 (과제 패키지 adapter-reset.example.js 포팅, live/fixture 공용)
lib/liveSource.ts   Open-Meteo 실제 조회 + 5종 오류 코드로 매핑
lib/fixtures.ts      9개 공식 fixture 재생 (fixtures/*.json 그대로 사용)
lib/store.ts         Supabase 읽기/쓰기 (namespace: 'live' | 'fixture')
app/api/live/*        실제 조회 상태 조회·갱신 API
app/api/fixture/*      합성 시험 상태 조회·재생·초기화 API
components/Board.tsx        실제 정보판 UI
components/FixturePanel.tsx  합성 시험 패널 UI
```

## 8. 아직 앱 코드가 아니라 "제출 절차"로 채워야 하는 항목

- **C27 짧은 확인 방법 4줄**, **C28 AI/본인 판단 3줄**: 제출 플랫폼 텍스트란에 직접 작성 (아래 `submission-template.md` 참고).
- **C34/C35 결과물·소스 URL 필드**: 배포된 Vercel URL과, GitHub 커밋 해시가 포함된 소스 URL(`https://github.com/<계정>/<repo>/tree/<40자리 commit sha>`)을 제출 폼에 입력.
- **C22~C24**: 위 4단계에서 남긴 서로 다른 두 실제 날짜의 기록이 근거가 됩니다.

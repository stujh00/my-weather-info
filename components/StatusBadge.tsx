'use client';

import type { ReadingStatus } from '@/lib/types';

const ERROR_LABEL: Record<string, string> = {
  none: '',
  timeout: '느린 응답(timeout)',
  auth: '인증 거절(401/403)',
  rate_limit: '호출 제한(429)',
  offline: '오프라인',
  schema_error: '응답 형식 변경'
};

export default function StatusBadge({ status }: { status: ReadingStatus | null }) {
  if (!status) {
    return <span className="badge stale">아직 조회 안 함</span>;
  }
  if (status.freshness === 'fresh') {
    return <span className="badge fresh">fresh · 정상</span>;
  }
  return (
    <span className="badge stale">
      stale · {ERROR_LABEL[status.error_code] ?? status.error_code}
    </span>
  );
}

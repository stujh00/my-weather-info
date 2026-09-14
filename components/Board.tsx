'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EvaluationState } from '@/lib/types';
import StatusBadge from './StatusBadge';

function fmt(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date(iso)) + ' (KST)';
  } catch {
    return iso;
  }
}

function comparisonText(state: EvaluationState): string {
  const c = state.last_comparison;
  if (c.state === 'insufficient') return '전일 기록이 아직 없어 비교할 수 없습니다.';
  if (c.state === 'unit_mismatch') return '단위가 달라 비교할 수 없습니다.';
  if (c.direction === 'unchanged') return `전일과 동일 (변화 0${c.unit ?? ''})`;
  const arrow = c.direction === 'increase' ? '▲' : '▼';
  return `전일 대비 ${arrow} ${c.magnitude}${c.unit ?? ''}`;
}

export default function Board() {
  const [state, setState] = useState<EvaluationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/live/state');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setState(json.state);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/live/refresh', { method: 'POST' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setState(json.state);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!state) {
    return (
      <section className="panel">
        <div className="panel-title">
          <h2>오늘의 서울 기온</h2>
        </div>
        {error ? <div className="error-note">{error}</div> : <p className="hint">불러오는 중…</p>}
      </section>
    );
  }

  const reading = state.current_reading;
  const isStale = state.status?.freshness === 'stale';
  // stale일 때도 current_reading(=마지막 정상값)은 지우지 않고 그대로 보여줍니다.
  const displayRow = state.daily_readings[state.daily_readings.length - 1];

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>오늘의 서울 기온</h2>
        <StatusBadge status={state.status} />
      </div>

      {reading ? (
        <>
          <div className="value-row">
            <span className="value">{reading.normalized_value}</span>
            <span className="unit">{reading.unit}</span>
            {isStale && <span className="badge old-value">오래된 값(마지막 정상값)</span>}
          </div>
          <dl className="meta-grid">
            <div>
              <dt>출처</dt>
              <dd>
                <a href={reading.source_url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                  {reading.source_name}
                </a>
              </dd>
            </div>
            <div>
              <dt>기준 시간대</dt>
              <dd>{reading.record_timezone}</dd>
            </div>
            <div>
              <dt>출처 시각 (관측 시각)</dt>
              <dd>{fmt(reading.source_time)}</dd>
            </div>
            <div>
              <dt>조회 시각</dt>
              <dd>{fmt(reading.fetched_at)}</dd>
            </div>
          </dl>
          <p className="hint">{comparisonText(state)}</p>
        </>
      ) : (
        <p className="hint">아직 조회한 값이 없습니다. 아래 버튼으로 첫 조회를 실행하세요.</p>
      )}

      {isStale && (
        <div className="error-note">
          지금 조회가 실패해서({state.status?.error_code}) 위 값은 마지막으로 성공했던 값을 그대로 보여주고 있어요.
          값을 지우지 않고 &quot;오래된 값&quot; 표시만 붙입니다. 아래 버튼으로 다시 시도할 수 있어요.
        </div>
      )}

      <button onClick={refresh} disabled={loading}>
        {loading ? '조회 중…' : '지금 다시 조회'}
      </button>

      {error && <div className="error-note" style={{ marginTop: 14 }}>{error}</div>}

      <h3 style={{ marginTop: 24, fontSize: '0.95rem' }}>일별 기록 (Asia/Seoul 날짜 기준, 하루 1건)</h3>
      {state.daily_readings.length === 0 ? (
        <p className="hint">아직 저장된 일별 기록이 없습니다.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>값</th>
              <th>출처 URL</th>
              <th>처음 저장</th>
              <th>마지막 갱신</th>
            </tr>
          </thead>
          <tbody>
            {state.daily_readings.map((row) => (
              <tr key={row.record_id}>
                <td>{row.record_date}</td>
                <td>
                  {row.normalized_value} {row.unit}
                </td>
                <td style={{ maxWidth: 260, wordBreak: 'break-all' }}>
                  <a href={row.reading.source_url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                    {row.reading.source_url}
                  </a>
                </td>
                <td>{fmt(row.first_fetched_at)}</td>
                <td>{fmt(row.last_fetched_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint">
        같은 날짜에 여러 번 조회해도 행이 하나로 갱신되고, 자정(KST)이 지나 새로 조회하면 새 행이 추가됩니다.
        {displayRow ? ` 현재 저장된 일별 기록 ${state.daily_readings.length}건.` : ''}
      </p>
    </section>
  );
}

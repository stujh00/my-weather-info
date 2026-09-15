'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EvaluationState } from '@/lib/types';
import StatusBadge from './StatusBadge';

const SEQUENCES: { label: string; steps: string[]; hint: string }[] = [
  {
    label: '정상 흐름 재생 (D1-A → D1-B → D2)',
    steps: ['T04-NORMAL-D1-A', 'T04-NORMAL-D1-B', 'T04-NORMAL-D2'],
    hint: '같은 합성 날짜 두 번 조회는 한 행으로 합쳐지고, 다음 합성 날짜는 새 행 + 전일 대비 +15를 만듭니다.'
  },
  {
    label: '느린 응답(timeout) 재생',
    steps: ['T04-NORMAL-D1-A', 'T04-NORMAL-D1-B', 'T04-TIMEOUT'],
    hint: '마지막 정상값 105를 유지한 채 stale / timeout이 됩니다.'
  },
  {
    label: '인증 거절(401) 재생',
    steps: ['T04-NORMAL-D1-A', 'T04-NORMAL-D1-B', 'T04-AUTH-401'],
    hint: 'stale / auth. 이 401은 외부 데이터 원천의 거절이며, 이 앱의 로그인과 무관합니다.'
  },
  {
    label: '호출 제한(429) 재생',
    steps: ['T04-NORMAL-D1-A', 'T04-NORMAL-D1-B', 'T04-RATE-429'],
    hint: 'stale / rate_limit, Retry-After 60초.'
  },
  {
    label: '오프라인 재생',
    steps: ['T04-NORMAL-D1-A', 'T04-NORMAL-D1-B', 'T04-OFFLINE'],
    hint: 'stale / offline.'
  },
  {
    label: '응답 형식 변경 재생',
    steps: ['T04-NORMAL-D1-A', 'T04-NORMAL-D1-B', 'T04-SCHEMA-BREAK'],
    hint: 'normalized_value가 문자열로 와서 검증에 실패 → stale / schema_error.'
  },
  {
    label: '오류 후 회복 재생 (timeout → 재시도 성공)',
    steps: ['T04-NORMAL-D1-A', 'T04-NORMAL-D1-B', 'T04-TIMEOUT', 'T04-RECOVER-D2'],
    hint: 'stale / timeout 상태에서 T04-RECOVER-D2를 재생하면 fresh / none, 행 2건, 다음 합성 날짜 신규 행 정확히 1건이 됩니다.'
  }
];

export default function FixturePanel() {
  const [state, setState] = useState<EvaluationState | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/fixture/state');
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

  async function runOne(fixtureId: string): Promise<EvaluationState> {
    const res = await fetch('/api/fixture/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fixtureId })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    return json.state as EvaluationState;
  }

  async function reset(): Promise<EvaluationState> {
    const res = await fetch('/api/fixture/reset', { method: 'POST' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    return json.state as EvaluationState;
  }

  async function runSequence(label: string, steps: string[]) {
    setRunning(label);
    setError(null);
    try {
      await reset();
      let last: EvaluationState | null = null;
      for (const step of steps) {
        last = await runOne(step);
      }
      if (last) setState(last);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(null);
    }
  }

  async function doReset() {
    setRunning('reset');
    try {
      const s = await reset();
      setState(s);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>합성 시험 패널 (실제 데이터 아님)</h2>
        {state && <StatusBadge status={state.status} />}
      </div>
      <p className="hint" style={{ marginTop: -6, marginBottom: 16 }}>
        여기서 재생하는 값은 전부 과제 패키지의 결정론 fixture(합성 시험값)이며, 위 실제 서울 기온 기록과는
        완전히 분리된 상태에 저장됩니다. 실제 데이터를 절대 건드리지 않습니다.
      </p>

      <div className="fixture-grid">
        {SEQUENCES.map((seq) => (
          <button
            key={seq.label}
            className="secondary"
            disabled={running !== null}
            title={seq.hint}
            onClick={() => runSequence(seq.label, seq.steps)}
          >
            {running === seq.label ? '재생 중…' : seq.label}
          </button>
        ))}
      </div>

      <button className="danger" disabled={running !== null} onClick={doReset}>
        {running === 'reset' ? '초기화 중…' : '합성 상태만 초기화'}
      </button>

      {error && <div className="error-note" style={{ marginTop: 14 }}>{error}</div>}

      {state && (
        <div style={{ marginTop: 20 }}>
          <dl className="meta-grid">
            <div>
              <dt>마지막 재생</dt>
              <dd>{state.last_run?.fixture_id ?? '—'}</dd>
            </div>
            <div>
              <dt>오류 코드</dt>
              <dd>{state.last_run?.error_code ?? '—'}</dd>
            </div>
            <div>
              <dt>저장된 값(마지막 정상값 포함)</dt>
              <dd>
                {state.current_reading ? `${state.current_reading.normalized_value} ${state.current_reading.unit}` : '—'}
                {state.status?.freshness === 'stale' && (
                  <span className="badge old-value">오래된 값(마지막 정상값)</span>
                )}
              </dd>
            </div>
            <div>
              <dt>일별 행 수</dt>
              <dd>{state.daily_readings.length}</dd>
            </div>
          </dl>

          {state.daily_readings.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>합성 날짜</th>
                  <th>값</th>
                  <th>record_id</th>
                </tr>
              </thead>
              <tbody>
                {state.daily_readings.map((row) => (
                  <tr key={row.record_id}>
                    <td>{row.record_date}</td>
                    <td>
                      {row.normalized_value} {row.unit}
                    </td>
                    <td>{row.record_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

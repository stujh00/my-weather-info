// 과제 패키지에서 그대로 복사한 9개 결정론 fixture(fixtures/*.json)를 읽어서
// 같은 applySuccessfulReading / applyError 경로로 재생합니다.
// 이 상태는 'fixture' 네임스페이스에만 쓰이며 실제 라이브 기록과 절대 섞이지 않습니다.

import authFixture from '../fixtures/auth-401.json';
import normalD1A from '../fixtures/normal-d1-a.json';
import normalD1B from '../fixtures/normal-d1-b.json';
import normalD2 from '../fixtures/normal-d2.json';
import offlineFixture from '../fixtures/offline.json';
import rateFixture from '../fixtures/rate-429.json';
import recoverD2 from '../fixtures/recover-d2.json';
import schemaBreakFixture from '../fixtures/schema-break.json';
import timeoutFixture from '../fixtures/timeout.json';

import { applyError, applySuccessfulReading } from './adapter';
import type { ErrorCode, EvaluationState, NormalizedReading } from './types';

export interface ReplayFixture {
  fixture_id: string;
  contract_version: string;
  description_ko: string;
  virtual_now: string;
  transport: {
    mode: 'http' | 'timeout' | 'offline';
    status: number | null;
    delay_ms: number;
    deadline_ms: number;
    headers: Record<string, string>;
  };
  payload: (NormalizedReading & Record<string, unknown>) | { message: string } | null;
  expected: Record<string, unknown>;
}

export const FIXTURES: Record<string, ReplayFixture> = {
  'T04-NORMAL-D1-A': normalD1A as ReplayFixture,
  'T04-NORMAL-D1-B': normalD1B as ReplayFixture,
  'T04-NORMAL-D2': normalD2 as ReplayFixture,
  'T04-TIMEOUT': timeoutFixture as ReplayFixture,
  'T04-AUTH-401': authFixture as ReplayFixture,
  'T04-RATE-429': rateFixture as ReplayFixture,
  'T04-OFFLINE': offlineFixture as ReplayFixture,
  'T04-SCHEMA-BREAK': schemaBreakFixture as ReplayFixture,
  'T04-RECOVER-D2': recoverD2 as ReplayFixture
};

export const FIXTURE_IDS = Object.keys(FIXTURES);

export function runFixture(inputState: EvaluationState, fixtureId: string): EvaluationState {
  const fixture = FIXTURES[fixtureId];
  if (!fixture) {
    throw new Error(`unknown fixture_id: ${fixtureId}`);
  }

  const meta = {
    fixture_id: fixture.fixture_id,
    virtual_now: fixture.virtual_now,
    retry_after_seconds: fixture.transport.headers['retry-after']
      ? Number(fixture.transport.headers['retry-after'])
      : null
  };

  if (fixture.transport.mode === 'timeout') return applyError(inputState, 'timeout', meta);
  if (fixture.transport.mode === 'offline') return applyError(inputState, 'offline', meta);
  if (fixture.transport.status === 401 || fixture.transport.status === 403) {
    return applyError(inputState, 'auth' as ErrorCode, meta);
  }
  if (fixture.transport.status === 429) return applyError(inputState, 'rate_limit', meta);
  if (fixture.transport.status !== null && fixture.transport.status >= 200 && fixture.transport.status < 300) {
    try {
      return applySuccessfulReading(inputState, fixture.payload as NormalizedReading, meta, 'demo');
    } catch {
      return applyError(inputState, 'schema_error', meta);
    }
  }
  return applyError(inputState, 'schema_error', meta);
}

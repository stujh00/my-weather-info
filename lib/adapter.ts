// 과제 패키지의 adapter-reset.example.js 를 TypeScript로 옮긴 버전입니다.
// live adapter(app/api/live)와 replay adapter(app/api/fixture)가 이 파일의
// applySuccessfulReading / applyError / comparisonFor 를 똑같이 호출하도록 해서
// "정상 경로는 같이 쓰고 오류 처리만 따로 꾸미는" 실수를 피합니다.

import type {
  Comparison,
  DailyRow,
  ErrorCode,
  EvaluationState,
  NormalizedReading,
  ReadingStatus
} from './types';

export const NORMALIZED_KEYS = [
  'signal_id',
  'normalized_value',
  'unit',
  'source_name',
  'source_url',
  'source_time',
  'fetched_at',
  'record_timezone',
  'record_date'
] as const;

export const ERROR_CODES: ErrorCode[] = ['timeout', 'auth', 'rate_limit', 'offline', 'schema_error'];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function kstDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('fetched_at must be a valid ISO-8601 date-time');
  }
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function validateNormalizedReading(reading: unknown): reading is NormalizedReading {
  if (!reading || typeof reading !== 'object' || Array.isArray(reading)) {
    throw new TypeError('normalized reading must be an object');
  }
  const r = reading as Record<string, unknown>;
  const actualKeys = Object.keys(r).sort();
  const expectedKeys = [...NORMALIZED_KEYS].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new TypeError(`normalized reading keys must be exactly: ${NORMALIZED_KEYS.join(', ')}`);
  }
  if (typeof r.signal_id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(r.signal_id) || r.signal_id.length > 100) {
    throw new TypeError('signal_id is invalid');
  }
  if (typeof r.normalized_value !== 'number' || !Number.isFinite(r.normalized_value)) {
    throw new TypeError('normalized_value must be a finite number');
  }
  for (const field of ['unit', 'source_name'] as const) {
    if (typeof r[field] !== 'string' || (r[field] as string).trim() === '') {
      throw new TypeError(`${field} must be a non-empty string`);
    }
  }
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(r.source_url as string);
  } catch {
    throw new TypeError('source_url must be an absolute URL');
  }
  if (sourceUrl.protocol !== 'https:') {
    throw new TypeError('source_url must use HTTPS');
  }
  if (r.source_time !== null && Number.isNaN(new Date(r.source_time as string).getTime())) {
    throw new TypeError('source_time must be a valid date-time or null');
  }
  if (Number.isNaN(new Date(r.fetched_at as string).getTime())) {
    throw new TypeError('fetched_at must be a valid date-time');
  }
  if (r.record_timezone !== 'Asia/Seoul') {
    throw new TypeError('record_timezone must be Asia/Seoul');
  }
  if (
    typeof r.record_date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(r.record_date) ||
    r.record_date !== kstDate(r.fetched_at as string)
  ) {
    throw new TypeError('record_date must be the Asia/Seoul date derived from fetched_at');
  }
  return true;
}

export function validateStatus(status: ReadingStatus | null): boolean {
  if (!status || typeof status !== 'object') return false;
  if (status.freshness === 'fresh') return status.error_code === 'none';
  if (status.freshness === 'stale') return ERROR_CODES.includes(status.error_code);
  return false;
}

export function resetEvaluationState(): EvaluationState {
  return {
    schema_version: 'aleph-t04-evaluation-state-v1',
    daily_readings: [],
    current_reading: null,
    status: null,
    last_delta: null,
    last_comparison: { state: 'insufficient', direction: null, magnitude: null, unit: null },
    last_run: null,
    sequence: 0
  };
}

function recordIdFor(reading: NormalizedReading, prefix: string): string {
  return `${prefix}-${reading.signal_id}-${reading.record_date}`;
}

function comparisonFor(rows: DailyRow[], current: DailyRow): Comparison {
  const previous = rows
    .filter((row) => row.signal_id === current.signal_id && row.record_date < current.record_date)
    .sort((left, right) => right.record_date.localeCompare(left.record_date))[0];
  if (!previous) {
    return { state: 'insufficient', direction: null, magnitude: null, unit: null };
  }
  if (previous.unit !== current.unit) {
    return { state: 'unit_mismatch', direction: null, magnitude: null, unit: null };
  }
  const signed = current.normalized_value - previous.normalized_value;
  // 부동소수점 뺄셈 오차(예: 17.8 - 17.2 = 0.6000000000000014)를 없애기 위해
  // 소수점 둘째 자리까지 반올림합니다.
  const rounded = Math.round(Math.abs(signed) * 100) / 100;
  return {
    state: 'comparable',
    direction: signed > 0 ? 'increase' : signed < 0 ? 'decrease' : 'unchanged',
    magnitude: rounded,
    unit: current.unit
  };
}

export function applySuccessfulReading(
  inputState: EvaluationState,
  reading: NormalizedReading,
  runMeta: { fixture_id?: string | null; virtual_now?: string | null } = {},
  idPrefix = 'row'
): EvaluationState {
  validateNormalizedReading(reading);
  const state = clone(inputState);
  const existingIndex = state.daily_readings.findIndex(
    (row) => row.signal_id === reading.signal_id && row.record_date === reading.record_date
  );
  const existing = existingIndex >= 0 ? state.daily_readings[existingIndex] : null;
  const row: DailyRow = {
    record_id: existing ? existing.record_id : recordIdFor(reading, idPrefix),
    signal_id: reading.signal_id,
    record_date: reading.record_date,
    normalized_value: reading.normalized_value,
    unit: reading.unit,
    first_fetched_at: existing ? existing.first_fetched_at : reading.fetched_at,
    last_fetched_at: reading.fetched_at,
    reading: clone(reading)
  };

  if (existingIndex >= 0) state.daily_readings[existingIndex] = row;
  else state.daily_readings.push(row);
  state.daily_readings.sort((left, right) => left.record_date.localeCompare(right.record_date));

  state.current_reading = clone(reading);
  state.status = { freshness: 'fresh', error_code: 'none' };
  state.last_comparison = comparisonFor(state.daily_readings, row);
  state.last_delta = state.last_comparison.magnitude;
  state.sequence += 1;
  state.last_run = {
    fixture_id: runMeta.fixture_id ?? null,
    virtual_now: runMeta.virtual_now ?? reading.fetched_at,
    outcome: 'success',
    error_code: 'none',
    retry_after_seconds: null
  };
  return state;
}

export function applyError(
  inputState: EvaluationState,
  errorCode: ErrorCode,
  runMeta: { fixture_id?: string | null; virtual_now?: string | null; retry_after_seconds?: number | null } = {}
): EvaluationState {
  if (!ERROR_CODES.includes(errorCode)) {
    throw new TypeError(`unsupported error code: ${errorCode}`);
  }
  const state = clone(inputState);
  state.status = { freshness: 'stale', error_code: errorCode };
  state.sequence += 1;
  state.last_run = {
    fixture_id: runMeta.fixture_id ?? null,
    virtual_now: runMeta.virtual_now ?? null,
    outcome: 'error',
    error_code: errorCode,
    retry_after_seconds: runMeta.retry_after_seconds ?? null
  };
  return state;
}

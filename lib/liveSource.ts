// 비개인 공개 원천: Open-Meteo 현재 기온(서울), 비밀키 불필요, HTTPS.
// https://open-meteo.com/en/docs (무료, 인증 없음)

import { kstDate } from './adapter';
import type { ErrorCode, NormalizedReading } from './types';

const SEOUL_LAT = 37.5665;
const SEOUL_LON = 126.978;
const SOURCE_NAME = 'Open-Meteo (기상 예보 API)';
const SIGNAL_ID = 'seoul-temp-c';
const DEADLINE_MS = 8000;

export class LiveFetchError extends Error {
  error_code: ErrorCode;
  constructor(error_code: ErrorCode, message: string) {
    super(message);
    this.error_code = error_code;
    this.name = 'LiveFetchError';
  }
}

function buildSourceUrl(): string {
  const params = new URLSearchParams({
    latitude: String(SEOUL_LAT),
    longitude: String(SEOUL_LON),
    current: 'temperature_2m',
    timezone: 'UTC'
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/**
 * 실제 공개 원천을 조회해서 normalized-reading.schema.json 형태로 정규화합니다.
 * 실패하면 항상 LiveFetchError(정해진 5종 error_code 중 하나)를 던집니다.
 */
export async function fetchLiveReading(): Promise<NormalizedReading> {
  const url = buildSourceUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEADLINE_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new LiveFetchError('timeout', `제한 시간(${DEADLINE_MS}ms) 안에 응답이 오지 않았습니다.`);
    }
    // DNS 실패, 연결 거부 등 네트워크 계층 실패는 offline으로 취급합니다.
    throw new LiveFetchError('offline', `네트워크 요청이 실패했습니다: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new LiveFetchError('auth', `외부 원천이 인증을 거절했습니다 (status ${response.status}).`);
  }
  if (response.status === 429) {
    throw new LiveFetchError('rate_limit', '외부 원천 호출 제한에 걸렸습니다 (status 429).');
  }
  if (!response.ok) {
    throw new LiveFetchError('schema_error', `외부 원천이 예상치 못한 상태 코드를 반환했습니다 (${response.status}).`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LiveFetchError('schema_error', '응답 본문이 JSON이 아닙니다.');
  }

  const current = (body as Record<string, unknown>)?.current as Record<string, unknown> | undefined;
  const temperature = current?.temperature_2m;
  const observedTime = current?.time;

  if (typeof temperature !== 'number' || typeof observedTime !== 'string') {
    throw new LiveFetchError('schema_error', '응답에 temperature_2m 또는 time 필드가 없거나 형식이 바뀌었습니다.');
  }

  const fetchedAt = new Date().toISOString();
  // timezone=UTC로 요청했으므로 open-meteo의 "current.time"은 오프셋 없는 UTC 지역시간 문자열입니다.
  const sourceTimeIso = `${observedTime}:00Z`;
  if (Number.isNaN(new Date(sourceTimeIso).getTime())) {
    throw new LiveFetchError('schema_error', `source_time을 파싱할 수 없습니다: ${observedTime}`);
  }

  const reading: NormalizedReading = {
    signal_id: SIGNAL_ID,
    normalized_value: temperature,
    unit: '°C',
    source_name: SOURCE_NAME,
    source_url: url,
    source_time: sourceTimeIso,
    fetched_at: fetchedAt,
    record_timezone: 'Asia/Seoul',
    record_date: kstDate(fetchedAt)
  };

  return reading;
}

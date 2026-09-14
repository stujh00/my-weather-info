// normalized-reading.schema.json 과 reading-status.schema.json 을 그대로 반영한 타입.

export type ErrorCode = 'none' | 'timeout' | 'auth' | 'rate_limit' | 'offline' | 'schema_error';

export interface NormalizedReading {
  signal_id: string;
  normalized_value: number;
  unit: string;
  source_name: string;
  source_url: string;
  source_time: string | null;
  fetched_at: string;
  record_timezone: 'Asia/Seoul';
  record_date: string; // YYYY-MM-DD (Asia/Seoul)
}

export interface ReadingStatus {
  freshness: 'fresh' | 'stale';
  error_code: ErrorCode;
}

export interface DailyRow {
  record_id: string;
  signal_id: string;
  record_date: string;
  normalized_value: number;
  unit: string;
  first_fetched_at: string;
  last_fetched_at: string;
  reading: NormalizedReading;
}

export interface Comparison {
  state: 'insufficient' | 'unit_mismatch' | 'comparable';
  direction: 'increase' | 'decrease' | 'unchanged' | null;
  magnitude: number | null;
  unit: string | null;
}

export interface LastRun {
  fixture_id: string | null;
  virtual_now: string | null;
  outcome: 'success' | 'error';
  error_code: ErrorCode;
  retry_after_seconds: number | null;
}

export interface EvaluationState {
  schema_version: string;
  daily_readings: DailyRow[];
  current_reading: NormalizedReading | null;
  status: ReadingStatus | null;
  last_delta: number | null;
  last_comparison: Comparison;
  last_run: LastRun | null;
  sequence: number;
}

export type StoreNamespace = 'live' | 'fixture';

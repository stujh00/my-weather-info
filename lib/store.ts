// Supabase Postgres에 EvaluationState(JSON)를 namespace('live' | 'fixture')별로 저장합니다.
// 이 파일은 app/api/* route handler에서만 import 하세요(서버 전용).
// SUPABASE_SERVICE_ROLE_KEY는 브라우저로 절대 내려가지 않는 서버 환경변수입니다.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { resetEvaluationState } from './adapter';
import type { EvaluationState, StoreNamespace } from './types';

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다. ' +
        '.env.example을 참고해 .env.local(로컬) 또는 Vercel 프로젝트 환경변수(배포)에 설정하세요.'
    );
  }
  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false }
    });
  }
  return cachedClient;
}

export async function readState(namespace: StoreNamespace): Promise<EvaluationState> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('t04_state')
    .select('data')
    .eq('namespace', namespace)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase read failed (${namespace}): ${error.message}`);
  }
  if (!data) {
    // 아직 이 네임스페이스에 대한 행이 없으면 빈 상태로 시작합니다.
    return resetEvaluationState();
  }
  return data.data as EvaluationState;
}

export async function writeState(namespace: StoreNamespace, state: EvaluationState): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('t04_state')
    .upsert(
      { namespace, data: state, updated_at: new Date().toISOString() },
      { onConflict: 'namespace' }
    );
  if (error) {
    throw new Error(`Supabase write failed (${namespace}): ${error.message}`);
  }
}

import { NextResponse } from 'next/server';
import { applyError, applySuccessfulReading } from '@/lib/adapter';
import { fetchLiveReading, LiveFetchError } from '@/lib/liveSource';
import { readState, writeState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const before = await readState('live');

    let after;
    try {
      const reading = await fetchLiveReading();
      after = applySuccessfulReading(before, reading, { fixture_id: null, virtual_now: reading.fetched_at }, 'live');
    } catch (err) {
      const errorCode = err instanceof LiveFetchError ? err.error_code : 'schema_error';
      after = applyError(before, errorCode, { fixture_id: null, virtual_now: new Date().toISOString() });
    }

    await writeState('live', after);
    return NextResponse.json({ ok: true, state: after });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

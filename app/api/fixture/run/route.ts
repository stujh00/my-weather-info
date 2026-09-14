import { NextRequest, NextResponse } from 'next/server';
import { FIXTURE_IDS, runFixture } from '@/lib/fixtures';
import { readState, writeState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const fixtureId = body?.fixtureId;
    if (typeof fixtureId !== 'string' || !FIXTURE_IDS.includes(fixtureId)) {
      return NextResponse.json(
        { ok: false, error: `fixtureId must be one of: ${FIXTURE_IDS.join(', ')}` },
        { status: 400 }
      );
    }

    const before = await readState('fixture');
    const after = runFixture(before, fixtureId);
    await writeState('fixture', after);
    return NextResponse.json({ ok: true, state: after });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

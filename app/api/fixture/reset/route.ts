import { NextResponse } from 'next/server';
import { resetEvaluationState } from '@/lib/adapter';
import { writeState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const fresh = resetEvaluationState();
    await writeState('fixture', fresh);
    return NextResponse.json({ ok: true, state: fresh });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

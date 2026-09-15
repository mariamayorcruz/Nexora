import { NextRequest, NextResponse } from 'next/server';
import { runLifecycleCampaigns } from '@/lib/lifecycle';
import { acquireJobLock, releaseJobLock } from '@/lib/job-lock';

export const dynamic = 'force-dynamic';

const LOCK_NAME = 'lifecycle-campaigns';

/**
 * Campañas diarias de reactivación, post-venta y cumpleaños.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const locked = await acquireJobLock(LOCK_NAME, 15 * 60 * 1000);
  if (!locked) {
    return NextResponse.json({ ok: true, skipped: 'already-running' });
  }

  try {
    const result = await runLifecycleCampaigns();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/lifecycle] error', error);
    return NextResponse.json({ error: 'Lifecycle run failed' }, { status: 500 });
  } finally {
    await releaseJobLock(LOCK_NAME);
  }
}

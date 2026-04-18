import { NextRequest, NextResponse } from 'next/server';
import { processSalesRecoveryFollowupBatch } from '@/lib/sales-recovery-followup';

export const dynamic = 'force-dynamic';

/**
 * Envía el primer correo de recuperación a LeadCapture marcados (cron o curl manual).
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) ? rawLimit : undefined;

  const result = await processSalesRecoveryFollowupBatch(
    limit != null ? { limit: Math.min(100, Math.max(1, limit)) } : undefined
  );
  return NextResponse.json({ ok: true, ...result });
}

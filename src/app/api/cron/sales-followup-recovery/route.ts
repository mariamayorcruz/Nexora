import { NextRequest, NextResponse } from 'next/server';
import { applyUnpaidLeadRecoveryFlags } from '@/lib/conversion-automation';

export const dynamic = 'force-dynamic';

/**
 * Marca capturas no pagadas como `needsSalesFollowup` tras el umbral de antigüedad.
 * Proteger con `Authorization: Bearer ${CRON_SECRET}` (p. ej. Vercel Cron).
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

  const result = await applyUnpaidLeadRecoveryFlags();
  return NextResponse.json({ ok: true, ...result });
}

import { NextRequest, NextResponse } from 'next/server';
import { cleanupIncompleteSignups } from '@/lib/cleanup-incomplete-signups';

export const dynamic = 'force-dynamic';

/**
 * Borra usuarios con suscripción incomplete abandonada (>24h, sin pago, sin stripeSubId).
 * `Authorization: Bearer ${CRON_SECRET}`. Opcional: `?maxAgeHours=24`
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

  const rawHours = Number(request.nextUrl.searchParams.get('maxAgeHours'));
  const maxAgeMs =
    Number.isFinite(rawHours) && rawHours > 0 ? rawHours * 60 * 60 * 1000 : undefined;

  const result = await cleanupIncompleteSignups(maxAgeMs != null ? { maxAgeMs } : undefined);
  return NextResponse.json({ ok: true, ...result });
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { DEFAULT_TEMPLATES, LIFECYCLE_KINDS, type LifecycleKind } from '@/lib/lifecycle';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function GET(request: NextRequest) {
  const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.lifecycleRule.findMany({ where: { userId } });
  const rules = LIFECYCLE_KINDS.map((kind) => {
    const found = existing.find((rule) => rule.kind === kind);
    return (
      found || {
        id: '',
        userId,
        kind,
        enabled: true,
        delayDays: kind === 'post_purchase' ? 7 : 3,
        intervalDays: kind === 'birthday' ? 0 : 30,
        maxSends: kind === 'birthday' ? 1 : 6,
        template: DEFAULT_TEMPLATES[kind],
        discountPercent: kind === 'birthday' ? 15 : 0,
        couponValidDays: 7,
        sendHour: 10,
      }
    );
  });

  return NextResponse.json({ rules });
}

export async function PUT(request: NextRequest) {
  const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    kind?: string;
    enabled?: boolean;
    delayDays?: number;
    intervalDays?: number;
    maxSends?: number;
    template?: string;
    discountPercent?: number;
    couponValidDays?: number;
    sendHour?: number;
  };

  const kind = String(body.kind || '') as LifecycleKind;
  if (!LIFECYCLE_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Tipo de campaña no válido.' }, { status: 400 });
  }

  const data = {
    enabled: body.enabled !== false,
    delayDays: clampInt(body.delayDays, 0, 365, 3),
    intervalDays: clampInt(body.intervalDays, 0, 365, 30),
    maxSends: clampInt(body.maxSends, 0, 100, 6),
    template: String(body.template || DEFAULT_TEMPLATES[kind]).slice(0, 2000),
    discountPercent: clampInt(body.discountPercent, 0, 90, kind === 'birthday' ? 15 : 0),
    couponValidDays: clampInt(body.couponValidDays, 1, 90, 7),
    sendHour: clampInt(body.sendHour, 0, 23, 10),
  };

  const rule = await prisma.lifecycleRule.upsert({
    where: { userId_kind: { userId, kind } },
    update: data,
    create: { userId, kind, ...data },
  });

  await recordAudit({
    userId,
    action: 'lifecycle-rule.save',
    entity: 'lifecycle_rule',
    entityId: rule.id,
    headers: request.headers,
    meta: { kind },
  });

  return NextResponse.json({ rule });
}

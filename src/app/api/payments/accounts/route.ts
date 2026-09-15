import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { encryptSecret, maskSecret } from '@/lib/crypto';
import { SUPPORTED_SELLER_PROVIDERS } from '@/lib/payments';
import { getCountryConfig } from '@/lib/countries';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const CREDENTIAL_FIELDS = ['apiKey', 'secretKey', 'accessToken'] as const;

function isMasked(value: string): boolean {
  return value.trim().startsWith('•');
}

function publicAccount(account: {
  id: string;
  provider: string;
  currency: string;
  country: string;
  connected: boolean;
  isDefault: boolean;
  credentials: unknown;
  updatedAt: Date;
}) {
  const source = (account.credentials && typeof account.credentials === 'object'
    ? account.credentials
    : {}) as Record<string, unknown>;
  const masked: Record<string, string | null> = {};
  for (const field of CREDENTIAL_FIELDS) {
    const value = source[field];
    if (typeof value === 'string' && value) masked[field] = maskSecret(value);
  }
  return {
    id: account.id,
    provider: account.provider,
    currency: account.currency,
    country: account.country,
    connected: account.connected,
    isDefault: account.isDefault,
    credentials: masked,
    updatedAt: account.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accounts = await prisma.paymentAccount.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  return NextResponse.json({
    accounts: accounts.map(publicAccount),
    supportedProviders: SUPPORTED_SELLER_PROVIDERS,
  });
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    provider?: string;
    country?: string;
    apiKey?: string;
    secretKey?: string;
    accessToken?: string;
    isDefault?: boolean;
  };

  const provider = String(body.provider || '').toLowerCase();
  if (!SUPPORTED_SELLER_PROVIDERS.includes(provider as (typeof SUPPORTED_SELLER_PROVIDERS)[number])) {
    return NextResponse.json({ error: 'Proveedor de cobro no soportado.' }, { status: 400 });
  }

  const country = getCountryConfig(body.country);
  const existing = await prisma.paymentAccount.findFirst({ where: { userId, provider } });
  const previous = (existing?.credentials && typeof existing.credentials === 'object'
    ? existing.credentials
    : {}) as Record<string, unknown>;

  const credentials: Record<string, string> = {};
  for (const field of CREDENTIAL_FIELDS) {
    const incoming = body[field];
    if (typeof incoming === 'string' && incoming.trim() && !isMasked(incoming)) {
      credentials[field] = encryptSecret(incoming.trim()) || incoming.trim();
    } else if (typeof previous[field] === 'string') {
      credentials[field] = previous[field] as string;
    }
  }

  const hasCredentials =
    provider === 'flow' ? Boolean(credentials.apiKey && credentials.secretKey) : Boolean(credentials.accessToken);
  if (!hasCredentials) {
    return NextResponse.json({ error: 'Faltan las credenciales del proveedor.' }, { status: 400 });
  }

  if (body.isDefault) {
    await prisma.paymentAccount.updateMany({ where: { userId }, data: { isDefault: false } });
  }

  const account = await prisma.paymentAccount.upsert({
    where: { userId_provider: { userId, provider } },
    update: {
      credentials: credentials as never,
      currency: country.currency,
      country: country.code,
      connected: true,
      isDefault: body.isDefault ?? existing?.isDefault ?? true,
    },
    create: {
      userId,
      provider,
      credentials: credentials as never,
      currency: country.currency,
      country: country.code,
      connected: true,
      isDefault: body.isDefault ?? true,
    },
  });

  await recordAudit({
    userId,
    action: 'payment-account.save',
    entity: 'payment_account',
    entityId: account.id,
    headers: request.headers,
    meta: { provider },
  });

  return NextResponse.json({ account: publicAccount(account) });
}

export async function DELETE(request: NextRequest) {
  const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const provider = request.nextUrl.searchParams.get('provider') || '';
  const deleted = await prisma.paymentAccount.deleteMany({ where: { userId, provider } });
  if (!deleted.count) return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 });

  await recordAudit({ userId, action: 'payment-account.delete', headers: request.headers, meta: { provider } });
  return NextResponse.json({ ok: true });
}

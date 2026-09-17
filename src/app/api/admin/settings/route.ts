import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'main';

const SECRET_FIELDS = [
  'metaAppSecret',
  'anthropicApiKey',
  'openRouterApiKey',
  'geminiApiKey',
] as const;

type PlatformConfigRecord = Record<string, unknown>;

function isNonEmptySecret(value: unknown): boolean {
  const normalized = String(value ?? '').trim();
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  const blocked = ['placeholder', 'your-', 'tu-', 'changeme', 'example'];
  return !blocked.some((token) => lower.includes(token));
}

function secretConfigured(storedValue: unknown, envValues: Array<string | undefined>): boolean {
  if (isNonEmptySecret(storedValue)) return true;
  return envValues.some((value) => isNonEmptySecret(value));
}

function buildSafeSettings(stored: PlatformConfigRecord) {
  return {
    maintenanceMode: (stored.maintenanceMode as boolean) ?? process.env.MAINTENANCE_MODE === 'true',
    allowNewRegistrations:
      (stored.allowNewRegistrations as boolean) ?? process.env.ALLOW_NEW_REGISTRATIONS !== 'false',
    defaultSubscriptionPrice:
      (stored.defaultSubscriptionPrice as number) ?? parseFloat(process.env.DEFAULT_SUBSCRIPTION_PRICE || '30'),
    supportEmail: (stored.supportEmail as string) ?? process.env.SUPPORT_EMAIL ?? '',
    platformName: (stored.platformName as string) ?? process.env.PLATFORM_NAME ?? 'Nexora',
    platformDescription:
      (stored.platformDescription as string) ?? process.env.PLATFORM_DESCRIPTION ?? '',
    termsUrl: (stored.termsUrl as string) ?? process.env.TERMS_URL ?? '',
    privacyUrl: (stored.privacyUrl as string) ?? process.env.PRIVACY_URL ?? '',
    metaAppId: (stored.metaAppId as string) ?? process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID ?? '',
    // SEC-06: never return raw secrets — configured flags only
    metaAppSecretConfigured: secretConfigured(stored.metaAppSecret, [
      process.env.META_APP_SECRET,
      process.env.FACEBOOK_APP_SECRET,
    ]),
    anthropicApiKeyConfigured: secretConfigured(stored.anthropicApiKey, [process.env.ANTHROPIC_API_KEY]),
    openRouterApiKeyConfigured: secretConfigured(stored.openRouterApiKey, [process.env.OPENROUTER_API_KEY]),
    geminiApiKeyConfigured: secretConfigured(stored.geminiApiKey, [process.env.GEMINI_API_KEY]),
  };
}

function mergePlatformConfig(
  existing: PlatformConfigRecord,
  incoming: PlatformConfigRecord
): PlatformConfigRecord {
  const next: PlatformConfigRecord = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    if ((SECRET_FIELDS as readonly string[]).includes(key)) {
      continue;
    }
    next[key] = value;
  }

  for (const field of SECRET_FIELDS) {
    const candidate = incoming[field];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      next[field] = candidate.trim();
    } else if (!(field in next) && existing[field] !== undefined) {
      next[field] = existing[field];
    }
    // blank / omitted → keep existing stored secret (do not wipe with '')
  }

  return next;
}

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const record = await prisma.adminWorkspaceConfig.findUnique({ where: { key: CONFIG_KEY } });
    const stored = (record?.platformConfig ?? {}) as PlatformConfigRecord;
    return NextResponse.json({ settings: buildSafeSettings(stored) });
  } catch (error) {
    console.error('Error fetching settings');
    return NextResponse.json({ error: 'Error fetching settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const body = await request.json();
    const incoming = (body?.settings ?? {}) as PlatformConfigRecord;

    if (!incoming.platformName) {
      return NextResponse.json({ error: 'Platform name is required' }, { status: 400 });
    }

    const price = Number(incoming.defaultSubscriptionPrice);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Subscription price must be positive' }, { status: 400 });
    }

    const record = await prisma.adminWorkspaceConfig.findUnique({ where: { key: CONFIG_KEY } });
    const existing = (record?.platformConfig ?? {}) as PlatformConfigRecord;
    const merged = mergePlatformConfig(existing, { ...incoming, defaultSubscriptionPrice: price });

    // Never persist client-only configured flags if echoed back
    delete merged.metaAppSecretConfigured;
    delete merged.anthropicApiKeyConfigured;
    delete merged.openRouterApiKeyConfigured;
    delete merged.geminiApiKeyConfigured;

    await prisma.adminWorkspaceConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { platformConfig: merged as Prisma.InputJsonValue },
      create: { key: CONFIG_KEY, platformConfig: merged as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      success: true,
      settings: buildSafeSettings(merged),
    });
  } catch (error) {
    console.error('Error updating settings');
    return NextResponse.json({ error: 'Error updating settings' }, { status: 500 });
  }
}

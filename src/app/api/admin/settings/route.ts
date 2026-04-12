import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'main';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const record = await prisma.adminWorkspaceConfig.findUnique({ where: { key: CONFIG_KEY } });
    const stored = (record?.platformConfig ?? {}) as Record<string, unknown>;

    const settings = {
      maintenanceMode: (stored.maintenanceMode as boolean) ?? process.env.MAINTENANCE_MODE === 'true',
      allowNewRegistrations: (stored.allowNewRegistrations as boolean) ?? process.env.ALLOW_NEW_REGISTRATIONS !== 'false',
      defaultSubscriptionPrice: (stored.defaultSubscriptionPrice as number) ?? parseFloat(process.env.DEFAULT_SUBSCRIPTION_PRICE || '30'),
      supportEmail: (stored.supportEmail as string) ?? process.env.SUPPORT_EMAIL ?? '',
      platformName: (stored.platformName as string) ?? process.env.PLATFORM_NAME ?? 'Nexora',
      platformDescription: (stored.platformDescription as string) ?? process.env.PLATFORM_DESCRIPTION ?? '',
      termsUrl: (stored.termsUrl as string) ?? process.env.TERMS_URL ?? '',
      privacyUrl: (stored.privacyUrl as string) ?? process.env.PRIVACY_URL ?? '',
      metaAppId: (stored.metaAppId as string) ?? process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID ?? '',
      metaAppSecret: (stored.metaAppSecret as string) ?? process.env.META_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET ?? '',
      anthropicApiKey: (stored.anthropicApiKey as string) ?? process.env.ANTHROPIC_API_KEY ?? '',
      openRouterApiKey: (stored.openRouterApiKey as string) ?? process.env.OPENROUTER_API_KEY ?? '',
      geminiApiKey: (stored.geminiApiKey as string) ?? process.env.GEMINI_API_KEY ?? '',
    };

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Error fetching settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { settings } = await request.json();

    if (!settings.platformName) {
      return NextResponse.json({ error: 'Platform name is required' }, { status: 400 });
    }

    if (settings.defaultSubscriptionPrice < 0) {
      return NextResponse.json({ error: 'Subscription price must be positive' }, { status: 400 });
    }

    await prisma.adminWorkspaceConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { platformConfig: settings },
      create: { key: CONFIG_KEY, platformConfig: settings },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Error updating settings' }, { status: 500 });
  }
}

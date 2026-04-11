import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  emailAutomationEnabled: true,
  whatsappEnabled: false,
  phoneEnabled: false,
  externalCrmEnabled: false,
  externalCrmName: '',
  autoFollowUpEnabled: true,
  defaultCadence: '48h',
};

function getUserIdFromRequest(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return null;
  }

  const decoded = verifyUserToken(token);
  return decoded?.userId || null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.crmWorkspaceSettings.findUnique({
      where: { userId },
    });

    return NextResponse.json({
      settings: settings || DEFAULT_SETTINGS,
    });
  } catch (error) {
    console.error('Error fetching CRM settings:', error);
    return NextResponse.json({ error: 'Error fetching CRM settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const settings = await prisma.crmWorkspaceSettings.upsert({
      where: { userId },
      update: {
        emailAutomationEnabled: Boolean(body.emailAutomationEnabled),
        whatsappEnabled: Boolean(body.whatsappEnabled),
        phoneEnabled: Boolean(body.phoneEnabled),
        externalCrmEnabled: Boolean(body.externalCrmEnabled),
        externalCrmName: body.externalCrmName?.trim() || null,
        autoFollowUpEnabled: Boolean(body.autoFollowUpEnabled),
        defaultCadence: body.defaultCadence?.trim() || '48h',
      },
      create: {
        userId,
        emailAutomationEnabled: body.emailAutomationEnabled !== false,
        whatsappEnabled: Boolean(body.whatsappEnabled),
        phoneEnabled: Boolean(body.phoneEnabled),
        externalCrmEnabled: Boolean(body.externalCrmEnabled),
        externalCrmName: body.externalCrmName?.trim() || null,
        autoFollowUpEnabled: body.autoFollowUpEnabled !== false,
        defaultCadence: body.defaultCadence?.trim() || '48h',
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error saving CRM settings:', error);
    return NextResponse.json({ error: 'Error saving CRM settings' }, { status: 500 });
  }
}

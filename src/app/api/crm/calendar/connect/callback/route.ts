import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseStoredCadence, serializeCadence, type SalesEngineConfig } from '@/lib/crm-sequences';
import { resolveAppBaseUrl } from '@/lib/app-base-url';

type OAuthState = {
  userId: string;
  nonce: string;
  ts: string;
};

function decodeState(stateValue: string | null): OAuthState | null {
  if (!stateValue) return null;

  try {
    const raw = Buffer.from(stateValue, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw) as Partial<OAuthState>;
    if (!parsed.userId || !parsed.nonce || !parsed.ts) return null;
    return parsed as OAuthState;
  } catch {
    return null;
  }
}


export async function GET(request: NextRequest) {
  const state = decodeState(request.nextUrl.searchParams.get('state'));
  const baseUrl = resolveAppBaseUrl(request);

  if (!state) {
    return NextResponse.redirect(`${baseUrl}/dashboard/crm?calendar=error`);
  }

  const error = request.nextUrl.searchParams.get('error');
  const code = request.nextUrl.searchParams.get('code');

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/dashboard/crm?calendar=error`);
  }

  try {
    const settings = await prisma.crmWorkspaceSettings.findUnique({ where: { userId: state.userId } });
    const parsed = parseStoredCadence(settings?.defaultCadence);

    const nextEngine: SalesEngineConfig = {
      ...parsed.salesEngine,
      calendar: {
        ...parsed.salesEngine.calendar,
        connected: true,
        provider: 'google',
      },
    };

    await prisma.crmWorkspaceSettings.upsert({
      where: { userId: state.userId },
      update: {
        defaultCadence: serializeCadence({
          cadence: parsed.cadence || '48h',
          salesEngine: nextEngine,
        }),
      },
      create: {
        userId: state.userId,
        emailAutomationEnabled: true,
        whatsappEnabled: false,
        phoneEnabled: false,
        externalCrmEnabled: false,
        autoFollowUpEnabled: true,
        defaultCadence: serializeCadence({
          cadence: parsed.cadence || '48h',
          salesEngine: nextEngine,
        }),
      },
    });

    return NextResponse.redirect(`${baseUrl}/dashboard/crm?calendar=connected`);
  } catch (dbError) {
    console.error('Calendar callback error:', dbError);
    return NextResponse.redirect(`${baseUrl}/dashboard/crm?calendar=error`);
  }
}

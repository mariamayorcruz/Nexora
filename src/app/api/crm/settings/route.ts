import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import {
  DEFAULT_SALES_ENGINE,
  parseStoredCadence,
  serializeCadence,
  type FollowUpTrigger,
  type SalesEngineConfig,
} from '@/lib/crm-sequences';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  emailAutomationEnabled: true,
  whatsappEnabled: false,
  phoneEnabled: false,
  externalCrmEnabled: false,
  externalCrmName: '',
  autoFollowUpEnabled: true,
  defaultCadence: '48h',
  salesEngine: DEFAULT_SALES_ENGINE,
};

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.crmWorkspaceSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return NextResponse.json({
        settings: DEFAULT_SETTINGS,
      });
    }

    const parsed = parseStoredCadence(settings.defaultCadence);

    return NextResponse.json({
      settings: {
        ...settings,
        defaultCadence: parsed.cadence,
        salesEngine: parsed.salesEngine,
      },
    });
  } catch (error) {
    console.error('Error fetching CRM settings:', error);
    return NextResponse.json({ error: 'Error fetching CRM settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const existing = await prisma.crmWorkspaceSettings.findUnique({ where: { userId } });
    const parsed = parseStoredCadence(existing?.defaultCadence || body.defaultCadence);
    const cadenceValue = String(body.defaultCadence || parsed.cadence || '48h').trim() || '48h';
    const nextSalesEngine: SalesEngineConfig = {
      ...parsed.salesEngine,
      ...(body.salesEngine || {}),
      calendar: {
        ...parsed.salesEngine.calendar,
        ...(body.salesEngine?.calendar || {}),
      },
      meetingLinks: {
        ...parsed.salesEngine.meetingLinks,
        ...(body.salesEngine?.meetingLinks || {}),
      },
      followUpTemplates: Array.isArray(body.salesEngine?.followUpTemplates)
        ? body.salesEngine.followUpTemplates.slice(0, 16).map((item: any, index: number) => ({
            id: String(item.id || `template-${index + 1}`),
            name: String(item.name || `Template ${index + 1}`),
            subject: String(item.subject || ''),
            body: String(item.body || ''),
            trigger:
              item.trigger === 'on_signup' || item.trigger === 'after_signup' || item.trigger === 'lead_followup'
                ? (item.trigger as FollowUpTrigger)
                : 'lead_followup',
            delayHours: Math.max(0, Number(item.delayHours) || 0),
            active: item.active !== false,
            attachments: Array.isArray(item.attachments)
              ? item.attachments.slice(0, 8).map((asset: any, assetIndex: number) => ({
                  id: String(asset.id || `asset-${index + 1}-${assetIndex + 1}`),
                  name: String(asset.name || 'Archivo adjunto'),
                  url: String(asset.url || '').trim(),
                })).filter((asset: { url: string }) => Boolean(asset.url))
              : [],
          }))
        : parsed.salesEngine.followUpTemplates,
      sentLogs: Array.isArray(body.salesEngine?.sentLogs)
        ? body.salesEngine.sentLogs.slice(0, 100).map((item: any, index: number) => ({
            id: String(item.id || `log-${index + 1}`),
            to: String(item.to || ''),
            subject: String(item.subject || ''),
            status: (item.status as 'sent' | 'failed' | 'pending_setup') || 'sent',
            sentAt: String(item.sentAt || new Date().toISOString()),
          }))
        : parsed.salesEngine.sentLogs,
      appointments: Array.isArray(body.salesEngine?.appointments)
        ? body.salesEngine.appointments.slice(0, 300).map((item: any, index: number) => ({
            id: String(item.id || `appt-${index + 1}`),
            title: String(item.title || 'Cita'),
            startsAt: String(item.startsAt || new Date().toISOString()),
            endsAt: String(item.endsAt || new Date(Date.now() + 30 * 60 * 1000).toISOString()),
            notes: item.notes ? String(item.notes) : undefined,
            provider:
              item.provider === 'google' || item.provider === 'outlook' || item.provider === 'calendly'
                ? item.provider
                : 'google',
            externalUrl: item.externalUrl ? String(item.externalUrl) : undefined,
          }))
        : parsed.salesEngine.appointments,
    };

    const settings = await prisma.crmWorkspaceSettings.upsert({
      where: { userId },
      update: {
        emailAutomationEnabled:
          body.emailAutomationEnabled === undefined
            ? existing?.emailAutomationEnabled ?? true
            : Boolean(body.emailAutomationEnabled),
        whatsappEnabled:
          body.whatsappEnabled === undefined
            ? existing?.whatsappEnabled ?? false
            : Boolean(body.whatsappEnabled),
        phoneEnabled:
          body.phoneEnabled === undefined
            ? existing?.phoneEnabled ?? false
            : Boolean(body.phoneEnabled),
        externalCrmEnabled:
          body.externalCrmEnabled === undefined
            ? existing?.externalCrmEnabled ?? false
            : Boolean(body.externalCrmEnabled),
        externalCrmName:
          body.externalCrmName === undefined
            ? existing?.externalCrmName ?? null
            : body.externalCrmName?.trim() || null,
        autoFollowUpEnabled:
          body.autoFollowUpEnabled === undefined
            ? existing?.autoFollowUpEnabled ?? true
            : Boolean(body.autoFollowUpEnabled),
        defaultCadence: serializeCadence({
          cadence: cadenceValue,
          salesEngine: nextSalesEngine,
        }),
      },
      create: {
        userId,
        emailAutomationEnabled: body.emailAutomationEnabled !== false,
        whatsappEnabled: Boolean(body.whatsappEnabled),
        phoneEnabled: Boolean(body.phoneEnabled),
        externalCrmEnabled: Boolean(body.externalCrmEnabled),
        externalCrmName: body.externalCrmName?.trim() || null,
        autoFollowUpEnabled: body.autoFollowUpEnabled !== false,
        defaultCadence: serializeCadence({
          cadence: cadenceValue,
          salesEngine: nextSalesEngine,
        }),
      },
    });

    return NextResponse.json({
      settings: {
        ...settings,
        defaultCadence: cadenceValue,
        salesEngine: nextSalesEngine,
      },
    });
  } catch (error) {
    console.error('Error saving CRM settings:', error);
    return NextResponse.json({ error: 'Error saving CRM settings' }, { status: 500 });
  }
}

import { randomUUID } from 'node:crypto';
import { resolveAppBaseUrlFromEnv } from '@/lib/app-base-url';
import { prisma } from '@/lib/prisma';
import { renderCrmTransactionalEmail } from '@/lib/email/template';
import { capitalizeLeadNameForEmail } from '@/lib/format-person-name';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/mailer';
import {
  DEFAULT_FOLLOWUP_TEMPLATES,
  DEFAULT_SALES_ENGINE,
  sanitizeSalesEngineCopy,
  type FollowUpTemplate,
  type SalesEngineConfig,
} from './crm-sales-engine-defaults';
import { isInternalOrTestEmail } from './access';

export type { FollowUpTrigger, FollowUpTemplate, SalesEngineConfig } from './crm-sales-engine-defaults';
export { DEFAULT_FOLLOWUP_TEMPLATES, DEFAULT_SALES_ENGINE } from './crm-sales-engine-defaults';

export function parseStoredCadence(raw: string | null | undefined) {
  const fallback = {
    cadence: '48h',
    salesEngine: DEFAULT_SALES_ENGINE,
  };

  const value = String(raw || '').trim();
  if (!value) return fallback;

  if (!value.startsWith('{')) {
    return { cadence: value, salesEngine: DEFAULT_SALES_ENGINE };
  }

  try {
    const parsed = JSON.parse(value) as {
      cadence?: string;
      salesEngine?: Partial<SalesEngineConfig>;
    };

    const rawTemplates = Array.isArray(parsed.salesEngine?.followUpTemplates)
      ? parsed.salesEngine?.followUpTemplates
      : [];

    const normalizedTemplates =
      rawTemplates.length > 0
        ? rawTemplates.slice(0, 16).map((item, index) => {
            const template = item as Partial<FollowUpTemplate>;
            return {
              id: String(template.id || `template-${index + 1}`),
              name: String(template.name || `Template ${index + 1}`),
              subject: sanitizeSalesEngineCopy(String(template.subject || '')),
              body: sanitizeSalesEngineCopy(String(template.body || '')),
              trigger:
                template.trigger === 'on_signup' ||
                template.trigger === 'after_signup' ||
                template.trigger === 'lead_followup'
                  ? template.trigger
                  : 'lead_followup',
              delayHours: Math.max(0, Number(template.delayHours) || 0),
              active: template.active !== false,
              attachments: Array.isArray(template.attachments)
                ? template.attachments
                    .slice(0, 8)
                    .map((asset) => {
                      const candidate = asset as Partial<{ id: string; name: string; url: string }>;
                      return {
                        id: String(candidate.id || randomUUID()),
                        name: String(candidate.name || 'Archivo adjunto'),
                        url: String(candidate.url || '').trim(),
                      };
                    })
                    .filter((asset) => Boolean(asset.url))
                : [],
            } as FollowUpTemplate;
          })
        : DEFAULT_FOLLOWUP_TEMPLATES;

    const rawLogs = Array.isArray(parsed.salesEngine?.sentLogs)
      ? parsed.salesEngine?.sentLogs
      : [];

    return {
      cadence: parsed.cadence || '48h',
      salesEngine: {
        ...DEFAULT_SALES_ENGINE,
        ...(parsed.salesEngine || {}),
        calendar: {
          ...DEFAULT_SALES_ENGINE.calendar,
          ...(parsed.salesEngine?.calendar || {}),
        },
        meetingLinks: {
          ...DEFAULT_SALES_ENGINE.meetingLinks,
          ...(parsed.salesEngine?.meetingLinks || {}),
        },
        followUpTemplates: normalizedTemplates,
        sentLogs: rawLogs.slice(0, 120).map((item) => {
          const log = item as Partial<SalesEngineConfig['sentLogs'][number]>;
          return {
            id: String(log.id || randomUUID()),
            to: String(log.to || ''),
            subject: sanitizeSalesEngineCopy(String(log.subject || '')),
            status:
              log.status === 'sent' || log.status === 'failed' || log.status === 'pending_setup'
                ? log.status
                : 'sent',
            sentAt: String(log.sentAt || new Date().toISOString()),
            templateId: log.templateId ? String(log.templateId) : undefined,
            trigger:
              log.trigger === 'on_signup' || log.trigger === 'after_signup' || log.trigger === 'lead_followup'
                ? log.trigger
                : undefined,
          };
        }),
        appointments: Array.isArray((parsed.salesEngine as any)?.appointments)
          ? ((parsed.salesEngine as any).appointments as Array<Record<string, unknown>>)
              .slice(0, 300)
              .map((appointment) => ({
                id: String(appointment.id || randomUUID()),
                title: String(appointment.title || 'Cita'),
                startsAt: String(appointment.startsAt || new Date().toISOString()),
                endsAt: String(appointment.endsAt || new Date(Date.now() + 30 * 60 * 1000).toISOString()),
                notes: appointment.notes ? String(appointment.notes) : undefined,
                provider:
                  appointment.provider === 'google' || appointment.provider === 'outlook' || appointment.provider === 'calendly'
                    ? (appointment.provider as 'google' | 'outlook' | 'calendly')
                    : 'google',
                externalUrl: appointment.externalUrl ? String(appointment.externalUrl) : undefined,
              }))
          : [],
      },
    };
  } catch {
    return fallback;
  }
}

export function serializeCadence(payload: { cadence: string; salesEngine: SalesEngineConfig }) {
  return JSON.stringify(payload);
}

export function filterVisibleSentLogs(logs: SalesEngineConfig['sentLogs']) {
  return logs.filter((log) => !isInternalOrTestEmail(log.to));
}

export function resolveMeetingLink(engine: SalesEngineConfig) {
  if (engine.meetingLinks.calendlyUrl) return engine.meetingLinks.calendlyUrl;
  if (engine.meetingLinks.zoomUrl) return engine.meetingLinks.zoomUrl;
  return '';
}

export function applyTemplateVars(input: string, vars: Record<string, string>) {
  const rawName = (vars.name ?? '').trim();
  const nameForEmail = capitalizeLeadNameForEmail(rawName || 'cliente');

  return input
    .replace(/\{\{name\}\}/g, nameForEmail)
    .replace(/\{\{email\}\}/g, vars.email || '')
    .replace(/\{\{meeting_link\}\}/g, vars.meetingLink || '')
    .replace(/\{\{dashboard_url\}\}/g, vars.dashboardUrl || '');
}

function isSafeAttachmentUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

export function toMailerAttachments(template: FollowUpTemplate | undefined) {
  if (!template) return [];

  return template.attachments
    .filter((asset) => isSafeAttachmentUrl(asset.url))
    .map((asset) => ({
      filename: asset.name || 'archivo',
      path: asset.url,
    }));
}

export async function ensureSalesEngineSettingsForUser(userId: string) {
  const existing = await prisma.crmWorkspaceSettings.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.crmWorkspaceSettings.create({
    data: {
      userId,
      emailAutomationEnabled: true,
      whatsappEnabled: false,
      phoneEnabled: false,
      externalCrmEnabled: false,
      autoFollowUpEnabled: true,
      defaultCadence: serializeCadence({
        cadence: '48h',
        salesEngine: DEFAULT_SALES_ENGINE,
      }),
    },
  });
}

export async function dispatchOnboardingSequence(user: {
  id: string;
  email: string;
  name?: string | null;
  createdAt: Date;
}) {
  if (isInternalOrTestEmail(user.email)) {
    return { sentCount: 0 };
  }

  const settings = await ensureSalesEngineSettingsForUser(user.id);
  const parsed = parseStoredCadence(settings.defaultCadence);
  const salesEngine = parsed.salesEngine;
  const now = Date.now();
  const dashboardUrl = `${resolveAppBaseUrlFromEnv().replace(/\/$/, '')}/dashboard`;

  const existingKeys = new Set(
    salesEngine.sentLogs
      .filter((log) => log.templateId)
      .map((log) => `${log.templateId}:${(log.to || '').toLowerCase()}`)
  );

  const onboardingTemplates = salesEngine.followUpTemplates
    .filter((template) => template.active && template.trigger !== 'lead_followup')
    .sort((a, b) => a.delayHours - b.delayHours);

  const newLogs: SalesEngineConfig['sentLogs'] = [];

  for (const template of onboardingTemplates) {
    const dueAt = user.createdAt.getTime() + template.delayHours * 60 * 60 * 1000;
    if (dueAt > now) {
      continue;
    }

    const dedupeKey = `${template.id}:${user.email.toLowerCase()}`;
    if (existingKeys.has(dedupeKey)) {
      continue;
    }

    const subject = applyTemplateVars(template.subject, {
      name: user.name || 'emprendedora',
      email: user.email,
      meetingLink: resolveMeetingLink(salesEngine),
      dashboardUrl,
    });

    const body = applyTemplateVars(template.body, {
      name: user.name || 'emprendedora',
      email: user.email,
      meetingLink: resolveMeetingLink(salesEngine),
      dashboardUrl,
    });

    let status: 'sent' | 'failed' | 'pending_setup' = 'pending_setup';

    const meetingLink = resolveMeetingLink(salesEngine);
    const html = renderCrmTransactionalEmail({
      title: subject.length > 200 ? `${subject.slice(0, 197)}…` : subject,
      greetingName: user.name || 'emprendedora',
      bodyText: body,
      cta: meetingLink ? { label: 'Agendar auditoría', href: meetingLink } : undefined,
      brandEyebrow: 'Tu equipo',
    });

    if (isEmailDeliveryConfigured()) {
      try {
        const result = await sendTransactionalEmail({
          to: user.email,
          subject,
          text: body,
          html,
          attachments: toMailerAttachments(template),
        });
        if (result.delivered) {
          status = 'sent';
        } else {
          console.error('[crm-sequences] Email not delivered:', result);
          status = 'failed';
        }
      } catch (e) {
        console.error('[crm-sequences] sendTransactionalEmail error:', e);
        status = 'failed';
      }
    }

    newLogs.push({
      id: randomUUID(),
      to: user.email,
      subject,
      status,
      sentAt: new Date().toISOString(),
      templateId: template.id,
      trigger: template.trigger,
    });

    existingKeys.add(dedupeKey);
  }

  if (newLogs.length === 0) {
    return { sentCount: 0 };
  }

  const nextLogs = [...newLogs, ...salesEngine.sentLogs].slice(0, 120);

  await prisma.crmWorkspaceSettings.update({
    where: { userId: user.id },
    data: {
      defaultCadence: serializeCadence({
        cadence: parsed.cadence || '48h',
        salesEngine: {
          ...salesEngine,
          sentLogs: nextLogs,
        },
      }),
    },
  });

  return { sentCount: newLogs.length };
}

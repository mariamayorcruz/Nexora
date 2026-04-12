import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/mailer';

export type FollowUpTrigger = 'lead_followup' | 'on_signup' | 'after_signup';

export type FollowUpTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger: FollowUpTrigger;
  delayHours: number;
  active: boolean;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
  }>;
};

export type SalesEngineConfig = {
  calendar: {
    connected: boolean;
    provider: 'google' | 'outlook';
    weeklyCapacity: number;
    bookedThisWeek: number;
  };
  meetingLinks: {
    calendlyUrl: string;
    zoomUrl: string;
  };
  followUpTemplates: FollowUpTemplate[];
  sentLogs: Array<{
    id: string;
    to: string;
    subject: string;
    status: 'sent' | 'failed' | 'pending_setup';
    sentAt: string;
    templateId?: string;
    trigger?: FollowUpTrigger;
  }>;
  appointments: Array<{
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    notes?: string;
    provider: 'google' | 'outlook' | 'calendly';
    externalUrl?: string;
  }>;
};

export const DEFAULT_FOLLOWUP_TEMPLATES: FollowUpTemplate[] = [
  {
    id: 'welcome-0h',
    name: 'Bienvenida inmediata',
    trigger: 'on_signup',
    delayHours: 0,
    active: true,
    attachments: [],
    subject: 'Gracias por elegir GotNexora, {{name}}',
    body:
      'Hola {{name}},\n\nGracias por elegir GotNexora. Acabas de dar un paso grande para ordenar y escalar tus campañas.\n\nTu acceso ya está activo. Entra aquí para empezar: {{dashboard_url}}\n\nTe recomiendo este orden para tu primera victoria en menos de 30 minutos:\n1) Conecta tu primer canal (Meta, Google o TikTok).\n2) Crea tu primera campaña desde Command Center.\n3) Configura tu Motor de Ventas en CRM (calendar + enlaces).\n\nSi te atoras en algo, responde este correo y te ayudamos.\n\nBienvenida/o a bordo,\nEquipo GotNexora',
  },
  {
    id: 'onboarding-24h',
    name: 'Onboarding día 1',
    trigger: 'after_signup',
    delayHours: 24,
    active: true,
    attachments: [],
    subject: 'Tu plan de arranque en 3 pasos (Día 1)',
    body:
      'Hola {{name}},\n\n¿Cómo va tu primer día con GotNexora?\n\nSi aún no arrancas, haz esto hoy:\n- Paso 1: conecta una cuenta publicitaria real.\n- Paso 2: publica una campaña con objetivo claro.\n- Paso 3: define follow-ups en CRM para cerrar más rápido.\n\nAcceso directo: {{dashboard_url}}\n\nCada paso que completes hoy reduce semanas de prueba y error.\n\nEstamos contigo,\nEquipo GotNexora',
  },
  {
    id: 'onboarding-72h',
    name: 'Optimización día 3',
    trigger: 'after_signup',
    delayHours: 72,
    active: true,
    attachments: [],
    subject: 'Día 3: convierte más con mejor seguimiento',
    body:
      'Hola {{name}},\n\nEn este punto la diferencia no está solo en anuncios, sino en el seguimiento comercial.\n\nTe sugerimos hoy:\n- Revisar leads en CRM.\n- Activar plantillas de follow-up por etapa.\n- Medir respuesta de tu secuencia.\n\nEntra aquí: {{dashboard_url}}\n\nTu pipeline mejora cuando marketing y ventas trabajan como un mismo sistema.\n\nEquipo GotNexora',
  },
  {
    id: 'onboarding-168h',
    name: 'Revisión semana 1',
    trigger: 'after_signup',
    delayHours: 168,
    active: true,
    attachments: [],
    subject: 'Semana 1: checklist de escala sostenible',
    body:
      'Hola {{name}},\n\n¡Primera semana completada!\n\nChecklist de escala:\n- ¿Ya tienes al menos 1 canal conectado y activo?\n- ¿Tu CRM tiene secuencia de seguimiento configurada?\n- ¿Ya revisaste analíticas para optimizar presupuesto?\n\nPanel: {{dashboard_url}}\n\nSi quieres, te respondemos con recomendaciones sobre tu caso.\n\nEquipo GotNexora',
  },
  {
    id: 'lead-first-touch',
    name: 'Primer contacto comercial',
    trigger: 'lead_followup',
    delayHours: 0,
    active: true,
    attachments: [],
    subject: 'Seguimiento de tu solicitud en GotNexora',
    body:
      'Hola {{name}},\n\nGracias por tu interés. Te comparto mi enlace para agendar una reunión:\n{{meeting_link}}\n\nAsí revisamos tu caso y definimos próximos pasos concretos.\n\nQuedo atenta,\nEquipo GotNexora',
  },
];

export const DEFAULT_SALES_ENGINE: SalesEngineConfig = {
  calendar: {
    connected: false,
    provider: 'google',
    weeklyCapacity: 20,
    bookedThisWeek: 0,
  },
  meetingLinks: {
    calendlyUrl: '',
    zoomUrl: '',
  },
  followUpTemplates: DEFAULT_FOLLOWUP_TEMPLATES,
  sentLogs: [],
  appointments: [],
};

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
              subject: String(template.subject || ''),
              body: String(template.body || ''),
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
            subject: String(log.subject || ''),
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

export function resolveMeetingLink(engine: SalesEngineConfig) {
  if (engine.meetingLinks.calendlyUrl) return engine.meetingLinks.calendlyUrl;
  if (engine.meetingLinks.zoomUrl) return engine.meetingLinks.zoomUrl;
  return '';
}

export function applyTemplateVars(input: string, vars: Record<string, string>) {
  return input
    .replace(/\{\{name\}\}/g, vars.name || 'cliente')
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

function getDashboardUrl() {
  const domain = process.env.NEXT_PUBLIC_DOMAIN?.trim();
  if (domain) {
    return domain.startsWith('http') ? domain : `https://${domain}`;
  }

  const appUrl = process.env.NEXTAUTH_URL?.trim();
  if (appUrl) return appUrl;
  return 'https://www.gotnexora.com';
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
  const settings = await ensureSalesEngineSettingsForUser(user.id);
  const parsed = parseStoredCadence(settings.defaultCadence);
  const salesEngine = parsed.salesEngine;
  const now = Date.now();
  const dashboardUrl = `${getDashboardUrl().replace(/\/$/, '')}/dashboard`;

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

    if (isEmailDeliveryConfigured()) {
      try {
        await sendTransactionalEmail({
          to: user.email,
          subject,
          text: body,
          html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.6">${body}</div>`,
          attachments: toMailerAttachments(template),
        });
        status = 'sent';
      } catch {
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

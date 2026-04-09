import { prisma } from '@/lib/prisma';
import { buildLifecycleTemplates } from '@/lib/customer-success';
import type { Prisma } from '@prisma/client';

export interface FunnelStage {
  id: string;
  title: string;
  goal: string;
  metric: string;
  owner: string;
  status: 'healthy' | 'watch' | 'build';
}

export interface RoadmapTask {
  id: string;
  title: string;
  area: string;
  priority: 'alta' | 'media';
  status: 'pendiente' | 'en progreso' | 'base lista';
  detail: string;
}

export interface EditableEmailTemplate {
  id: string;
  name: string;
  audience: string;
  trigger: string;
  subject: string;
  preview: string;
  cta?: string;
  replyTo?: string;
}

export interface AutomationConfig {
  aiAssistantEnabled: boolean;
  lifecycleAutomationEnabled: boolean;
  whatsappEnabled: boolean;
  phoneRoutingEnabled: boolean;
  crmSyncEnabled: boolean;
  escalationEnabled: boolean;
  notes: string;
}

export interface FunnelConfig {
  heroTitle: string;
  positioning: string;
  mainOffer: string;
  callToAction: string;
  stages: FunnelStage[];
}

export interface AdminWorkspaceSnapshot {
  funnel: FunnelConfig;
  emails: EditableEmailTemplate[];
  automation: AutomationConfig;
  roadmap: RoadmapTask[];
}

const DEFAULT_FUNNEL: FunnelConfig = {
  heroTitle: 'Nexora centraliza Ads, creatividad y operación comercial desde un solo lugar.',
  positioning: 'La promesa debe conectar dolor real, prueba visible y una activación rápida hacia demo o prueba.',
  mainOffer: 'Prueba gratuita de 7 días sin tarjeta + demo consultiva para equipos listos para escalar.',
  callToAction: 'Empieza hoy y conecta tus cuentas en minutos.',
  stages: [
    {
      id: 'attract',
      title: 'Atracción',
      goal: 'Llevar tráfico calificado desde anuncios y contenido hacia la landing.',
      metric: 'CTR y costo por lead',
      owner: 'Creative + Media',
      status: 'healthy',
    },
    {
      id: 'convert',
      title: 'Conversión',
      goal: 'Convertir la visita en registro, demo o prueba activada.',
      metric: 'Visitante a signup / demo',
      owner: 'Landing + Oferta',
      status: 'watch',
    },
    {
      id: 'activate',
      title: 'Activación',
      goal: 'Conectar primera cuenta y lanzar la primera campaña lo antes posible.',
      metric: 'Tiempo a primer valor',
      owner: 'Onboarding + Soporte IA',
      status: 'watch',
    },
    {
      id: 'retain',
      title: 'Retención',
      goal: 'Mantener uso, resolver bloqueos y preparar upsell.',
      metric: 'Uso semanal y churn',
      owner: 'Lifecycle + Customer Success',
      status: 'build',
    },
  ],
};

const DEFAULT_AUTOMATION: AutomationConfig = {
  aiAssistantEnabled: true,
  lifecycleAutomationEnabled: true,
  whatsappEnabled: false,
  phoneRoutingEnabled: false,
  crmSyncEnabled: false,
  escalationEnabled: true,
  notes:
    'La siguiente fase ideal es conectar WhatsApp y telefonía opcional para seguimiento, recuperación y cierre más rápido cuando el cliente lo autorice.',
};

const DEFAULT_ROADMAP: RoadmapTask[] = [
  {
    id: 'meta-google-tiktok-live',
    title: 'Conexiones reales con Meta, Google y TikTok',
    area: 'Integraciones',
    priority: 'alta',
    status: 'pendiente',
    detail: 'Pasar de demo estructural a lectura real de cuentas, campañas y métricas por canal.',
  },
  {
    id: 'email-delivery-live',
    title: 'Envío real de lifecycle emails',
    area: 'Postventa',
    priority: 'alta',
    status: 'en progreso',
    detail: 'Conectar SMTP o Resend, programar secuencias y registrar entregas, aperturas y respuestas.',
  },
  {
    id: 'ai-automation-actions',
    title: 'Automatización IA con acciones reales',
    area: 'IA',
    priority: 'alta',
    status: 'en progreso',
    detail: 'Permitir que Nexora sugiera y ejecute ajustes, recovery plays, mensajes y seguimiento por evento.',
  },
  {
    id: 'whatsapp-phone-optin',
    title: 'WhatsApp y telefonía opcional para clientes',
    area: 'Canales',
    priority: 'alta',
    status: 'pendiente',
    detail: 'Activar seguimiento por WhatsApp o llamada solo si el cliente lo elige y deja consentimiento explícito.',
  },
  {
    id: 'crm-sales-funnel',
    title: 'Funnel comercial visible con estado por etapa',
    area: 'Ventas',
    priority: 'media',
    status: 'base lista',
    detail: 'Hacer visible el embudo, los puntos de fuga y los mensajes que sostienen la conversión en cada etapa.',
  },
  {
    id: 'editable-email-library',
    title: 'Biblioteca editable de emails y secuencias',
    area: 'Contenido',
    priority: 'media',
    status: 'base lista',
    detail: 'Permitir editar asuntos, previews, CTA y enfoque de cada email desde el panel admin.',
  },
];

function sanitizeEmailTemplates(input: unknown, fallbackReplyTo: string) {
  const defaults = buildLifecycleTemplates(fallbackReplyTo);
  if (!Array.isArray(input)) return defaults;

  return defaults.map((template) => {
    const override = input.find(
      (item): item is Partial<EditableEmailTemplate> & { id: string } =>
        typeof item === 'object' && item !== null && 'id' in item && (item as { id?: string }).id === template.id
    );

    return {
      ...template,
      ...override,
      replyTo: override?.replyTo || template.replyTo || fallbackReplyTo,
    };
  });
}

function sanitizeFunnelConfig(input: unknown): FunnelConfig {
  if (!input || typeof input !== 'object') return DEFAULT_FUNNEL;
  const data = input as Partial<FunnelConfig>;
  return {
    heroTitle: data.heroTitle || DEFAULT_FUNNEL.heroTitle,
    positioning: data.positioning || DEFAULT_FUNNEL.positioning,
    mainOffer: data.mainOffer || DEFAULT_FUNNEL.mainOffer,
    callToAction: data.callToAction || DEFAULT_FUNNEL.callToAction,
    stages: Array.isArray(data.stages) && data.stages.length ? (data.stages as FunnelStage[]) : DEFAULT_FUNNEL.stages,
  };
}

function sanitizeAutomationConfig(input: unknown): AutomationConfig {
  if (!input || typeof input !== 'object') return DEFAULT_AUTOMATION;
  return {
    ...DEFAULT_AUTOMATION,
    ...(input as Partial<AutomationConfig>),
  };
}

function sanitizeRoadmap(input: unknown): RoadmapTask[] {
  if (!Array.isArray(input) || !input.length) return DEFAULT_ROADMAP;
  return input as RoadmapTask[];
}

export async function getAdminWorkspaceSnapshot(): Promise<AdminWorkspaceSnapshot> {
  const config = await prisma.adminWorkspaceConfig.findUnique({
    where: { key: 'main' },
  });
  const fallbackReplyTo = process.env.SUPPORT_EMAIL || 'support@nexora.com';

  return {
    funnel: sanitizeFunnelConfig(config?.funnelConfig),
    emails: sanitizeEmailTemplates(config?.emailTemplates, fallbackReplyTo),
    automation: sanitizeAutomationConfig(config?.automationConfig),
    roadmap: sanitizeRoadmap(config?.roadmapConfig),
  };
}

export async function saveAdminWorkspacePartial(
  partial: Partial<{
    funnelConfig: FunnelConfig;
    emailTemplates: EditableEmailTemplate[];
    automationConfig: AutomationConfig;
    roadmapConfig: RoadmapTask[];
  }>
) {
  const current = await prisma.adminWorkspaceConfig.findUnique({
    where: { key: 'main' },
  });

  const toJson = (value: unknown): Prisma.InputJsonValue | undefined =>
    value === undefined ? undefined : (value as Prisma.InputJsonValue);

  return prisma.adminWorkspaceConfig.upsert({
    where: { key: 'main' },
    update: {
      funnelConfig: toJson(partial.funnelConfig ?? current?.funnelConfig),
      emailTemplates: toJson(partial.emailTemplates ?? current?.emailTemplates),
      automationConfig: toJson(partial.automationConfig ?? current?.automationConfig),
      roadmapConfig: toJson(partial.roadmapConfig ?? current?.roadmapConfig),
    },
    create: {
      key: 'main',
      funnelConfig: toJson(partial.funnelConfig ?? DEFAULT_FUNNEL),
      emailTemplates: toJson(
        partial.emailTemplates ?? buildLifecycleTemplates(process.env.SUPPORT_EMAIL || 'support@nexora.com')
      ),
      automationConfig: toJson(partial.automationConfig ?? DEFAULT_AUTOMATION),
      roadmapConfig: toJson(partial.roadmapConfig ?? DEFAULT_ROADMAP),
    },
  });
}

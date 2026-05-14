import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';
import { CRM_ALLOWED_STAGES } from '@/lib/sales-playbook';
import {
  buildLaunchAssistantTemplates,
  type LaunchBusinessType,
  type LaunchMainGoal,
  type LaunchPreferredChannel,
} from '@/lib/crm-sales-engine-defaults';
import { DEFAULT_SALES_ENGINE, parseStoredCadence, serializeCadence } from '@/lib/crm-sequences';
import { isInternalOrTestEmail } from '@/lib/access';

export const dynamic = 'force-dynamic';

const INDUSTRIES = new Set(['ecommerce', 'servicios', 'salud', 'educacion', 'otro']);
const GOALS = new Set(['conseguir_mas_leads', 'cerrar_mas_ventas', 'automatizar_seguimiento']);
const CHANNELS = new Set(['Instagram', 'WhatsApp', 'Email', 'Facebook']);
const CUSTOMER_RANGES = new Set(['0-10', '10-50', '50-200', '200+']);
const BUSINESS_TYPES = new Set<LaunchBusinessType>([
  'cleaning_company',
  'contractor',
  'coach',
  'med_spa',
  'real_estate',
  'insurance',
  'agency',
  'other_service_business',
]);
const MAIN_GOALS = new Set<LaunchMainGoal>([
  'get_more_leads',
  'close_more_clients',
  'automate_follow_up',
]);
const PREFERRED_CHANNELS = new Set<LaunchPreferredChannel>(['sms', 'email', 'phone', 'mixed']);

async function getUserFromToken(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const decoded = verifyUserToken(token);
  if (!decoded?.userId) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { subscription: true },
  });

  if (!user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  return { user };
}

function normalizeBusinessType(raw: string) {
  if (BUSINESS_TYPES.has(raw as LaunchBusinessType)) return raw as LaunchBusinessType;

  switch (raw) {
    case 'servicios':
      return 'other_service_business';
    case 'salud':
      return 'med_spa';
    case 'educacion':
      return 'coach';
    default:
      return 'other_service_business';
  }
}

function normalizeMainGoal(raw: string) {
  if (MAIN_GOALS.has(raw as LaunchMainGoal)) return raw as LaunchMainGoal;

  switch (raw) {
    case 'conseguir_mas_leads':
      return 'get_more_leads';
    case 'cerrar_mas_ventas':
      return 'close_more_clients';
    case 'automatizar_seguimiento':
      return 'automate_follow_up';
    default:
      return 'get_more_leads';
  }
}

function normalizePreferredChannels(raw: unknown): LaunchPreferredChannel[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const normalized = values
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item): item is LaunchPreferredChannel => PREFERRED_CHANNELS.has(item as LaunchPreferredChannel));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : ['mixed'];
}

function mapLegacyIndustryToBusinessType(industries: string[]) {
  return normalizeBusinessType(industries[0] || 'other_service_business');
}

function mapMainGoalToLegacy(mainGoal: LaunchMainGoal) {
  switch (mainGoal) {
    case 'close_more_clients':
      return 'cerrar_mas_ventas';
    case 'automate_follow_up':
      return 'automatizar_seguimiento';
    default:
      return 'conseguir_mas_leads';
  }
}

function mapBusinessTypeToIndustryLabel(businessType: LaunchBusinessType) {
  switch (businessType) {
    case 'cleaning_company':
      return 'cleaning company';
    case 'med_spa':
      return 'med spa';
    case 'real_estate':
      return 'real estate';
    case 'other_service_business':
      return 'service business';
    default:
      return businessType.replace(/_/g, ' ');
  }
}

function mapPreferredChannelsToLegacy(preferredChannels: LaunchPreferredChannel[]) {
  if (preferredChannels.includes('mixed')) return ['WhatsApp', 'Email', 'Facebook'];

  const mapped = new Set<string>();
  if (preferredChannels.includes('sms')) mapped.add('WhatsApp');
  if (preferredChannels.includes('email')) mapped.add('Email');
  if (preferredChannels.includes('phone')) mapped.add('WhatsApp');

  return mapped.size > 0 ? Array.from(mapped) : ['Email'];
}

function buildPipelinePresetKey(businessType: LaunchBusinessType, mainGoal: LaunchMainGoal) {
  return `${businessType}:${mainGoal}`;
}

function buildSampleLead(params: {
  businessType: LaunchBusinessType;
  businessName: string;
  mainGoal: LaunchMainGoal;
}) {
  const safeStage = CRM_ALLOWED_STAGES.has('lead') ? 'lead' : 'lead';
  const base = {
    company: params.businessName,
    source: 'launch_assistant',
    stage: safeStage,
    value: 0,
  };

  switch (params.businessType) {
    case 'cleaning_company':
      return {
        ...base,
        name: 'Sarah Thompson',
        email: 'sarah.thompson@example.com',
        confidence: 38,
        nextAction: 'Responder hoy con una cotización simple y ofrecer visita rápida.',
        notes: `Solicitud de cotización para limpieza de oficina. Meta actual: ${params.mainGoal}.`,
      };
    case 'contractor':
      return {
        ...base,
        name: 'Daniel Brooks',
        email: 'daniel.brooks@example.com',
        confidence: 42,
        nextAction: 'Confirmar alcance del proyecto y proponer visita para estimado.',
        notes: `Lead de estimado para proyecto residencial. Meta actual: ${params.mainGoal}.`,
      };
    case 'coach':
      return {
        ...base,
        name: 'Amanda Lee',
        email: 'amanda.lee@example.com',
        confidence: 41,
        nextAction: 'Invitar a llamada de descubrimiento y validar objetivo principal.',
        notes: `Consulta para sesión inicial de coaching. Meta actual: ${params.mainGoal}.`,
      };
    case 'med_spa':
      return {
        ...base,
        name: 'Nicole Rivera',
        email: 'nicole.rivera@example.com',
        confidence: 46,
        nextAction: 'Responder con disponibilidad y asegurar reserva de consulta.',
        notes: `Consulta para cita inicial y tratamiento. Meta actual: ${params.mainGoal}.`,
      };
    case 'real_estate':
      return {
        ...base,
        name: 'Marcus Hall',
        email: 'marcus.hall@example.com',
        confidence: 48,
        nextAction: 'Calificar interés de compra y agendar follow-up corto.',
        notes: `Lead comprador interesado en propiedades disponibles. Meta actual: ${params.mainGoal}.`,
      };
    case 'insurance':
      return {
        ...base,
        name: 'Olivia Carter',
        email: 'olivia.carter@example.com',
        confidence: 44,
        nextAction: 'Enviar cotización preliminar y resolver dudas de cobertura.',
        notes: `Solicitud de cotización de seguro. Meta actual: ${params.mainGoal}.`,
      };
    case 'agency':
      return {
        ...base,
        name: 'Jason Patel',
        email: 'jason.patel@example.com',
        confidence: 43,
        nextAction: 'Agendar discovery call y detectar canal principal de crecimiento.',
        notes: `Lead interesado en discovery call para servicios de agencia. Meta actual: ${params.mainGoal}.`,
      };
    default:
      return {
        ...base,
        name: 'Taylor Morgan',
        email: 'taylor.morgan@example.com',
        confidence: 35,
        nextAction: 'Responder rápido, entender necesidad y proponer siguiente paso.',
        notes: `Consulta inicial para ${params.businessName}. Meta actual: ${params.mainGoal}.`,
      };
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    const body = (await request.json()) as {
      businessName?: string;
      industries?: string[];
      primaryGoals?: string[];
      channels?: string[];
      customerRange?: string;
      businessType?: string;
      mainGoal?: string;
      preferredChannels?: string[];
      previewMode?: boolean;
    };

    const businessName = String(body.businessName || '').trim();
    const customerRange = String(body.customerRange || '').trim();
    const rawIndustries = Array.isArray(body.industries) ? body.industries : [];
    const industries = rawIndustries
      .map((industry) => String(industry || '').trim())
      .filter((industry): industry is string => INDUSTRIES.has(industry));
    const rawPrimaryGoals = Array.isArray(body.primaryGoals) ? body.primaryGoals : [];
    const primaryGoals = rawPrimaryGoals
      .map((goal) => String(goal || '').trim())
      .filter((goal): goal is string => GOALS.has(goal));
    const rawChannels = Array.isArray(body.channels) ? body.channels : [];
    const channels = rawChannels
      .map((channel) => String(channel || '').trim())
      .filter((channel): channel is string => CHANNELS.has(channel));
    const explicitBusinessType = String(body.businessType || '').trim();
    const explicitMainGoal = String(body.mainGoal || '').trim();
    const preferredChannels = normalizePreferredChannels(body.preferredChannels);
    const previewModeRequested = body.previewMode === true;
    const previewModeAllowed = previewModeRequested && isInternalOrTestEmail(user.email);

    const businessType =
      explicitBusinessType && BUSINESS_TYPES.has(explicitBusinessType as LaunchBusinessType)
        ? (explicitBusinessType as LaunchBusinessType)
        : mapLegacyIndustryToBusinessType(industries);
    const mainGoal =
      explicitMainGoal && MAIN_GOALS.has(explicitMainGoal as LaunchMainGoal)
        ? (explicitMainGoal as LaunchMainGoal)
        : normalizeMainGoal(rawPrimaryGoals[0] ? String(rawPrimaryGoals[0]).trim() : '');
    const legacyIndustries = industries.length > 0 ? industries : [mapBusinessTypeToIndustryLabel(businessType)];
    const legacyPrimaryGoals = primaryGoals.length > 0 ? primaryGoals : [mapMainGoalToLegacy(mainGoal)];
    const legacyChannels = channels.length > 0 ? channels : mapPreferredChannelsToLegacy(preferredChannels);
    const normalizedCustomerRange = CUSTOMER_RANGES.has(customerRange) ? customerRange : null;

    if (!businessName) {
      return NextResponse.json({ error: 'El nombre del negocio es requerido.' }, { status: 400 });
    }

    if (!BUSINESS_TYPES.has(businessType)) {
      return NextResponse.json({ error: 'Selecciona un tipo de negocio válido.' }, { status: 400 });
    }

    if (!MAIN_GOALS.has(mainGoal)) {
      return NextResponse.json({ error: 'Selecciona un objetivo principal válido.' }, { status: 400 });
    }

    if (preferredChannels.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos un canal preferido.' }, { status: 400 });
    }

    const subscriptionStatus = String(user.subscription?.status || '').toLowerCase();
    if (!previewModeAllowed && !['active', 'trialing'].includes(subscriptionStatus)) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    const currentOnboardingData =
      user.onboardingData && typeof user.onboardingData === 'object' && !Array.isArray(user.onboardingData)
        ? (user.onboardingData as Record<string, unknown>)
        : {};
    const pipelinePresetKey = buildPipelinePresetKey(businessType, mainGoal);
    const canCreateSampleLead = !currentOnboardingData.sampleLeadCreatedAt;

    await prisma.$transaction(async (tx) => {
      let sampleLeadCreatedAt =
        typeof currentOnboardingData.sampleLeadCreatedAt === 'string'
          ? String(currentOnboardingData.sampleLeadCreatedAt)
          : null;

      const existingLeadCount = await tx.crmLead.count({
        where: { userId: user.id },
      });

      if (existingLeadCount === 0 && canCreateSampleLead) {
        const sampleLead = buildSampleLead({
          businessType,
          businessName,
          mainGoal,
        });

        await tx.crmLead.create({
          data: {
            userId: user.id,
            name: sampleLead.name,
            email: sampleLead.email,
            company: sampleLead.company,
            source: sampleLead.source,
            stage: sampleLead.stage,
            value: sampleLead.value,
            confidence: sampleLead.confidence,
            nextAction: sampleLead.nextAction,
            notes: sampleLead.notes,
          },
        });

        sampleLeadCreatedAt = new Date().toISOString();
      }

      const existingSettings = await tx.crmWorkspaceSettings.findUnique({
        where: { userId: user.id },
      });
      const parsedSettings = parseStoredCadence(existingSettings?.defaultCadence);
      const followUpTemplates = buildLaunchAssistantTemplates({
        businessType,
        mainGoal,
        businessName,
        preferredChannels,
      });

      await tx.crmWorkspaceSettings.upsert({
        where: { userId: user.id },
        update: {
          autoFollowUpEnabled: true,
          defaultCadence: serializeCadence({
            cadence: parsedSettings.cadence || '48h',
            salesEngine: {
              ...DEFAULT_SALES_ENGINE,
              ...parsedSettings.salesEngine,
              followUpTemplates,
              sentLogs: parsedSettings.salesEngine.sentLogs,
              appointments: parsedSettings.salesEngine.appointments,
            },
          }),
        },
        create: {
          userId: user.id,
          emailAutomationEnabled: true,
          whatsappEnabled: preferredChannels.includes('sms') || preferredChannels.includes('mixed'),
          phoneEnabled: preferredChannels.includes('phone') || preferredChannels.includes('mixed'),
          externalCrmEnabled: false,
          autoFollowUpEnabled: true,
          defaultCadence: serializeCadence({
            cadence: '48h',
            salesEngine: {
              ...DEFAULT_SALES_ENGINE,
              followUpTemplates,
            },
          }),
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          onboardingCompletedAt: new Date(),
          onboardingData: {
            ...currentOnboardingData,
            businessName,
            industries: legacyIndustries,
            primaryGoals: legacyPrimaryGoals,
            channels: legacyChannels,
            ...(normalizedCustomerRange ? { customerRange: normalizedCustomerRange } : {}),
            businessType,
            mainGoal,
            preferredChannels,
            launchAssistantVersion: 1,
            pipelinePresetKey,
            sampleLeadCreatedAt,
            firstWinReady: true,
          },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Onboarding save error:', error);
    return NextResponse.json({ error: 'No se pudo guardar el onboarding.' }, { status: 500 });
  }
}

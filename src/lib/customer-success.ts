type SupportIntent =
  | 'billing'
  | 'campaign-performance'
  | 'account-connection'
  | 'onboarding'
  | 'general';

interface SupportContext {
  name?: string | null;
  plan?: string | null;
  founderAccess?: boolean;
  adAccountsCount: number;
  activeCampaigns: number;
}

export interface SupportPlaybookCard {
  id: string;
  title: string;
  audience: string;
  trigger: string;
  goal: string;
  channel: string;
}

export interface AgentAction {
  id: string;
  type: 'create_draft' | 'pause_campaign' | 'open_page' | 'view_campaign' | 'adjust_budget';
  label: string;
  payload: Record<string, unknown>;
}

export interface SuggestedReply {
  title: string;
  message: string;
  nextSteps: string[];
  campaignDraft?: CampaignDraftSuggestion;
  agentActions?: AgentAction[];
}

export interface CampaignDraftSuggestion {
  name: string;
  objective: string;
  channel: string;
  budget: number;
  status: 'draft';
  launchWindow: string;
  hook: string;
  promise: string;
  cta: string;
  angle: string;
  checklist: string[];
}

export interface SupportCenterSummary {
  queueSummary: {
    openTickets: number;
    aiResolvedRate: number;
    averageFirstResponse: string;
  };
  playbooks: SupportPlaybookCard[];
  channels: string[];
}

export function buildSupportCenterSummary(): SupportCenterSummary {
  return {
    queueSummary: {
      openTickets: 6,
      aiResolvedRate: 68,
      averageFirstResponse: '4 min',
    },
    channels: ['Asistente IA dentro del dashboard', 'Seguimiento por email', 'Escalado humano prioritario'],
    playbooks: [
      {
        id: 'onboarding-success',
        title: 'Onboarding guiado',
        audience: 'Nuevos clientes',
        trigger: 'Cuenta creada o prueba iniciada',
        goal: 'Llevar al primer valor en menos de 24 horas',
        channel: 'Email + dashboard',
      },
      {
        id: 'post-sale-followup',
        title: 'Seguimiento post-venta',
        audience: 'Clientes recién convertidos',
        trigger: 'Pago exitoso o upgrade',
        goal: 'Reforzar confianza y activar implementación',
        channel: 'Email + soporte IA',
      },
      {
        id: 'campaign-rescue',
        title: 'Rescate de campañas',
        audience: 'Clientes con bajo rendimiento',
        trigger: 'Gasto sin conversión o dudas técnicas',
        goal: 'Reducir frustración y recuperar tracción',
        channel: 'Soporte IA + email consultivo',
      },
      {
        id: 'retention-save',
        title: 'Retención y winback',
        audience: 'Clientes con riesgo de cancelación',
        trigger: 'cancelAtPeriodEnd o poco uso',
        goal: 'Recuperar uso y evitar churn',
        channel: 'Email + escalado humano',
      },
    ],
  };
}

export function detectSupportIntent(message: string): SupportIntent {
  const normalized = normalizeSpanish(message);

  if (includesAny(normalized, ['pago', 'factura', 'stripe', 'cobro', 'suscripcion', 'subscription'])) {
    return 'billing';
  }
  if (
    includesAny(normalized, [
      'conversion',
      'conversi',
      'roi',
      'campan',
      'campa',
      'anuncio',
      'ads',
      'rendimiento',
      'lanzar',
      'lanzamiento',
      'trafico',
    ])
  ) {
    return 'campaign-performance';
  }
  if (includesAny(normalized, ['conectar', 'conexion', 'meta', 'google', 'tiktok', 'cuenta publicitaria'])) {
    return 'account-connection';
  }
  if (includesAny(normalized, ['empez', 'inicio', 'arrancar', 'bienvenida', 'onboarding', 'configurar'])) {
    return 'onboarding';
  }

  return 'general';
}

function shouldSuggestCampaignDraft(message: string) {
  const normalized = normalizeSpanish(message);
  const hasCampaignIntent =
    normalized.includes('campan') ||
    normalized.includes('campa') ||
    normalized.includes('anuncio') ||
    normalized.includes('ads') ||
    normalized.includes('trafico') ||
    normalized.includes('lanzamiento');
  const hasBuildIntent =
    normalized.includes('crear') ||
    normalized.includes('lanzar') ||
    normalized.includes('armar') ||
    normalized.includes('construir') ||
    normalized.includes('empezar') ||
    normalized.includes('empiezo') ||
    normalized.includes('iniciar');
  return hasCampaignIntent && hasBuildIntent;
}

function inferCampaignChannel(message: string) {
  const normalized = normalizeSpanish(message);
  if (normalized.includes('google')) return 'google';
  if (normalized.includes('tiktok')) return 'tiktok';
  if (normalized.includes('facebook') || normalized.includes('meta')) return 'facebook';
  if (normalized.includes('instagram') || normalized.includes('ig')) return 'instagram';
  return 'multiplataforma';
}

function inferCampaignObjective(message: string) {
  const normalized = normalizeSpanish(message);
  if (normalized.includes('lead') || normalized.includes('prospecto')) return 'generacion-de-leads';
  if (normalized.includes('venta') || normalized.includes('compr')) return 'conversiones';
  if (normalized.includes('whatsapp') || normalized.includes('mensaje')) return 'mensajes';
  if (normalized.includes('trafico') || normalized.includes('tráfico')) return 'trafico';
  return 'conversiones';
}

function inferCampaignBudget(message: string) {
  const normalized = normalizeSpanish(message);
  const match = normalized.match(/(?:\$|usd\s*)?(\d{2,6})(?:\s*(?:usd|dolares|dólares))?/i);
  if (!match) return 250;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return 250;
  return Math.max(50, Math.min(100000, parsed));
}

function inferOffer(message: string) {
  const normalized = normalizeSpanish(message);
  if (normalized.includes('curso') || normalized.includes('masterclass')) return 'tu masterclass';
  if (normalized.includes('agencia')) return 'tu servicio de agencia';
  if (normalized.includes('software') || normalized.includes('saas')) return 'tu software';
  if (normalized.includes('ecommerce') || normalized.includes('tienda')) return 'tu producto ecommerce';
  return 'tu oferta principal';
}

function buildChannelChecklist(channel: string) {
  if (channel === 'google') {
    return [
      'Define conversion principal y configura tracking.',
      'Crea 2 grupos de anuncios con keywords de intencion alta.',
      'Prepara 2 variantes de anuncio con propuesta distinta.',
      'Alinea landing y oferta con la promesa del anuncio.',
      'Configura presupuesto diario y regla de pausa inicial.',
    ];
  }

  if (channel === 'tiktok') {
    return [
      'Hook en los primeros 2 segundos con dolor claro.',
      'Creativo vertical 9:16 con ritmo rapido y subtitulos.',
      'CTA visible en pantalla y en copy.',
      'Lanza 3 variaciones de intro para test rapido.',
      'Revisa CTR y watch time a las 24 horas.',
    ];
  }

  if (channel === 'facebook' || channel === 'instagram') {
    return [
      'Define angulo principal y objecion a romper.',
      'Crea 2 anuncios: prueba social vs beneficio directo.',
      'Usa copy corto con CTA unico y concreto.',
      'Verifica pixel/evento de conversion activo.',
      'Analiza CPA, frecuencia y fatiga creativa cada 48h.',
    ];
  }

  return [
    'Define objetivo de negocio y KPI principal.',
    'Elige mensaje central y CTA unico.',
    'Prepara dos variaciones de creativo para test A/B.',
    'Asegura tracking y medicion antes de publicar.',
    'Haz optimizacion con datos en 24-48h.',
  ];
}

function buildCampaignDraftSuggestion(message: string): CampaignDraftSuggestion {
  const channel = inferCampaignChannel(message);
  const objective = inferCampaignObjective(message);
  const budget = inferCampaignBudget(message);
  const offer = inferOffer(message);
  const timestamp = new Date();
  const suffix = `${timestamp.getDate().toString().padStart(2, '0')}-${(timestamp.getMonth() + 1)
    .toString()
    .padStart(2, '0')}`;

  const hook = `Si sigues invirtiendo sin un sistema claro, ${offer} se te escapa entre canales.`;
  const promise = `Con una campana enfocada en ${objective}, ${offer} puede convertir mejor en menos tiempo.`;
  const cta = channel === 'google' ? 'Solicita una demo hoy' : 'Escribenos y activalo hoy';
  const angle = `Comparar el costo de seguir improvisando vs. implementar un sistema con foco en resultado.`;
  const checklist = buildChannelChecklist(channel);

  return {
    name: `Campana ${objective} ${channel} ${suffix}`,
    objective,
    channel,
    budget,
    status: 'draft',
    launchWindow: '7-dias',
    hook,
    promise,
    cta,
    angle,
    checklist,
  };
}

export function buildAiSupportReply(message: string, context: SupportContext): SuggestedReply {
  const intent = detectSupportIntent(message);
  const planLabel = context.founderAccess ? 'Founder / Scale' : context.plan || 'starter';
  const campaignDraft = shouldSuggestCampaignDraft(message)
    ? buildCampaignDraftSuggestion(message)
    : undefined;

  if (intent === 'billing') {
    return {
      title: 'Ayuda con facturación',
      message: `Estoy viendo que tu cuenta está operando en el plan ${planLabel}. Para temas de cobro, el camino correcto es revisar estado de suscripción, último intento de pago y si Stripe ya confirmó el checkout.`,
      nextSteps: [
        'Abre Facturación y confirma tu plan actual y fecha de corte.',
        'Si el pago falló, actualiza método de pago o reintenta el checkout.',
        'Si Stripe cobró pero Nexora no refleja el cambio, soporte debe revisar la sincronización del webhook.',
      ],
    };
  }

  if (intent === 'campaign-performance') {
    return {
      title: 'Soporte para rendimiento de campañas',
      message: `Ahora mismo tu cuenta tiene ${context.activeCampaigns} campañas activas y ${context.adAccountsCount} cuentas conectadas. El soporte IA recomienda revisar primero hook, promesa y CTA antes de tocar presupuesto.`,
      nextSteps: [
        'Identifica las campañas con gasto sin conversión.',
        'Cambia una sola variable: hook, oferta o CTA.',
        'Si tu plan incluye radar, usa los blueprints para lanzar una nueva versión del mensaje.',
      ],
      campaignDraft,
    };
  }

  if (intent === 'account-connection') {
    return {
      title: 'Ayuda para conectar cuentas',
      message: `Tu cuenta usa el plan ${planLabel}. Lo primero es validar si todavía tienes capacidad para más cuentas y luego conectar la plataforma prioritaria para lectura de datos.`,
      nextSteps: [
        'Ve a Conectar redes y revisa el límite disponible en tu plan.',
        'Empieza por la plataforma con mayor volumen o mejor señal comercial.',
        'Si alcanzaste el límite, el siguiente paso es ampliar plan antes de sumar otra cuenta.',
      ],
    };
  }

  if (intent === 'onboarding') {
    return {
      title: 'Acompañamiento inicial',
      message: `Para que Nexora te entregue valor rápido, el mejor onboarding es conectar una cuenta, revisar capacidad del plan y lanzar una campaña con una promesa clara lo antes posible.`,
      nextSteps: [
        'Conecta tu primera cuenta publicitaria.',
        'Revisa el dashboard para confirmar capacidad y foco.',
        'Lanza una campaña simple con una sola promesa fuerte.',
      ],
      campaignDraft,
    };
  }

  return {
    title: 'Soporte general',
    message: 'Puedo ayudarte a diagnosticar facturación, conexiones, rendimiento de campañas o pasos de onboarding. Cuanto más concreta sea tu duda, más accionable será la respuesta.',
    nextSteps: [
      'Describe el problema y qué estabas intentando hacer.',
      'Comparte si afecta pagos, conexiones, campañas o configuración.',
      'Si necesitas seguimiento humano, usa el canal de soporte desde este mismo centro.',
    ],
    campaignDraft,
  };
}

function normalizeSpanish(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

export function buildLifecycleTemplates(supportEmail: string) {
  const replyTo = supportEmail || process.env.SUPPORT_EMAIL || 'support@nexora.com';

  return [
    {
      id: 'welcome-onboarding',
      name: 'Bienvenida + onboarding',
      audience: 'Nuevos registros',
      trigger: 'Cuenta creada',
      subject: 'Bienvenida a Nexora: vamos a activar tu primera cuenta',
      preview: 'Da la bienvenida, explica el primer paso y empuja a conectar una cuenta para llegar al primer win.',
      cta: 'Conectar mi primera cuenta',
      replyTo,
    },
    {
      id: 'lead-nurture-daily',
      name: 'Seguimiento diario para no compradores',
      audience: 'Registros sin suscripción activa',
      trigger: 'Cada 24 horas mientras haya consentimiento y no exista checkout exitoso',
      subject: 'Lo que ya podrías estar centralizando con Nexora hoy',
      preview: 'Email consultivo con valor, prueba y un siguiente paso claro para retomar la compra sin fricción.',
      cta: 'Activar mi plan en Nexora',
      replyTo,
    },
    {
      id: 'post-sale-welcome',
      name: 'Post-venta inmediata',
      audience: 'Clientes que acaban de pagar',
      trigger: 'Pago exitoso o upgrade',
      subject: 'Tu plan ya está activo: aquí empieza tu implementación en Nexora',
      preview: 'Refuerza confianza, explica qué sigue y abre la puerta al soporte IA o humano.',
      cta: 'Abrir mi panel',
      replyTo,
    },
    {
      id: 'follow-up-3-days',
      name: 'Seguimiento a 3 días',
      audience: 'Clientes nuevos sin suficiente avance',
      trigger: 'Día 3 sin conectar cuentas o sin campañas activas',
      subject: 'Te ayudamos a sacar más valor de Nexora esta semana',
      preview: 'Recordatorio consultivo con pasos simples para no perder momentum después de la compra.',
      cta: 'Recibir ayuda en Nexora',
      replyTo,
    },
    {
      id: 'follow-up-7-days',
      name: 'Seguimiento de primera semana',
      audience: 'Clientes activos',
      trigger: 'Día 7',
      subject: 'Tu primera semana en Nexora: qué revisar ahora',
      preview: 'Resume progreso, propone siguiente acción y refuerza el uso del dashboard, radar y soporte.',
      cta: 'Ver mi progreso',
      replyTo,
    },
    {
      id: 'support-checkin',
      name: 'Check-in de soporte',
      audience: 'Clientes con dudas o uso bajo',
      trigger: 'Sin actividad relevante o ticket abierto',
      subject: 'Te ayudamos a destrabar tu operación en Nexora',
      preview: 'Email de ayuda activa para reducir fricción y recuperar confianza después de la venta.',
      cta: 'Hablar con soporte',
      replyTo,
    },
  ];
}

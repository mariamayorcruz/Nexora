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

export interface SuggestedReply {
  title: string;
  message: string;
  nextSteps: string[];
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
  const normalized = message.toLowerCase();

  if (normalized.includes('pago') || normalized.includes('factura') || normalized.includes('stripe') || normalized.includes('cobro')) {
    return 'billing';
  }
  if (normalized.includes('conversion') || normalized.includes('roi') || normalized.includes('campan') || normalized.includes('rendimiento')) {
    return 'campaign-performance';
  }
  if (normalized.includes('conectar') || normalized.includes('meta') || normalized.includes('google') || normalized.includes('tiktok') || normalized.includes('cuenta')) {
    return 'account-connection';
  }
  if (normalized.includes('empez') || normalized.includes('bienvenida') || normalized.includes('onboarding') || normalized.includes('configurar')) {
    return 'onboarding';
  }

  return 'general';
}

export function buildAiSupportReply(message: string, context: SupportContext): SuggestedReply {
  const intent = detectSupportIntent(message);
  const planLabel = context.founderAccess ? 'Founder / Scale' : context.plan || 'starter';

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
  };
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

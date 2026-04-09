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
        audience: 'Clientes recien convertidos',
        trigger: 'Pago exitoso o upgrade',
        goal: 'Reforzar confianza y activar implementacion',
        channel: 'Email + soporte IA',
      },
      {
        id: 'campaign-rescue',
        title: 'Rescate de campanas',
        audience: 'Clientes con bajo rendimiento',
        trigger: 'Gasto sin conversion o dudas tecnicas',
        goal: 'Reducir frustracion y recuperar traccion',
        channel: 'Soporte IA + email consultivo',
      },
      {
        id: 'retention-save',
        title: 'Retencion y winback',
        audience: 'Clientes con riesgo de cancelacion',
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
      title: 'Ayuda con facturacion',
      message: `Estoy viendo que tu cuenta esta operando en el plan ${planLabel}. Para temas de cobro, el camino correcto es revisar estado de suscripcion, ultimo intento de pago y si Stripe ya confirmo el checkout.`,
      nextSteps: [
        'Abre Facturacion y confirma tu plan actual y fecha de corte.',
        'Si el pago fallo, actualiza metodo de pago o reintenta el checkout.',
        'Si Stripe cobro pero Nexora no refleja el cambio, soporte debe revisar la sincronizacion del webhook.',
      ],
    };
  }

  if (intent === 'campaign-performance') {
    return {
      title: 'Soporte para rendimiento de campanas',
      message: `Ahora mismo tu cuenta tiene ${context.activeCampaigns} campanas activas y ${context.adAccountsCount} cuentas conectadas. El soporte IA recomienda revisar primero hook, promesa y CTA antes de tocar presupuesto.`,
      nextSteps: [
        'Identifica las campanas con gasto sin conversion.',
        'Cambia una sola variable: hook, oferta o CTA.',
        'Si tu plan incluye radar, usa los blueprints para lanzar una nueva version del mensaje.',
      ],
    };
  }

  if (intent === 'account-connection') {
    return {
      title: 'Ayuda para conectar cuentas',
      message: `Tu cuenta usa el plan ${planLabel}. Lo primero es validar si todavia tienes capacidad para mas cuentas y luego conectar la plataforma prioritaria para lectura de datos.`,
      nextSteps: [
        'Ve a Conectar redes y revisa el limite disponible en tu plan.',
        'Empieza por la plataforma con mayor volumen o mejor señal comercial.',
        'Si alcanzaste el limite, el siguiente paso es ampliar plan antes de sumar otra cuenta.',
      ],
    };
  }

  if (intent === 'onboarding') {
    return {
      title: 'Acompañamiento inicial',
      message: `Para que Nexora te entregue valor rapido, el mejor onboarding es conectar una cuenta, revisar capacidad del plan y lanzar una campana con una promesa clara lo antes posible.`,
      nextSteps: [
        'Conecta tu primera cuenta publicitaria.',
        'Revisa el dashboard para confirmar capacidad y foco.',
        'Lanza una campana simple con una sola promesa fuerte.',
      ],
    };
  }

  return {
    title: 'Soporte general',
    message: 'Puedo ayudarte a diagnosticar facturacion, conexiones, rendimiento de campanas o pasos de onboarding. Cuanto mas concreta sea tu duda, mas accionable sera la respuesta.',
    nextSteps: [
      'Describe el problema y que estabas intentando hacer.',
      'Comparte si afecta pagos, conexiones, campanas o configuracion.',
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
      id: 'post-sale-welcome',
      name: 'Post-venta inmediata',
      audience: 'Clientes que acaban de pagar',
      trigger: 'Pago exitoso o upgrade',
      subject: 'Tu plan ya esta activo: aqui empieza tu implementacion en Nexora',
      preview: 'Refuerza confianza, explica que sigue y abre la puerta al soporte IA o humano.',
      cta: 'Abrir mi panel',
      replyTo,
    },
    {
      id: 'follow-up-3-days',
      name: 'Seguimiento a 3 dias',
      audience: 'Clientes nuevos sin suficiente avance',
      trigger: 'Dia 3 sin conectar cuentas o sin campanas activas',
      subject: 'Te ayudamos a sacar mas valor de Nexora esta semana',
      preview: 'Recordatorio consultivo con pasos simples para no perder momentum despues de la compra.',
      cta: 'Recibir ayuda en Nexora',
      replyTo,
    },
    {
      id: 'follow-up-7-days',
      name: 'Seguimiento de primera semana',
      audience: 'Clientes activos',
      trigger: 'Dia 7',
      subject: 'Tu primera semana en Nexora: que revisar ahora',
      preview: 'Resume progreso, propone siguiente accion y refuerza el uso del dashboard, radar y soporte.',
      cta: 'Ver mi progreso',
      replyTo,
    },
    {
      id: 'support-checkin',
      name: 'Check-in de soporte',
      audience: 'Clientes con dudas o uso bajo',
      trigger: 'Sin actividad relevante o ticket abierto',
      subject: 'Te ayudamos a destrabar tu operacion en Nexora',
      preview: 'Email de ayuda activa para reducir friccion y recuperar confianza despues de la venta.',
      cta: 'Hablar con soporte',
      replyTo,
    },
  ];
}

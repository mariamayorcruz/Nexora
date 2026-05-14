export type FollowUpTrigger = 'lead_followup' | 'on_signup' | 'after_signup';
export type LaunchBusinessType =
  | 'cleaning_company'
  | 'contractor'
  | 'coach'
  | 'med_spa'
  | 'real_estate'
  | 'insurance'
  | 'agency'
  | 'other_service_business';

export type LaunchMainGoal = 'get_more_leads' | 'close_more_clients' | 'automate_follow_up';
export type LaunchPreferredChannel = 'sms' | 'email' | 'phone' | 'mixed';

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

const BUSINESS_PROFILE_COPY: Record<
  LaunchBusinessType,
  {
    label: string;
    service: string;
    action: string;
    promise: string;
  }
> = {
  cleaning_company: {
    label: 'empresa de limpieza',
    service: 'cotización de limpieza',
    action: 'agendar una visita o enviar una cotización simple',
    promise: 'responder rápido y verse profesional desde el primer mensaje',
  },
  contractor: {
    label: 'contratista',
    service: 'estimado del proyecto',
    action: 'agendar una visita técnica o enviar un rango estimado',
    promise: 'dar claridad al lead sin perseguirlo manualmente',
  },
  coach: {
    label: 'coach',
    service: 'llamada de descubrimiento',
    action: 'agendar una llamada corta para validar objetivos',
    promise: 'hacer seguimiento con cercanía y constancia',
  },
  med_spa: {
    label: 'med spa',
    service: 'consulta o cita inicial',
    action: 'confirmar disponibilidad y recuperar consultas frías',
    promise: 'llenar agenda sin perder solicitudes por demora',
  },
  real_estate: {
    label: 'negocio inmobiliario',
    service: 'consulta de compra o propiedad',
    action: 'calificar interés y agendar seguimiento',
    promise: 'mover oportunidades con más velocidad y contexto',
  },
  insurance: {
    label: 'agencia de seguros',
    service: 'cotización de seguro',
    action: 'resolver dudas y enviar propuesta clara',
    promise: 'dar seguimiento sin dejar leads enfriarse',
  },
  agency: {
    label: 'agencia',
    service: 'llamada de discovery',
    action: 'detectar necesidad, presupuesto y siguiente paso',
    promise: 'mostrar orden, criterio y rapidez comercial',
  },
  other_service_business: {
    label: 'negocio de servicios',
    service: 'consulta inicial',
    action: 'responder con claridad y proponer siguiente paso',
    promise: 'proteger oportunidades que antes se escapaban',
  },
};

const GOAL_COPY: Record<LaunchMainGoal, string> = {
  get_more_leads: 'convertir más interés en conversaciones reales',
  close_more_clients: 'llevar más oportunidades hasta cierre',
  automate_follow_up: 'automatizar seguimiento sin perder el toque humano',
};

export function sanitizeSalesEngineCopy(value: string) {
  return value
    .replace(/Gracias por elegir GotNexora/gi, 'Gracias por crear tu acceso')
    .replace(/Seguimiento de tu solicitud en GotNexora/gi, 'Seguimiento de tu solicitud')
    .replace(/Equipo GotNexora/gi, 'Equipo de soporte')
    .replace(/Equipo Nexora/gi, 'Equipo de soporte')
    .replace(/Tu acceso a Nexora/gi, 'Tu acceso')
    .replace(/cuenta de Nexora/gi, 'tu cuenta')
    .replace(/Seguimiento Nexora/gi, 'Seguimiento de tu solicitud')
    .replace(/GotNexora/gi, 'la plataforma');
}

export function buildLaunchAssistantTemplates(params: {
  businessType: LaunchBusinessType;
  mainGoal: LaunchMainGoal;
  businessName: string;
  preferredChannels: LaunchPreferredChannel[];
}): FollowUpTemplate[] {
  const profile = BUSINESS_PROFILE_COPY[params.businessType] || BUSINESS_PROFILE_COPY.other_service_business;
  const goal = GOAL_COPY[params.mainGoal] || GOAL_COPY.get_more_leads;
  const businessName = params.businessName.trim() || 'tu negocio';
  const preferredChannels = params.preferredChannels.length > 0 ? params.preferredChannels.join(', ') : 'mixed';
  const contactHint =
    preferredChannels.includes('sms') || preferredChannels.includes('phone')
      ? 'Si te viene mejor, también podemos dejarlo por mensaje.'
      : 'Si prefieres, seguimos por este mismo correo.';

  return [
    {
      id: 'launch-first-response',
      name: 'Respuesta inicial recomendada',
      trigger: 'lead_followup',
      delayHours: 0,
      active: true,
      attachments: [],
      subject: `Gracias por escribir a ${businessName}`,
      body: `Hola {{name}},\n\nGracias por contactar a ${businessName}. Vi tu interés en ${profile.service}.\n\nNuestro siguiente paso ideal es ${profile.action}. La idea es ayudarte a ${goal} y que tengas claridad rápido.\n\n${contactHint}\n\nQuedo atento/a,\nEquipo de soporte`,
    },
    {
      id: 'launch-follow-up-reminder',
      name: 'Seguimiento corto 24h',
      trigger: 'lead_followup',
      delayHours: 24,
      active: true,
      attachments: [],
      subject: `Seguimiento rápido de ${businessName}`,
      body: `Hola {{name}},\n\nSolo te escribo para retomar tu interés en ${profile.service}.\n\nEn ${businessName} estamos trabajando para ${profile.promise}. Si aún quieres avanzar, podemos ${profile.action} hoy mismo.\n\nSi este no es el mejor momento, dime y te escribo después.\n\nEquipo de soporte`,
    },
    {
      id: 'launch-missed-lead-recovery',
      name: 'Recuperación de lead frío',
      trigger: 'lead_followup',
      delayHours: 72,
      active: true,
      attachments: [],
      subject: `¿Seguimos con esto?`,
      body: `Hola {{name}},\n\nNo quería dejar tu solicitud en el aire.\n\nMuchas veces el mayor problema no es la oferta, sino que nadie responde a tiempo. Por eso en ${businessName} buscamos ${goal} sin complicarte el proceso.\n\nSi todavía te interesa, responde este mensaje y retomamos desde donde lo dejamos.\n\nEquipo de soporte`,
    },
  ];
}

export const DEFAULT_FOLLOWUP_TEMPLATES: FollowUpTemplate[] = [
  {
    id: 'welcome-0h',
    name: 'Bienvenida inmediata',
    trigger: 'on_signup',
    delayHours: 0,
    active: true,
    attachments: [],
    subject: 'Tu acceso ya está listo, {{name}}',
    body:
      'Hola {{name}},\n\nGracias por crear tu acceso. Acabas de dar un paso grande para ordenar y escalar tus campañas.\n\nTu acceso ya está activo. Entra aquí para empezar: {{dashboard_url}}\n\nTe recomiendo este orden para tu primera victoria en menos de 30 minutos:\n1) Conecta tu primer canal (Meta, Google o TikTok).\n2) Crea tu primera campaña desde Command Center.\n3) Configura tu Motor de Ventas en CRM (calendar + enlaces).\n\nSi te atoras en algo, responde este correo y te ayudamos.\n\nBienvenida/o a bordo,\nEquipo de soporte',
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
      'Hola {{name}},\n\n¿Cómo va tu primer día con la plataforma?\n\nSi aún no arrancas, haz esto hoy:\n- Paso 1: conecta una cuenta publicitaria real.\n- Paso 2: publica una campaña con objetivo claro.\n- Paso 3: define follow-ups en CRM para cerrar más rápido.\n\nAcceso directo: {{dashboard_url}}\n\nCada paso que completes hoy reduce semanas de prueba y error.\n\nEstamos contigo,\nEquipo de soporte',
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
      'Hola {{name}},\n\nEn este punto la diferencia no está solo en anuncios, sino en el seguimiento comercial.\n\nTe sugerimos hoy:\n- Revisar leads en CRM.\n- Activar plantillas de follow-up por etapa.\n- Medir respuesta de tu secuencia.\n\nEntra aquí: {{dashboard_url}}\n\nTu pipeline mejora cuando marketing y ventas trabajan como un mismo sistema.\n\nEquipo de soporte',
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
      'Hola {{name}},\n\n¡Primera semana completada!\n\nChecklist de escala:\n- ¿Ya tienes al menos 1 canal conectado y activo?\n- ¿Tu CRM tiene secuencia de seguimiento configurada?\n- ¿Ya revisaste analíticas para optimizar presupuesto?\n\nPanel: {{dashboard_url}}\n\nSi quieres, te respondemos con recomendaciones sobre tu caso.\n\nEquipo de soporte',
  },
  {
    id: 'lead-first-touch',
    name: 'Primer contacto comercial',
    trigger: 'lead_followup',
    delayHours: 0,
    active: true,
    attachments: [],
    subject: 'Seguimiento de tu solicitud',
    body:
      'Hola {{name}},\n\nGracias por tu interés.\n\nHe revisado tu caso y hay oportunidades claras para mejorar resultados sin necesidad de aumentar presupuesto.\n\nEn una llamada de 15 minutos podemos darte claridad sobre qué mover primero para generar resultados más rápido.\n\nPara empezar a aplicar todo esto, puedes hacerlo aquí:',
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

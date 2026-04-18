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

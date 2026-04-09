import { BillingPlan, getBillingPlan } from '@/lib/billing';

export type AiToolKey =
  | 'ad-copy'
  | 'creative-brief'
  | 'video-edit'
  | 'ugc-script'
  | 'repurpose'
  | 'email-sequence';

export interface AiPlanConfig {
  monthlyCredits: number;
  bonusFounderCredits: number;
  canUseVideoTools: boolean;
  maxExportsPerRun: number;
  supportLabel: string;
}

export interface AiToolDefinition {
  key: AiToolKey;
  label: string;
  credits: number;
  description: string;
}

export const AI_PLAN_CONFIG: Record<BillingPlan, AiPlanConfig> = {
  starter: {
    monthlyCredits: 250,
    bonusFounderCredits: 500,
    canUseVideoTools: false,
    maxExportsPerRun: 2,
    supportLabel: 'IA base para validar ideas y producir piezas ligeras.',
  },
  professional: {
    monthlyCredits: 1800,
    bonusFounderCredits: 1200,
    canUseVideoTools: true,
    maxExportsPerRun: 4,
    supportLabel: 'Bolsa sólida para operar campañas activas durante todo el mes.',
  },
  enterprise: {
    monthlyCredits: 6500,
    bonusFounderCredits: 2500,
    canUseVideoTools: true,
    maxExportsPerRun: 8,
    supportLabel: 'Capacidad amplia para equipos intensivos en contenido, video y optimización.',
  },
};

export const AI_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    key: 'ad-copy',
    label: 'Anuncios y hooks',
    credits: 20,
    description: 'Genera hooks, titulares, claims y CTAs listos para Meta, Google o TikTok.',
  },
  {
    key: 'creative-brief',
    label: 'Brief creativo',
    credits: 35,
    description: 'Transforma una oferta o servicio en ángulos, pruebas y estructura narrativa.',
  },
  {
    key: 'video-edit',
    label: 'Edición de video',
    credits: 90,
    description: 'Convierte una idea en guion, escenas, tomas, overlays y llamados a la acción.',
  },
  {
    key: 'ugc-script',
    label: 'Guion UGC',
    credits: 45,
    description: 'Crea un guion vendedor con objeción, prueba, ritmo y CTA final.',
  },
  {
    key: 'repurpose',
    label: 'Repurpose multicanal',
    credits: 55,
    description: 'Toma una pieza y la baja a carrusel, reel, email, WhatsApp y landing.',
  },
  {
    key: 'email-sequence',
    label: 'Secuencia comercial',
    credits: 30,
    description: 'Escribe follow-ups, nurturing y recuperación con foco en cierre.',
  },
];

export function getAiPlanConfig(plan?: string | null, founderAccess = false) {
  const normalizedPlan = (getBillingPlan(plan)?.key || 'starter') as BillingPlan;
  const config = AI_PLAN_CONFIG[normalizedPlan];

  return {
    ...config,
    monthlyCredits: config.monthlyCredits + (founderAccess ? config.bonusFounderCredits : 0),
  };
}

export function getAiToolDefinition(tool: string) {
  return AI_TOOL_DEFINITIONS.find((item) => item.key === tool) || AI_TOOL_DEFINITIONS[0];
}

export function getCurrentCycleRange(referenceDate = new Date()) {
  const cycleStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const cycleEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const cycleKey = `${cycleStart.getFullYear()}-${String(cycleStart.getMonth() + 1).padStart(2, '0')}`;

  return { cycleKey, cycleStart, cycleEnd };
}

export function buildAiOutput(params: {
  tool: AiToolKey;
  prompt: string;
  offer: string;
  audience: string;
  channel: string;
}) {
  const { tool, prompt, offer, audience, channel } = params;
  const trimmedOffer = offer || 'tu servicio principal';
  const trimmedAudience = audience || 'tu audiencia ideal';
  const trimmedChannel = channel || 'paid media';
  const basePromise = `Ayuda a ${trimmedAudience} a avanzar con ${trimmedOffer}`;

  switch (tool) {
    case 'creative-brief':
      return {
        headline: `Brief listo para vender ${trimmedOffer} con una promesa clara`,
        bullets: [
          `Problema visible: ${trimmedAudience} siente fricción al intentar crecer sin sistema.`,
          `Promesa principal: ${basePromise} con más claridad, control y velocidad.`,
          `Prueba sugerida: mostrar antes y después, captura del dashboard o caso rápido.`,
          `Objeción a resolver: “ya probé otras herramientas y no tuve visibilidad real”.`,
          `CTA: invita a demo o prueba guiada con siguiente paso muy concreto.`,
        ],
        angle: `Usa ${trimmedChannel} para mostrar producto primero y beneficios después.`,
      };
    case 'video-edit':
      return {
        headline: `Edición comercial para video de ${trimmedOffer}`,
        bullets: [
          'Escena 1 (0-3s): abrir con dolor reconocible y promesa directa.',
          'Escena 2 (3-8s): mostrar dashboard, flujo o resultado real.',
          'Escena 3 (8-16s): resolver objeción con demostración concreta.',
          'Escena 4 (16-24s): CTA corto con urgencia suave y claridad.',
          'Overlay recomendado: tres frases máximas, tipografía limpia y prueba visible.',
        ],
        angle: `Prioriza ritmo corto, rostro humano y resultado tangible para ${trimmedAudience}.`,
      };
    case 'ugc-script':
      return {
        headline: `Guion UGC para ${trimmedOffer}`,
        bullets: [
          `Hook: “Si ${trimmedAudience} sigue haciendo esto así, está perdiendo margen”.`,
          `Contexto: mostrar una escena cotidiana donde el problema ya se note.`,
          `Prueba: enseñar cómo ${trimmedOffer} simplifica la operación o acelera resultados.`,
          'Cierre: reforzar control, tranquilidad y una acción específica.',
        ],
        angle: `Haz que suene nativo y conversacional, no como anuncio leído.`,
      };
    case 'repurpose':
      return {
        headline: `Repurpose multicanal desde una sola idea`,
        bullets: [
          `Reel: una objeción + una prueba + un CTA.`,
          `Carrusel: dolor, oportunidad, método, resultado y cierre.`,
          `Email: asunto corto, gancho rápido y CTA de respuesta.`,
          `WhatsApp: mensaje breve con valor, contexto y siguiente paso.`,
        ],
        angle: `Mantén la misma promesa en anuncio, landing y seguimiento para ${trimmedAudience}.`,
      };
    case 'email-sequence':
      return {
        headline: `Secuencia de seguimiento para ${trimmedOffer}`,
        bullets: [
          'Email 1: oportunidad y beneficio principal con CTA directo.',
          'Email 2: objeción más común y prueba o mini caso.',
          'Email 3: urgencia racional, siguiente paso y recordatorio simple.',
        ],
        angle: `Escribe como si estuvieras abriendo una conversación útil, no empujando una venta.`,
      };
    case 'ad-copy':
    default:
      return {
        headline: `Hooks y copies listos para ${trimmedOffer}`,
        bullets: [
          `Hook 1: “${trimmedAudience} no necesita más ruido; necesita una promesa más creíble.”`,
          `Hook 2: “Lo que más convierte hoy no es volumen, es claridad sobre el siguiente resultado.”`,
          `Hook 3: “Si ${trimmedOffer} todavía se explica demasiado, la creatividad está perdiendo atención.”`,
          `CTA: invita a prueba, demo o contacto con una acción única.`,
        ],
        angle: `${prompt || basePromise} enfocado en ${trimmedChannel}.`,
      };
  }
}

import { BillingPlan, getBillingPlan } from '@/lib/billing';

export type AiToolKey =
  | 'ad-copy'
  | 'creative-brief'
  | 'video-edit'
  | 'ugc-script'
  | 'repurpose'
  | 'email-sequence'
  | 'pitch-deck';

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

export interface AiOutputSlide {
  title: string;
  bullets: string[];
}

export interface AiOutputSection {
  title: string;
  items: string[];
}

export interface AiOutputPayload {
  headline: string;
  bullets: string[];
  angle: string;
  slides?: AiOutputSlide[];
  sections?: AiOutputSection[];
  cta?: string;
}

export const AI_PLAN_CONFIG: Record<BillingPlan, AiPlanConfig> = {
  starter: {
    monthlyCredits: 250,
    bonusFounderCredits: 500,
    canUseVideoTools: false,
    maxExportsPerRun: 2,
    supportLabel: 'IA base para validar ideas, mejorar mensajes y producir piezas ligeras.',
  },
  professional: {
    monthlyCredits: 1800,
    bonusFounderCredits: 1200,
    canUseVideoTools: true,
    maxExportsPerRun: 4,
    supportLabel: 'Bolsa sólida para operar campañas activas, presentaciones y contenido todo el mes.',
  },
  enterprise: {
    monthlyCredits: 6500,
    bonusFounderCredits: 2500,
    canUseVideoTools: true,
    maxExportsPerRun: 8,
    supportLabel: 'Capacidad amplia para equipos intensivos en contenido, pitch, video y optimización continua.',
  },
};

export const AI_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    key: 'ad-copy',
    label: 'Anuncios y hooks',
    credits: 20,
    description: 'Genera hooks, promesas, pruebas, guion visual y CTA listos para campañas serias.',
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
  {
    key: 'pitch-deck',
    label: 'Pitch deck o propuesta',
    credits: 70,
    description: 'Convierte una idea en una presentación clara, elegante y lista para vender.',
  },
];

function toTitleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeOffer(rawOffer: string) {
  const trimmed = rawOffer.trim();

  if (!trimmed) {
    return 'tu servicio principal';
  }

  if (/gotnexora\.com|nexora/i.test(trimmed)) {
    return 'Nexora';
  }

  return trimmed;
}

function inferCategory(offer: string) {
  if (/nexora/i.test(offer)) {
    return 'plataforma de marketing y ads';
  }

  return offer;
}

function buildInstagramAdCopy(params: {
  offer: string;
  audience: string;
  channel: string;
  prompt: string;
}) {
  const offer = normalizeOffer(params.offer);
  const audience = params.audience || 'equipos, negocios y marketers que quieren vender mejor';
  const category = inferCategory(offer);
  const channel = params.channel || 'Instagram';
  const prompt = params.prompt || '';
  const offerDisplay = toTitleCase(offer);
  const promise = /nexora/i.test(offer)
    ? 'centralizar campañas, creatividad, seguimiento comercial y decisiones de crecimiento en un solo sistema'
    : `hacer más simple y más rentable el crecimiento con ${offer}`;
  const proof = /nexora/i.test(offer)
    ? 'ves inversión, conversiones, ROI, leads y pipeline sin saltar entre herramientas'
    : 'el usuario siente más claridad, control y velocidad desde el primer uso';
  const urgency = /instagram/i.test(channel.toLowerCase())
    ? 'en Instagram gana quien hace entendible el resultado antes de pedir atención'
    : `en ${channel} gana quien reduce fricción y deja claro el siguiente resultado`;

  return {
    headline: `${offerDisplay}: anuncio experto listo para vender en ${channel}`,
    bullets: [
      `Hook premium 1: “Si tu marketing vive repartido en cinco herramientas, no estás creciendo: estás improvisando. ${offerDisplay} reúne campañas, datos y seguimiento en un solo sistema.”`,
      `Hook premium 2: “La mayoría no necesita más tráfico; necesita una operación que convierta la atención en decisiones y ventas. Ahí es donde ${offerDisplay} cambia el juego.”`,
      `Hook premium 3: “Cuando por fin ves anuncios, leads y pipeline en el mismo lugar, dejas de adivinar y empiezas a escalar con criterio.”`,
      `Promesa central: “${offerDisplay} ayuda a ${audience} a ${promise}. Deja de operar a ciegas y empieza a decidir con una lectura real del negocio.”`,
      `Copy principal: “${offerDisplay} no nació para sumar otra pestaña a tu operación. Nació para darle orden, velocidad y claridad a una parte del negocio que normalmente vive fragmentada. Si hoy inviertes en anuncios, generas contactos y aun así sientes que todo depende de intuición, ${offerDisplay} te devuelve control sobre lo que está funcionando y sobre lo que conviene hacer después.”`,
      `Prueba y credibilidad: “La ventaja real de ${offerDisplay} es que ${proof}. Eso baja el caos operativo, mejora la lectura del rendimiento y hace que cada campaña se sienta más accionable.”`,
      `Guion visual recomendado: abre con una escena de caos entre múltiples plataformas, corta a una vista limpia del dashboard, muestra una mejora visible y remata con una toma donde el usuario entiende qué hacer a continuación.`,
      `CTA experto: “Empieza tu prueba, agenda una demo y descubre cómo se ve una operación publicitaria cuando por fin trabaja como un sistema.”`,
      `Dirección estratégica: vende ${offerDisplay} como ${category} premium, no como software genérico. ${urgency}. ${prompt ? `Usa este matiz adicional como capa narrativa: ${prompt}.` : 'Prioriza claridad, autoridad y resultado visible antes que promesas genéricas.'}`,
    ],
    angle: `${offerDisplay} debe venderse como un sistema de control y crecimiento, no como otra herramienta más.`,
    cta: 'Empieza tu prueba o agenda una demo para ver cómo Nexora convierte claridad en decisiones más rentables.',
    sections: [
      {
        title: 'Primary text',
        items: [
          `${offerDisplay} ayuda a ${audience} a ${promise}. Si hoy inviertes en anuncios, generas contactos y aun así sientes que todo depende de intuición, ${offerDisplay} te devuelve control sobre lo que está funcionando y sobre lo que conviene hacer después.`,
        ],
      },
      {
        title: 'Headlines',
        items: [
          'Centraliza ads, leads y pipeline en un solo sistema',
          'Menos caos operativo. Más claridad para vender.',
          'Haz crecer tu operación con una lectura real del negocio',
        ],
      },
      {
        title: 'Visual direction',
        items: [
          'Escena 1: caos entre varias plataformas y reportes inconexos.',
          'Escena 2: vista limpia del dashboard de Nexora con métricas y leads visibles.',
          'Escena 3: enfoque en decisión concreta: qué pausar, qué escalar y a quién contactar.',
          'Escena 4: cierre con prueba gratuita o demo guiada.',
        ],
      },
      {
        title: 'Proof points',
        items: [
          proof,
          'Control comercial y operativo desde un solo panel.',
          'Más velocidad para ejecutar y más criterio para optimizar.',
        ],
      },
    ],
  };
}

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
}): AiOutputPayload {
  const { tool, prompt, offer, audience, channel } = params;
  const trimmedOffer = normalizeOffer(offer);
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
          'Objeción a resolver: “ya probé otras herramientas y no tuve visibilidad real”.',
          'CTA: invita a demo o prueba guiada con un siguiente paso muy concreto.',
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
        cta: `Cierra con una invitación breve a prueba, demo o activación guiada de ${trimmedOffer}.`,
        sections: [
          {
            title: 'Dirección de avatar',
            items: [
              'Profesional, confiable y orientado a resultados.',
              'Mirada directa a cámara con tono consultivo, no teatral.',
              'Fondo limpio de oficina o entorno premium relacionado con negocio.',
            ],
          },
          {
            title: 'Storyboard',
            items: [
              '0-3s: dolor visible y tensión operativa.',
              '3-8s: promesa concreta y por qué importa ahora.',
              '8-16s: demostración o recorrido por producto.',
              '16-24s: prueba, resultado o señal de credibilidad.',
              '24-30s: CTA con acción única.',
            ],
          },
          {
            title: 'Overlays en pantalla',
            items: [
              'Una sola idea por escena.',
              'Máximo 5 palabras por overlay.',
              'Usa contraste fuerte y prueba visual antes de claim abstracto.',
            ],
          },
        ],
      };
    case 'ugc-script':
      return {
        headline: `Guion UGC para ${trimmedOffer}`,
        bullets: [
          `Hook: “Si ${trimmedAudience} sigue haciendo esto así, está perdiendo margen”.`,
          'Contexto: muestra una escena cotidiana donde el problema ya se note.',
          `Prueba: enseña cómo ${trimmedOffer} simplifica la operación o acelera resultados.`,
          'Cierre: refuerza control, tranquilidad y una acción específica.',
        ],
        angle: 'Haz que suene nativo y conversacional, no como un anuncio leído.',
        sections: [
          {
            title: 'Estructura',
            items: [
              'Hook directo con objeción o dolor reconocible.',
              'Demostración breve de producto o experiencia.',
              'Resultado visible o alivio inmediato.',
              'CTA corto y claro.',
            ],
          },
        ],
      };
    case 'repurpose':
      return {
        headline: 'Repurpose multicanal desde una sola idea',
        bullets: [
          'Reel: una objeción, una prueba y un CTA.',
          'Carrusel: dolor, oportunidad, método, resultado y cierre.',
          'Email: asunto corto, gancho rápido y CTA de respuesta.',
          'WhatsApp: mensaje breve con valor, contexto y siguiente paso.',
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
        angle: 'Escribe como si abrieras una conversación útil, no como si empujaras una venta.',
      };
    case 'pitch-deck':
      return {
        headline: `Presentación lista para vender ${trimmedOffer}`,
        bullets: [
          'Abre con la oportunidad principal, no con contexto genérico.',
          'Muestra el problema, la solución, la prueba y el siguiente paso con una sola narrativa.',
          'Mantén una idea fuerte por slide para que la propuesta se entienda rápido.',
          'Cierra con una acción concreta: demo, llamada o aprobación.',
        ],
        angle: `Usa un tono claro, elegante y orientado a resultados para ${trimmedAudience}.`,
        cta: 'Cierra con una propuesta concreta y un siguiente paso fácil de aceptar.',
        slides: [
          {
            title: 'Portada y promesa',
            bullets: [
              `${trimmedOffer} en una frase clara.`,
              `Promesa principal para ${trimmedAudience}.`,
              'Resultado o mejora que se puede esperar.',
            ],
          },
          {
            title: 'Problema y contexto',
            bullets: [
              `Qué está frenando hoy a ${trimmedAudience}.`,
              'Costo de seguir igual.',
              'Por qué ahora es un buen momento para actuar.',
            ],
          },
          {
            title: 'Solución y enfoque',
            bullets: [
              `Cómo ${trimmedOffer} resuelve el problema.`,
              `Qué cambia en ${trimmedChannel} o en la operación comercial.`,
              'Qué hace más simple o más rápido.',
            ],
          },
          {
            title: 'Prueba y validación',
            bullets: [
              'Datos, ejemplos, capturas o señales de confianza.',
              'Comparativa antes y después.',
              'Objeción principal resuelta.',
            ],
          },
          {
            title: 'Oferta y siguiente paso',
            bullets: [
              'Qué incluye la propuesta.',
              'Qué plazo o formato de arranque se recomienda.',
              'CTA: demo, reunión o activación guiada.',
            ],
          },
        ],
      };
    case 'ad-copy':
    default:
      if (/instagram/i.test(trimmedChannel) || /nexora/i.test(trimmedOffer) || /gotnexora\.com/i.test(prompt)) {
        return buildInstagramAdCopy({
          offer: trimmedOffer,
          audience: trimmedAudience,
          channel: trimmedChannel,
          prompt,
        });
      }

      return {
        headline: `Hooks y copies listos para ${trimmedOffer}`,
        bullets: [
          `Hook 1: “${trimmedAudience} no compra más información; compra una promesa que se siente inevitable.”`,
          `Hook 2: “${trimmedOffer} vende mejor cuando se entiende qué cambia en la vida o en el negocio del cliente desde el primer impacto.”`,
          'Hook 3: “Si tu anuncio necesita demasiada explicación, está perdiendo a la gente correcta antes de mostrar la prueba.”',
          `Copy principal: presenta el dolor, nombra el cambio concreto y muestra por qué ${trimmedOffer} se siente diferente a la alternativa actual.`,
          'Prueba sugerida: usa una captura, resultado, comparativa o microdemostración antes del CTA.',
          'CTA: invita a una sola acción con bajo riesgo, alta claridad y una promesa concreta del siguiente paso.',
        ],
        angle: `${prompt || basePromise} enfocado en ${trimmedChannel}, con una narrativa más premium, más creíble y orientada a conversión.`,
        sections: [
          {
            title: 'Estructura recomendada',
            items: [
              'Hook de dolor o tensión real.',
              'Promesa concreta y entendible.',
              'Prueba o mecanismo.',
              'CTA con acción única.',
            ],
          },
        ],
      };
  }
}

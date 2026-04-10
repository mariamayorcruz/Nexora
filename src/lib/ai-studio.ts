import { BillingPlan, getBillingPlan } from '@/lib/billing';

export type AiToolKey =
  | 'ad-copy'
  | 'creative-brief'
  | 'avatar-video'
  | 'text-to-video'
  | 'image-to-video'
  | 'smart-edit'
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
  family?: 'copy' | 'video' | 'sales';
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
    family: 'copy',
  },
  {
    key: 'creative-brief',
    label: 'Brief creativo',
    credits: 35,
    description: 'Transforma una oferta o servicio en ángulos, pruebas y estructura narrativa.',
    family: 'copy',
  },
  {
    key: 'avatar-video',
    label: 'Avatar video',
    credits: 90,
    description: 'Prepara un video con avatar, voz, escenas, overlays y CTA listo para render.',
    family: 'video',
  },
  {
    key: 'text-to-video',
    label: 'Text to video',
    credits: 85,
    description: 'Convierte una idea o brief en secuencia visual generada desde texto.',
    family: 'video',
  },
  {
    key: 'image-to-video',
    label: 'Image to video',
    credits: 95,
    description: 'Toma una imagen base y la convierte en una pieza animada con dirección comercial.',
    family: 'video',
  },
  {
    key: 'smart-edit',
    label: 'Smart edit',
    credits: 75,
    description: 'Edita un video existente con IA: silencios, captions, música, ritmo y variantes.',
    family: 'video',
  },
  {
    key: 'ugc-script',
    label: 'Guion UGC',
    credits: 45,
    description: 'Crea un guion vendedor con objeción, prueba, ritmo y CTA final.',
    family: 'sales',
  },
  {
    key: 'repurpose',
    label: 'Repurpose multicanal',
    credits: 55,
    description: 'Toma una pieza y la baja a carrusel, reel, email, WhatsApp y landing.',
    family: 'sales',
  },
  {
    key: 'email-sequence',
    label: 'Secuencia comercial',
    credits: 30,
    description: 'Escribe follow-ups, nurturing y recuperación con foco en cierre.',
    family: 'sales',
  },
  {
    key: 'pitch-deck',
    label: 'Pitch deck o propuesta',
    credits: 70,
    description: 'Convierte una idea en una presentación clara, elegante y lista para vender.',
    family: 'sales',
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
  if (!trimmed) return 'tu servicio principal';
  if (/gotnexora\.com|nexora/i.test(trimmed)) return 'Nexora';
  return trimmed;
}

function inferCategory(offer: string) {
  if (/nexora/i.test(offer)) return 'plataforma de marketing y ads';
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
    ],
  };
}

function buildVideoStudioOutput(params: {
  tool: AiToolKey;
  offer: string;
  audience: string;
  channel: string;
  prompt: string;
  sourceAsset?: string;
  outputFormat?: string;
  captionStyle?: string;
}) {
  const offer = normalizeOffer(params.offer);
  const audience = params.audience || 'tu audiencia ideal';
  const channel = params.channel || 'video';
  const sourceAsset = params.sourceAsset || 'sin asset especificado';
  const outputFormat = params.outputFormat || 'vertical 9:16';
  const captionStyle = params.captionStyle || 'bold clean';

  const commonSections: AiOutputSection[] = [
    {
      title: 'Creative direction',
      items: [
        `Audiencia principal: ${audience}.`,
        `Formato recomendado: ${outputFormat}.`,
        `Canal objetivo: ${channel}.`,
      ],
    },
    {
      title: 'Delivery checklist',
      items: [
        'Abre con dolor o tensión en los primeros 2 segundos.',
        'Muestra mecanismo o producto antes del segundo 8.',
        'Cierra con una sola acción y sin CTA ambiguo.',
      ],
    },
  ];

  if (params.tool === 'avatar-video') {
    return {
      headline: `Avatar video listo para producir sobre ${offer}`,
      bullets: [
        'Hook con autoridad tranquila y promesa clara.',
        'Presentación con avatar profesional y ritmo de venta consultiva.',
        'Escenas cortas con prueba visible y CTA final único.',
      ],
      angle: `El avatar debe vender ${offer} como una solución seria, visible y fácil de entender para ${audience}.`,
      cta: `Termina invitando a demo, prueba o contacto directo con una sola acción.`,
      sections: [
        {
          title: 'Avatar setup',
          items: [
            'Avatar ejecutivo, confiable y moderno.',
            'Voz en español neutro con ritmo ágil.',
            'Fondo premium alineado con la categoría del negocio.',
          ],
        },
        {
          title: 'Storyboard',
          items: [
            '0-3s: problema visible y costo de seguir igual.',
            '3-8s: promesa concreta y por qué importa hoy.',
            '8-16s: recorrido visual o demostración del producto.',
            '16-25s: prueba, alivio o señal de credibilidad.',
            '25-35s: CTA limpio y accionable.',
          ],
        },
        ...commonSections,
      ],
    };
  }

  if (params.tool === 'text-to-video') {
    return {
      headline: `Text-to-video para ${offer}`,
      bullets: [
        'Secuencia visual generada a partir del prompt principal.',
        'Cadencia de escenas pensada para ads y reels.',
        'Narrativa visual construida desde beneficio, prueba y CTA.',
      ],
      angle: `El video debe sentirse aspiracional, claro y orientado a conversión para ${audience}.`,
      cta: 'Cierra con una invitación concreta a probar, reservar demo o solicitar más información.',
      sections: [
        {
          title: 'Prompt master',
          items: [
            params.prompt || `Construye una pieza visual de alto impacto para vender ${offer}.`,
            'Mantén estética limpia, moderna y pensada para performance.',
          ],
        },
        {
          title: 'Scene map',
          items: [
            'Escena 1: captar atención con tensión o contraste.',
            'Escena 2: introducir la oportunidad o el cambio.',
            'Escena 3: mostrar mecanismo o transformación.',
            'Escena 4: aterrizar prueba y cierre.',
          ],
        },
        ...commonSections,
      ],
    };
  }

  if (params.tool === 'image-to-video') {
    return {
      headline: `Image-to-video para ${offer}`,
      bullets: [
        'Animación comercial pensada desde una imagen base.',
        'Movimiento suave, foco en producto y ritmo de conversión.',
        'Versión preparada para reel, story o anuncio corto.',
      ],
      angle: `La imagen base debe evolucionar a una pieza dinámica que haga más entendible el valor de ${offer}.`,
      cta: 'Cierra con CTA de prueba, contacto o demostración.',
      sections: [
        {
          title: 'Source image',
          items: [
            `Asset base: ${sourceAsset}.`,
            'Usa una imagen con producto, rostro o resultado visible.',
          ],
        },
        {
          title: 'Motion plan',
          items: [
            'Entrada con push-in o paneo ligero.',
            'Foco en el elemento principal del frame.',
            'Salida con texto de cierre y CTA.',
          ],
        },
        ...commonSections,
      ],
    };
  }

  return {
    headline: `Smart edit para ${offer}`,
    bullets: [
      'Corte inteligente de silencios y pausas débiles.',
      'Captions automáticos con estilos orientados a performance.',
      'Sugerencia de música, ritmo, highlights y variantes de salida.',
    ],
    angle: `La edición debe hacer que el video se sienta más corto, más claro y más vendedor para ${audience}.`,
    cta: 'Exporta una versión principal y una variante con hook más agresivo para test A/B.',
    sections: [
      {
        title: 'Edit operations',
        items: [
          'Eliminar silencios largos y respiraciones innecesarias.',
          'Acelerar bloques lentos sin perder naturalidad.',
          'Detectar frases fuertes para convertirlas en hook o opener.',
          'Preparar cortes para formatos vertical y horizontal.',
        ],
      },
      {
        title: 'Caption system',
        items: [
          `Estilo sugerido: ${captionStyle}.`,
          'Generar captions automáticos con resaltado de palabras clave.',
          'Crear al menos 3 estilos: clean, ads bold y creator native.',
        ],
      },
      {
        title: 'Media layer',
        items: [
          `Asset a editar: ${sourceAsset}.`,
          'Música suave con energía comercial.',
          'Hooks alternativos para opening de 2 segundos.',
        ],
      },
      ...commonSections,
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
  sourceAsset?: string;
  outputFormat?: string;
  captionStyle?: string;
}): AiOutputPayload {
  const { tool, prompt, offer, audience, channel, sourceAsset, outputFormat, captionStyle } = params;
  const trimmedOffer = normalizeOffer(offer);
  const trimmedAudience = audience || 'tu audiencia ideal';
  const trimmedChannel = channel || 'paid media';
  const basePromise = `Ayuda a ${trimmedAudience} a avanzar con ${trimmedOffer}`;

  if (tool === 'avatar-video' || tool === 'text-to-video' || tool === 'image-to-video' || tool === 'smart-edit') {
    return buildVideoStudioOutput({
      tool,
      offer: trimmedOffer,
      audience: trimmedAudience,
      channel: trimmedChannel,
      prompt,
      sourceAsset,
      outputFormat,
      captionStyle,
    });
  }

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

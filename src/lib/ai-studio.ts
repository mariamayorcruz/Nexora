import { BillingPlan, getBillingPlan } from '@/lib/billing';

export type AiToolKey =
  | 'ad-copy'
  | 'creative-brief'
  | 'ugc-script'
  | 'repurpose'
  | 'email-sequence'
  | 'pitch-deck';

export type ContentTone =
  | 'viral-aggressive'
  | 'story-relaxed'
  | 'ceo-direct'
  | 'gen-z-raw'
  | 'curiosity-gap'
  | 'pain-pleasure';

export type ContentFormat = 'hook-3s' | 'full-script' | 'storyboard' | 'caption-only';
export type ContentPlatform = 'instagram-reels' | 'tiktok' | 'youtube-shorts';

export interface GenerationConfig {
  tone: ContentTone;
  format: ContentFormat;
  platform: ContentPlatform;
  duration: 15 | 30 | 60;
}

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
  family?: 'copy' | 'sales';
}

export interface AiOutputSlide {
  title: string;
  bullets: string[];
}

export interface AiOutputSection {
  title: string;
  items: string[];
}

export interface AiStoryboardBeat {
  id: 'hook' | 'conflict' | 'resolution' | 'cta';
  label: string;
  timeLabel: string;
  startSec: number;
  endSec: number;
  text: string;
  visual: string;
}

export interface AiOutputPayload {
  headline: string;
  bullets: string[];
  angle: string;
  slides?: AiOutputSlide[];
  sections?: AiOutputSection[];
  cta?: string;
  beats?: AiStoryboardBeat[];
  generationConfig?: GenerationConfig;
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
    canUseVideoTools: false,
    maxExportsPerRun: 4,
    supportLabel: 'Bolsa sólida para campañas activas, guiones, propuestas y activos comerciales.',
  },
  enterprise: {
    monthlyCredits: 6500,
    bonusFounderCredits: 2500,
    canUseVideoTools: false,
    maxExportsPerRun: 8,
    supportLabel: 'Capacidad amplia para equipos intensivos en contenido, pitch, seguimiento y optimización.',
  },
};

export const AI_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    key: 'ad-copy',
    label: 'Anuncios y hooks',
    credits: 20,
    description: 'Genera hooks, promesas, pruebas y CTA listos para campañas serias.',
    family: 'copy',
  },
  {
    key: 'creative-brief',
    label: 'Brief creativo',
    credits: 35,
    description: 'Transforma una oferta o servicio en ángulos, objeciones y estructura narrativa.',
    family: 'copy',
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
    description: 'Toma una idea y la baja a reel, carrusel, email, WhatsApp y landing.',
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

function clampDuration(value?: number): 15 | 30 | 60 {
  if (value === 60) return 60;
  if (value === 15) return 15;
  return 30;
}

function normalizeTone(value?: string): ContentTone {
  const allowed: ContentTone[] = [
    'viral-aggressive',
    'story-relaxed',
    'ceo-direct',
    'gen-z-raw',
    'curiosity-gap',
    'pain-pleasure',
  ];

  return allowed.includes(value as ContentTone) ? (value as ContentTone) : 'viral-aggressive';
}

function normalizeFormat(value?: string): ContentFormat {
  const allowed: ContentFormat[] = ['hook-3s', 'full-script', 'storyboard', 'caption-only'];
  return allowed.includes(value as ContentFormat) ? (value as ContentFormat) : 'full-script';
}

function normalizePlatform(value?: string): ContentPlatform {
  const allowed: ContentPlatform[] = ['instagram-reels', 'tiktok', 'youtube-shorts'];
  return allowed.includes(value as ContentPlatform) ? (value as ContentPlatform) : 'instagram-reels';
}

function buildGenerationConfig(input?: Partial<GenerationConfig>): GenerationConfig {
  return {
    tone: normalizeTone(input?.tone),
    format: normalizeFormat(input?.format),
    platform: normalizePlatform(input?.platform),
    duration: clampDuration(input?.duration),
  };
}

function getBeatWindows(duration: 15 | 30 | 60) {
  if (duration === 15) {
    return {
      hook: [0, 3],
      conflict: [3, 8],
      resolution: [8, 12],
      cta: [12, 15],
    } as const;
  }

  if (duration === 60) {
    return {
      hook: [0, 5],
      conflict: [5, 18],
      resolution: [18, 48],
      cta: [48, 60],
    } as const;
  }

  return {
    hook: [0, 3],
    conflict: [3, 10],
    resolution: [10, 24],
    cta: [24, 30],
  } as const;
}

function buildToneLines(params: {
  offer: string;
  audience: string;
  prompt: string;
  tone: ContentTone;
  platform: ContentPlatform;
}) {
  const offer = params.offer;
  const audience = params.audience;
  const promptHint = params.prompt || 'tu equipo sigue trabajando a ciegas';

  const maps: Record<ContentTone, { hook: string; conflict: string; resolution: string; cta: string; angle: string }> = {
    'viral-aggressive': {
      hook: `Si sigues asi, ${audience} te ignora.`,
      conflict: `Estás perdiendo atención por sonar igual que todos en ${offer}.`,
      resolution: `${offer} te deja mostrar el dato, el mensaje y el cierre en un solo flujo.`,
      cta: 'Guarda esto y pruebalo hoy.',
      angle: 'Provocacion controlada con golpe directo al costo de seguir igual.',
    },
    'story-relaxed': {
      hook: 'Ayer nos pasó algo ridículo.',
      conflict: `Seguíamos ${promptHint} y nadie veía dónde se estaba rompiendo el proceso.`,
      resolution: `Con ${offer} se ordenó el seguimiento y por fin todo empezó a caer en su sitio.`,
      cta: 'Compártelo con tu equipo.',
      angle: 'Storytelling suave con cierre práctico y cercano.',
    },
    'ceo-direct': {
      hook: '3 errores te están costando pipeline.',
      conflict: `Uno: no ves datos. Dos: el mensaje llega tarde. Tres: ${audience} ya no espera.`,
      resolution: `${offer} junta campañas, CRM y seguimiento para que dejes de improvisar.`,
      cta: 'Haz auditoría y corrígelo hoy.',
      angle: 'CEO directo, sin relleno y con tensión de negocio.',
    },
    'gen-z-raw': {
      hook: 'POV: sigues cerrando ventas desde Excel 😬',
      conflict: `Literalmente ${audience} ya huele cuando una marca todavía va tarde con todo.`,
      resolution: `${offer} conecta mensajes, leads y seguimiento en un solo lugar.`,
      cta: 'Guárdalo para tu próximo reel.',
      angle: 'Nativo social, ritmo rápido y vocabulario creador sin sonar infantil.',
    },
    'curiosity-gap': {
      hook: 'La forma rara de recuperar ventas perdidas.',
      conflict: `Nadie te dice que el problema casi nunca es el anuncio; es lo que pasa después.`,
      resolution: `Con ${offer} ves qué mensaje entra, quién responde y dónde se cae el cierre.`,
      cta: 'Comenta si quieres la parte 2.',
      angle: 'Curiosity gap con información retenida hasta la resolución.',
    },
    'pain-pleasure': {
      hook: 'Imagina vender sin perseguir a nadie.',
      conflict: `Ahora mismo ${audience} vive apagando fuegos, contestando tarde y perdiendo contexto.`,
      resolution: `${offer} devuelve control, claridad y seguimiento sin fricción diaria.`,
      cta: 'Guárdalo y vuelve a verlo.',
      angle: 'Transición clara de dolor actual a alivio inmediato.',
    },
  };

  const selected = maps[params.tone];
  const platformVisual =
    params.platform === 'tiktok'
      ? 'Plano selfie con texto grande y gesto directo a cámara.'
      : params.platform === 'youtube-shorts'
      ? 'Plano medio con cortes rápidos y caption centrado.'
      : 'Plano vertical tipo Reel con subtítulo fuerte en pantalla.';

  return {
    ...selected,
    visuals: {
      hook: platformVisual,
      conflict: 'Cambio rápido a pantalla saturada, inbox o tablero con ruido visual.',
      resolution: `Demo corta mostrando ${offer} resolviendo el caos en segundos.`,
      cta: 'Flecha al botón de guardar o comentario con gesto explícito.',
    },
  };
}

function buildStructuredSocialOutput(params: {
  offer: string;
  audience: string;
  prompt: string;
  config: GenerationConfig;
}): AiOutputPayload {
  const offer = normalizeOffer(params.offer);
  const audience = params.audience || 'tu equipo';
  const config = buildGenerationConfig(params.config);
  const windows = getBeatWindows(config.duration);
  const lines = buildToneLines({
    offer,
    audience,
    prompt: params.prompt,
    tone: config.tone,
    platform: config.platform,
  });

  const beats: AiStoryboardBeat[] = [
    {
      id: 'hook',
      label: 'HOOK',
      timeLabel: `${windows.hook[0]}-${windows.hook[1]}s`,
      startSec: windows.hook[0],
      endSec: windows.hook[1],
      text: lines.hook,
      visual: lines.visuals.hook,
    },
    {
      id: 'conflict',
      label: 'CONFLICTO',
      timeLabel: `${windows.conflict[0]}-${windows.conflict[1]}s`,
      startSec: windows.conflict[0],
      endSec: windows.conflict[1],
      text: lines.conflict,
      visual: lines.visuals.conflict,
    },
    {
      id: 'resolution',
      label: 'RESOLUCION',
      timeLabel: `${windows.resolution[0]}-${windows.resolution[1]}s`,
      startSec: windows.resolution[0],
      endSec: windows.resolution[1],
      text: lines.resolution,
      visual: lines.visuals.resolution,
    },
    {
      id: 'cta',
      label: 'CTA',
      timeLabel: `${windows.cta[0]}-${windows.cta[1]}s`,
      startSec: windows.cta[0],
      endSec: windows.cta[1],
      text: lines.cta,
      visual: lines.visuals.cta,
    },
  ];

  const visibleBeats = config.format === 'hook-3s' ? beats.slice(0, 1) : beats;

  return {
    headline: visibleBeats[0].text,
    bullets: visibleBeats.map((beat) => `${beat.timeLabel}: ${beat.text}`),
    angle: lines.angle,
    cta: lines.cta,
    beats: visibleBeats,
    generationConfig: config,
    sections:
      config.format === 'caption-only'
        ? [
            {
              title: 'Caption sugerido',
              items: beats.map((beat) => beat.text),
            },
          ]
        : visibleBeats.map((beat) => ({
            title: `${beat.label} · ${beat.timeLabel}`,
            items: [beat.text, beat.visual],
          })),
  };
}

function pickDifferentOption(options: string[], current?: string) {
  const filtered = current ? options.filter((option) => option !== current) : options;
  const source = filtered.length > 0 ? filtered : options;
  return source[Math.floor(Math.random() * source.length)] || current || options[0] || '';
}

function buildBeatVariantOptions(params: {
  tone: ContentTone;
  beatId: AiStoryboardBeat['id'];
  offer: string;
  audience: string;
}) {
  const { tone, beatId, offer, audience } = params;

  const map: Record<ContentTone, Record<AiStoryboardBeat['id'], string[]>> = {
    'viral-aggressive': {
      hook: [
        `Si sigues así, ${audience} te ignora.`,
        `Tu mensaje se está muriendo en frío.`,
        `La gente correcta ya no espera más.`,
      ],
      conflict: [
        `Tu marca suena igual que todas cuando habla de ${offer}.`,
        `El problema no es publicar más; es sonar irrelevante al segundo uno.`,
        `Cada scroll sin tensión es dinero que se pierde en silencio.`,
      ],
      resolution: [
        `${offer} convierte caos comercial en una narrativa que sí cierra.`,
        `${offer} alinea mensaje, lead y seguimiento en un mismo movimiento.`,
        `${offer} te deja entrar con claridad y salir con acción.`,
      ],
      cta: ['Guárdalo y pruébalo hoy.', 'Comenta si quieres la versión 2.', 'Compártelo con tu equipo.'],
    },
    'story-relaxed': {
      hook: ['Te cuento algo que nos pasó ayer.', 'Esto empezó con un error pequeño.', 'Pensábamos que el problema era otro.'],
      conflict: [
        `Seguíamos perdiendo contexto justo cuando ${audience} más rápido debía reaccionar.`,
        `Todo parecía normal hasta que vimos dónde se rompía la conversación.`,
        `Nadie estaba viendo el mismo tablero al mismo tiempo.`,
      ],
      resolution: [
        `Con ${offer} por fin todo cayó en el mismo lugar.`,
        `${offer} nos devolvió orden y una respuesta mucho más rápida.`,
        `Cuando ${offer} entró al flujo, el equipo dejó de improvisar.`,
      ],
      cta: ['Guárdalo para verlo luego.', 'Envíalo a quien necesite orden.', 'Si te resonó, compártelo.'],
    },
    'ceo-direct': {
      hook: ['3 errores te están costando pipeline.', 'El dato incómodo: sigues tarde.', 'Esto te está costando más de lo que crees.'],
      conflict: [
        `Marketing y ventas siguen sin compartir un mismo contexto real.`,
        `Tu operación está reaccionando tarde a señales que ya existen.`,
        `El dinero se pierde donde nadie está mirando.`,
      ],
      resolution: [
        `${offer} junta dato, mensaje y seguimiento sin relleno.`,
        `${offer} recorta la fricción donde hoy se te escapa margen.`,
        `${offer} pone el control donde antes había suposiciones.`,
      ],
      cta: ['Haz auditoría hoy.', 'Guarda esto y ejecútalo.', 'Compártelo con tu responsable comercial.'],
    },
    'gen-z-raw': {
      hook: ['POV: sigues cerrando ventas desde Excel 😬', 'Literalmente esto te está frenando.', 'Plot twist: no era falta de leads.'],
      conflict: [
        `${audience} nota al segundo cuando sigues improvisando.`,
        `No es por asustarte, pero el caos ya se te nota.`,
        `El problema no era el anuncio, era todo lo que venía después.`,
      ],
      resolution: [
        `${offer} conecta todo y deja de verse improvisado.`,
        `${offer} te da contexto en tiempo real sin cambiar de app.`,
        `${offer} ordena mensaje, leads y cierre en un solo lugar.`,
      ],
      cta: ['Guárdalo para tu próximo reel.', 'Comenta si quieres plantilla.', 'Mándaselo a tu socio.'],
    },
    'curiosity-gap': {
      hook: ['La forma rara de recuperar ventas.', 'Lo que nadie te cuenta del cierre.', 'Hicimos esto sin subir presupuesto.'],
      conflict: [
        `El problema real casi nunca es donde todo el mundo está mirando.`,
        `Hay una fuga silenciosa que no aparece en el anuncio.`,
        `El dato importante está escondido justo después del clic.`,
      ],
      resolution: [
        `${offer} te muestra el tramo oculto donde se pierde la venta.`,
        `${offer} conecta el antes y el después del anuncio.`,
        `${offer} deja visible el punto exacto donde se cae el cierre.`,
      ],
      cta: ['Comenta “parte 2”.', 'Guárdalo y vuelve luego.', 'Comparte si quieres el desglose completo.'],
    },
    'pain-pleasure': {
      hook: ['Imagina vender sin perseguir a nadie.', 'Despertar sin caos comercial sí existe.', 'Piensa en cerrar sin apagar fuegos.'],
      conflict: [
        `${audience} sigue cargando fricción, retrasos y cero visibilidad.`,
        `Ahora mismo todo depende de recordar, revisar y perseguir.`,
        `Ese desgaste diario también te está costando dinero.`,
      ],
      resolution: [
        `${offer} cambia desgaste por control y seguimiento claro.`,
        `${offer} convierte fricción diaria en un flujo mucho más limpio.`,
        `${offer} le devuelve aire al equipo y velocidad al cierre.`,
      ],
      cta: ['Guárdalo si quieres más paz.', 'Compártelo con tu equipo.', 'Vuelve a esto cuando quieras orden.'],
    },
  };

  return map[tone][beatId];
}

export function regenerateAiOutputBeat(params: {
  output: AiOutputPayload;
  target: AiStoryboardBeat['id'];
  offer: string;
  audience: string;
}): AiOutputPayload {
  const config = buildGenerationConfig(params.output.generationConfig);
  const beats = params.output.beats || [];

  const nextBeats = beats.map((beat) => {
    if (beat.id !== params.target) {
      return beat;
    }

    const textOptions = buildBeatVariantOptions({
      tone: config.tone,
      beatId: beat.id,
      offer: normalizeOffer(params.offer),
      audience: params.audience || 'tu equipo',
    });

    const visualOptions = [
      'Primer plano vertical con subtitulo grande y gesto a cámara.',
      'Corte rápido a dashboard, inbox o tablero con tensión visual.',
      'Plano selfie con texto en pantalla y señalando el caption.',
    ];

    return {
      ...beat,
      text: pickDifferentOption(textOptions, beat.text),
      visual: pickDifferentOption(visualOptions, beat.visual),
    };
  });

  return {
    ...params.output,
    headline: nextBeats[0]?.text || params.output.headline,
    bullets: nextBeats.map((beat) => `${beat.timeLabel}: ${beat.text}`),
    beats: nextBeats,
    sections: nextBeats.map((beat) => ({
      title: `${beat.label} · ${beat.timeLabel}`,
      items: [beat.text, beat.visual],
    })),
    cta: nextBeats.find((beat) => beat.id === 'cta')?.text || params.output.cta,
  };
}

function buildInstagramAdCopy(params: {
  offer: string;
  audience: string;
  channel: string;
  prompt: string;
}): AiOutputPayload {
  const offer = normalizeOffer(params.offer);
  const audience = params.audience || 'equipos, negocios y marketers que quieren vender mejor';
  const category = inferCategory(offer);
  const channel = params.channel || 'Instagram';
  const prompt = params.prompt || '';
  const offerDisplay = toTitleCase(offer);
  const promise = /nexora/i.test(offer)
    ? 'centralizar campañas, CRM, funnel y decisiones comerciales en un solo sistema'
    : `hacer más simple y más rentable el crecimiento con ${offer}`;
  const proof = /nexora/i.test(offer)
    ? 'ves inversión, conversiones, leads y pipeline sin saltar entre herramientas'
    : 'el usuario siente más claridad, control y velocidad desde el primer uso';
  const wantsWalkthrough = /bluehost|ecommerce|tienda|woocommerce|setup|paso a paso|onboarding/i.test(
    `${prompt} ${offer} ${channel}`
  );

  if (wantsWalkthrough) {
    return {
      headline: `${offerDisplay}: anuncio tipo walkthrough para ${channel}`,
      bullets: [
        `Hook 1: "Deja de complicar tu setup: en menos de 30 segundos ves tu tienda en vivo."`,
        `Hook 2: "${offerDisplay} te lleva de configuracion a venta con pasos claros, sin friccion tecnica."`,
        `Promesa: tutorial visual por pasos que muestra progreso real en pantalla.`,
        `Prueba sugerida: capturas del flujo (configuracion -> productos -> pago -> sitio live).`,
        'CTA: compra, prueba o agenda demo con una accion unica y directa.',
      ],
      angle:
        prompt ||
        `Narrativa de onboarding guiado para ${audience}. Mostrar avance paso a paso y terminar con una accion inmediata.`,
      sections: [
        {
          title: 'Storyboard recomendado (reel 20-30s)',
          items: [
            'Escena 1 (0-3s): dolor -> "deja de complicar tu ecommerce".',
            'Escena 2 (3-10s): elegir tipo de negocio y setup inicial.',
            'Escena 3 (10-18s): agregar productos y activar pagos.',
            'Escena 4 (18-24s): cambiar estado a live y mostrar panel final.',
            'Escena 5 (24-30s): CTA corto con accion unica (comprar/demo/probar).',
          ],
        },
      ],
      cta: 'Cierra con una accion unica: comprar, probar o agendar demo.',
    };
  }

  return {
    headline: `${offerDisplay}: anuncio experto listo para vender en ${channel}`,
    bullets: [
      `Hook 1: “Si ${audience} sigue operando sin sistema, está perdiendo margen antes de darse cuenta.”`,
      `Hook 2: “${offerDisplay} no vende más cuando explica más; vende más cuando deja claro qué cambia desde el primer impacto.”`,
      `Promesa: ${promise}.`,
      `Prueba sugerida: ${proof}.`,
      'CTA: agenda demo, prueba o diagnóstico con un siguiente paso simple.',
    ],
    angle: prompt || `Vender ${category} con una narrativa clara, premium y orientada a conversión.`,
    sections: [
      {
        title: 'Framework',
        items: [
          'Abre con dolor o fricción real.',
          'Muestra el cambio concreto.',
          'Introduce la prueba o mecanismo.',
          'Cierra con una sola acción.',
        ],
      },
    ],
    cta: 'Invita a una sola acción clara y de bajo riesgo.',
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
  tone?: ContentTone;
  format?: ContentFormat;
  platform?: ContentPlatform;
  duration?: 15 | 30 | 60;
  sourceAsset?: string;
  outputFormat?: string;
  captionStyle?: string;
  smartEditOptions?: unknown;
}): AiOutputPayload {
  const { tool, prompt, offer, audience, channel } = params;
  const trimmedOffer = normalizeOffer(offer);
  const trimmedAudience = audience || 'tu audiencia ideal';
  const trimmedChannel = channel || 'paid media';
  const basePromise = `Ayuda a ${trimmedAudience} a avanzar con ${trimmedOffer}`;
  const generationConfig = buildGenerationConfig({
    tone: params.tone,
    format: params.format,
    platform: params.platform,
    duration: params.duration,
  });

  switch (tool) {
    case 'creative-brief':
      return {
        headline: `Brief listo para vender ${trimmedOffer} con una promesa clara`,
        bullets: [
          `Problema visible: ${trimmedAudience} siente fricción al intentar crecer sin sistema.`,
          `Promesa principal: ${basePromise} con más claridad, control y velocidad.`,
          'Prueba sugerida: mostrar antes y después, una captura o un caso corto.',
          'Objeción a resolver: “ya probé otras herramientas y no tuve visibilidad real”.',
          'CTA: invita a demo o prueba guiada con un siguiente paso muy concreto.',
        ],
        angle: `Usa ${trimmedChannel} para mostrar producto primero y beneficios después.`,
      };
    case 'ugc-script':
      return buildStructuredSocialOutput({
        offer: trimmedOffer,
        audience: trimmedAudience,
        prompt,
        config: generationConfig,
      });
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
      if (generationConfig.format || generationConfig.tone || generationConfig.platform) {
        return buildStructuredSocialOutput({
          offer: trimmedOffer,
          audience: trimmedAudience,
          prompt,
          config: generationConfig,
        });
      }

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

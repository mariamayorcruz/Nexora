import { BillingPlan, getBillingPlan } from '@/lib/billing';

const AI_STUDIO_MODEL = 'claude-haiku-4-5';

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

function extractLlmJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function normalizeLlmAiOutputPayload(
  parsed: unknown,
  generationConfig: GenerationConfig
): AiOutputPayload | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const headline = String(o.headline || '').trim();
  if (!headline) return null;

  let bullets = Array.isArray(o.bullets)
    ? o.bullets.map((b) => String(b || '').trim()).filter(Boolean)
    : [];

  const slides: AiOutputSlide[] = Array.isArray(o.slides)
    ? o.slides
        .map((s) => {
          if (!s || typeof s !== 'object') return null;
          const x = s as Record<string, unknown>;
          const title = String(x.title || '').trim();
          const bl = Array.isArray(x.bullets)
            ? x.bullets.map((b) => String(b || '').trim()).filter(Boolean)
            : [];
          if (!title && !bl.length) return null;
          return { title: title || 'Slide', bullets: bl };
        })
        .filter((x): x is AiOutputSlide => Boolean(x))
    : [];

  const sections: AiOutputSection[] = Array.isArray(o.sections)
    ? o.sections
        .map((s) => {
          if (!s || typeof s !== 'object') return null;
          const x = s as Record<string, unknown>;
          const title = String(x.title || '').trim();
          const items = Array.isArray(x.items)
            ? x.items.map((i) => String(i || '').trim()).filter(Boolean)
            : [];
          if (!title && !items.length) return null;
          return { title: title || 'Sección', items };
        })
        .filter((x): x is AiOutputSection => Boolean(x))
    : [];

  const beatIds = new Set(['hook', 'conflict', 'resolution', 'cta']);
  const beats: AiStoryboardBeat[] = Array.isArray(o.beats)
    ? o.beats
        .map((b) => {
          if (!b || typeof b !== 'object') return null;
          const x = b as Record<string, unknown>;
          const id = String(x.id || '');
          if (!beatIds.has(id)) return null;
          return {
            id: id as AiStoryboardBeat['id'],
            label: String(x.label || '').trim() || id.toUpperCase(),
            timeLabel: String(x.timeLabel || '').trim(),
            startSec: Number(x.startSec) || 0,
            endSec: Number(x.endSec) || 0,
            text: String(x.text || '').trim(),
            visual: String(x.visual || '').trim(),
          };
        })
        .filter((x): x is AiStoryboardBeat => Boolean(x))
    : [];

  if (!bullets.length && slides.length) {
    bullets = slides.flatMap((s) => [s.title, ...s.bullets]).filter(Boolean).slice(0, 16);
  }
  if (!bullets.length && sections.length) {
    bullets = sections.flatMap((s) => [s.title, ...s.items]).filter(Boolean).slice(0, 16);
  }
  if (!bullets.length && beats.length) {
    bullets = beats.map((b) => `${b.timeLabel}: ${b.text}`.trim()).filter(Boolean);
  }

  if (!bullets.length && !slides.length && !sections.length) return null;

  const angle = String(o.angle || '').trim() || headline;
  const cta = String(o.cta || '').trim();

  return {
    headline,
    bullets: bullets.length ? bullets : [headline],
    angle,
    cta: cta || undefined,
    slides: slides.length ? slides : undefined,
    sections: sections.length ? sections : undefined,
    beats: beats.length ? beats : undefined,
    generationConfig,
  };
}

function buildAiStudioOpenRouterSystemPrompt(): string {
  return `Eres el mejor copywriter y estratega de marketing digital de habla hispana. Tu especialidad es crear contenido que vende, conecta emocionalmente y genera acción inmediata.

REGLAS ABSOLUTAS:
- Responde SOLO con JSON válido. Sin markdown, sin texto antes ni después, sin bloques de código.
- CRÍTICO: Usa el nombre real del negocio de businessContext.businessName en TODO el copy. Si businessContext.businessName existe, úsalo SIEMPRE. JAMÁS escribas "[Nombre de la empresa]", "[Tu empresa]" ni ningún placeholder. Si no hay businessContext, usa el valor de "offer" como nombre del negocio.
- Personaliza con la industria (businessContext.industries) para que el copy suene específico y experto.
- Si hay customContext, es prioridad máxima — incorpóralo de forma natural en el copy.
- El copy debe sonar humano, conversacional y específico. Nunca corporativo ni genérico.
- Usa datos, números y especificidad siempre que el usuario los haya mencionado.

FRAMEWORKS DE COPYWRITING QUE DEBES DOMINAR:
- AIDA: Atención → Interés → Deseo → Acción
- PAS: Problema → Agitación → Solución
- Hook-Story-Offer: Gancho → Historia → Oferta irresistible
- Before-After-Bridge: Estado actual → Estado deseado → El puente es tu oferta
- 4Ps: Promise → Picture → Proof → Push

ESTRUCTURA DEL JSON PERMITIDA:
- headline: string — titular poderoso que para el scroll
- bullets: array de strings — mínimo 4, máximo 8, cada uno accionable y específico
- angle: string — el ángulo estratégico explicado en 1-2 oraciones
- cta: string — llamada a la acción clara, específica y de bajo riesgo
- slides: array de {title, bullets} — solo para pitch-deck
- sections: array de {title, items} — para repurpose (un canal por section) y email-sequence
- beats: array de {id, label, timeLabel, startSec, endSec, text, visual} — solo para ugc-script

INSTRUCCIONES POR HERRAMIENTA:

ad-copy: Genera EXACTAMENTE esta estructura JSON:
- headline: el hook más poderoso (máximo 10 palabras, que pare el scroll)
- bullets[0]: "HOOK A — " + versión provocadora de 1 línea
- bullets[1]: "HOOK B — " + versión curiosidad de 1 línea
- bullets[2]: "HOOK C — " + versión dolor de 1 línea
- bullets[3]: "COPY INSTAGRAM — " + copy de 3 párrafos cortos máximo 60 palabras total, con saltos de línea, emojis naturales y lenguaje conversacional real
- bullets[4]: "COPY WHATSAPP — " + mensaje de prospección de 4 líneas máximo, directo y personal
- bullets[5]: "COPY EMAIL — " + asunto + 2 líneas de cuerpo + CTA
- angle: el insight estratégico detrás de este copy en 1 oración
- cta: la llamada a acción más específica y de menor fricción posible
NO escribas párrafos largos. NO uses lenguaje corporativo. SÍ usa lenguaje humano, específico y conversacional.

creative-brief: En sections genera: (1) "Ángulos estratégicos" con 4 ángulos únicos y específicos para este negocio. (2) "Objeciones a destruir" con las 3 objeciones más comunes de esta industria y cómo demolerlas. (3) "Mensajes que convierten" con 3 mensajes probados para esta audiencia. (4) "Referencias de tono" con 3 ejemplos de cómo debería sonar el copy.

ugc-script: Genera beats con guion palabra por palabra — no instrucciones, el texto real que dice la persona en cámara. Hook en 3 segundos, conflicto visceral, resolución con prueba, CTA específico.

repurpose: En sections genera copy REAL para 5 canales: Reel (hook + conflicto + CTA), Carrusel (5 slides con título y texto), Email (asunto + cuerpo completo de 150 palabras + CTA), WhatsApp (mensaje conversacional de 3 líneas), Landing (headline + subtítulo + 3 bullets de beneficio + CTA). Copy real, no instrucciones.

email-sequence: En sections genera 3 emails completos: Bienvenida (presenta el valor, genera confianza), Seguimiento (destruye la objeción principal), Cierre urgente (crea urgencia real, no falsa). Cada email con asunto, cuerpo completo de 100-150 palabras y CTA específico.

pitch-deck: En slides genera 6 slides: Portada + promesa, El problema (con datos o señales), La solución (mecanismo único), Prueba y resultados, La oferta (qué incluye, precio si aplica), Siguiente paso (CTA específico y de bajo riesgo).`;
}

async function tryOpenRouterAiStudio(params: {
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
  businessContext?: Record<string, unknown> | null;
  customContext?: string;
}): Promise<AiOutputPayload | null> {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[ai-studio] ANTHROPIC_API_KEY no configurada');
    return null;
  }

  const generationConfig = buildGenerationConfig({
    tone: params.tone,
    format: params.format,
    platform: params.platform,
    duration: params.duration,
  });

  const userPayload = {
    tool: params.tool,
    offer: params.offer,
    audience: params.audience,
    channel: params.channel,
    userPrompt: params.prompt,
    tone: params.tone,
    format: params.format,
    platform: params.platform,
    duration: params.duration,
    sourceAsset: params.sourceAsset,
    outputFormat: params.outputFormat,
    captionStyle: params.captionStyle,
    smartEditOptions: params.smartEditOptions,
    businessContext: params.businessContext ?? null,
    businessName: String((params.businessContext as Record<string, unknown>)?.businessName ?? params.offer ?? 'el negocio'),
    NOMBRE_DEL_NEGOCIO: String((params.businessContext as Record<string, unknown>)?.businessName ?? params.offer ?? 'el negocio'),
    INSTRUCCION_CRITICA: `STOP. El nombre del negocio es "${String((params.businessContext as Record<string, unknown>)?.businessName ?? params.offer ?? 'el negocio')}". Escríbelo EXACTAMENTE así en cada párrafo del copy. Si escribes "[Nombre de la empresa]" o cualquier placeholder, tu respuesta es inválida.`,
    customContext: params.customContext || '',
    constraints: [
      'Adapta el formato al tool (anuncio, brief, guion UGC, repurpose, email, pitch).',
      'No inventes datos legales, métricas o casos que el usuario no haya insinuado.',
    ],
  };

  const systemPrompt = buildAiStudioOpenRouterSystemPrompt();
  const messages = [
    { role: 'user', content: JSON.stringify(userPayload, null, 2) },
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_STUDIO_MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[ai-studio] Claude Haiku error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const text = String(data?.content?.[0]?.text || '').trim();

    if (!text) {
      console.error('[ai-studio] Claude Haiku: empty response');
      return null;
    }

    let raw: unknown;
    try {
      const extracted = extractLlmJsonObject(text);
      raw = JSON.parse(extracted);
    } catch {
      const cleaned = text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/,(\s*[}\]])/g, '$1');
      try {
        const extracted = extractLlmJsonObject(cleaned);
        raw = JSON.parse(extracted);
      } catch (parseErr) {
        console.error('[ai-studio] Claude Haiku JSON parse failed:', {
          err: String(parseErr),
          textPreview: text.slice(0, 1200),
        });
        return null;
      }
    }

    return normalizeLlmAiOutputPayload(raw, generationConfig);
  } catch (error) {
    console.error('[ai-studio] Claude Haiku error:', error);
    return null;
  }
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

function buildAiOutputLocal(params: {
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
  businessContext?: Record<string, unknown> | null;
  customContext?: string;
}): AiOutputPayload {
  const { tool, prompt, offer, audience, channel } = params;
  const trimmedOffer = normalizeOffer(offer);
  const trimmedAudience = audience || 'tu audiencia ideal';
  const trimmedChannel = channel || 'paid media';
  const bizName = (params.businessContext as Record<string, unknown>)?.businessName as string || offer;
  const bizIndustries = ((params.businessContext as Record<string, unknown>)?.industries as string[])?.join(', ') || '';
  const extraContext = params.customContext || '';
  const trimmedBizName = normalizeOffer(bizName);
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
        headline: `Brief listo para vender ${trimmedBizName}${bizIndustries ? ` · ${bizIndustries}` : ''} con una promesa clara`,
        bullets: [
          `Problema visible: ${trimmedAudience} siente fricción al intentar crecer sin sistema.`,
          `Promesa principal: ${basePromise} con más claridad, control y velocidad.`,
          ...(bizIndustries ? [`Contexto de sector: ${bizIndustries}.`] : []),
          ...(extraContext ? [`Prioridad declarada por el cliente: ${extraContext}`] : []),
          'Prueba sugerida: mostrar antes y después, una captura o un caso corto.',
          'Objeción a resolver: “ya probé otras herramientas y no tuve visibilidad real”.',
          'CTA: invita a demo o prueba guiada con un siguiente paso muy concreto.',
        ],
        angle: `Usa ${trimmedChannel} para mostrar ${trimmedBizName} primero y beneficios después.`,
      };
    case 'ugc-script':
      return buildStructuredSocialOutput({
        offer: trimmedBizName,
        audience: trimmedAudience,
        prompt: extraContext ? `${prompt}\n\nContexto adicional: ${extraContext}` : prompt,
        config: generationConfig,
      });
    case 'repurpose': {
      const bizName = (params.businessContext as Record<string, unknown>)?.businessName as string || offer;
      const bizIndustries = ((params.businessContext as Record<string, unknown>)?.industries as string[])?.join(', ') || '';
      const extraContext = params.customContext || '';
      return {
        headline: `Repurpose multicanal: ${bizName}${bizIndustries ? ` · ${bizIndustries}` : ''}`,
        bullets: [],
        angle: `Misma promesa, 5 canales distintos para ${trimmedAudience}.${bizIndustries ? ` Industria: ${bizIndustries}.` : ''}${extraContext ? ` Notas: ${extraContext}` : ''}`,
        sections: [
          {
            title: 'Reel',
            items: [
              `Hook: ¿Sabías que ${bizName} puede cambiar tu resultado en menos de 30 días?${extraContext ? ` ${extraContext}` : ''}`,
              `Conflicto: La mayoría de ${trimmedAudience} sigue usando métodos que no convierten.${bizIndustries ? ` Especialmente en ${bizIndustries}.` : ''}`,
              `CTA: Guarda este video y escríbenos hoy.`,
            ],
          },
          {
            title: 'Carrusel',
            items: [
              `Slide 1 — El problema: ${trimmedAudience} pierde tiempo sin resultados claros.`,
              `Slide 2 — La solución: ${bizName} resuelve eso paso a paso.`,
              `Slide 3 — El método: simple, probado y sin tecnicismos.${bizIndustries ? ` Enfocado en ${bizIndustries}.` : ''}`,
              `Slide 4 — CTA: Escríbenos y te explicamos cómo empieza.`,
            ],
          },
          {
            title: 'Email',
            items: [
              `Asunto: La razón por la que ${trimmedAudience} no está convirtiendo`,
              `Cuerpo: Hoy quiero contarte algo que cambia todo sobre ${bizName}.${extraContext ? ` ${extraContext}` : ''}`,
              `CTA: Responde este email con "quiero saber más" y te contactamos.`,
            ],
          },
          {
            title: 'WhatsApp',
            items: [
              `Hola, te escribo porque tenemos algo puntual para ${trimmedAudience}.`,
              `${bizName} — sin rodeos, sin contratos largos.`,
              `¿Tienes 10 minutos esta semana para una llamada rápida?`,
            ],
          },
          {
            title: 'Landing',
            items: [
              `Headline: ${bizName} — para ${trimmedAudience} que quiere resultados reales.`,
              `Subtítulo: Sin complicaciones. Sin perder tiempo. Solo resultados.${bizIndustries ? ` Especialistas en ${bizIndustries}.` : ''}`,
              `CTA principal: Empieza hoy →`,
            ],
          },
        ],
      };
    }
    case 'email-sequence':
      return {
        headline: `Secuencia de seguimiento para ${trimmedBizName}${bizIndustries ? ` · ${bizIndustries}` : ''}`,
        bullets: [
          `Email 1: oportunidad y beneficio principal con CTA directo.${extraContext ? ` Incluye: ${extraContext}` : ''}`,
          'Email 2: objeción más común y prueba o mini caso.',
          'Email 3: urgencia racional, siguiente paso y recordatorio simple.',
        ],
        angle: 'Escribe como si abrieras una conversación útil, no como si empujaras una venta.',
      };
    case 'pitch-deck':
      return {
        headline: `Presentación lista para vender ${trimmedBizName}${bizIndustries ? ` · ${bizIndustries}` : ''}`,
        bullets: [
          'Abre con la oportunidad principal, no con contexto genérico.',
          'Muestra el problema, la solución, la prueba y el siguiente paso con una sola narrativa.',
          'Mantén una idea fuerte por slide para que la propuesta se entienda rápido.',
          'Cierra con una acción concreta: demo, llamada o aprobación.',
        ],
        angle: `Usa un tono claro, elegante y orientado a resultados para ${trimmedAudience}.${extraContext ? ` Contexto clave: ${extraContext}` : ''}`,
        cta: 'Cierra con una propuesta concreta y un siguiente paso fácil de aceptar.',
        slides: [
          {
            title: 'Portada y promesa',
            bullets: [
              `${trimmedBizName} en una frase clara.`,
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
              `Cómo ${trimmedBizName} resuelve el problema.`,
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
    default: {
      const contextLine = extraContext || `Pensado para ${trimmedAudience}.`;
      const lowFrictionCta = /cotiz|quote|agenda|consulta/i.test(`${prompt} ${extraContext}`)
        ? 'Agenda una cotización rápida esta semana.'
        : 'Escríbenos y te damos el siguiente paso en minutos.';
      return {
        headline: `${trimmedBizName}: solución clara sin fricción`,
        bullets: [
          `HOOK A — Deja de perder clientes por una primera impresión descuidada.`,
          `HOOK B — Lo que cambia cuando ${trimmedBizName} se encarga.`,
          `HOOK C — Si tu espacio no transmite confianza, ya estás perdiendo.`,
          `COPY INSTAGRAM — ${trimmedBizName} ayuda a ${trimmedAudience} a verse más profesional sin complicarse.\n\n${contextLine} ✨\n\n¿Quieres verlo fácil? Te damos una cotización clara y sin presión.`,
          `COPY WHATSAPP — Hola, soy de ${trimmedBizName}.\nAyudamos a ${trimmedAudience} con una solución simple y confiable.\n${contextLine}\n¿Te puedo mandar una cotización rápida?`,
          `COPY EMAIL — Asunto: Una forma más simple de resolver esto\n${trimmedBizName} puede ayudar a ${trimmedAudience} con una propuesta clara y sin fricción.\n${lowFrictionCta}`,
        ],
        angle: `El copy posiciona a ${trimmedBizName} como una respuesta simple y confiable para ${trimmedAudience}.`,
        cta: lowFrictionCta,
      };
    }
  }
}

export async function buildAiOutput(params: {
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
  businessContext?: Record<string, unknown> | null;
  customContext?: string;
  variations?: number;
}): Promise<AiOutputPayload> {
  const fromLlm = await tryOpenRouterAiStudio(params);
  if (fromLlm) return fromLlm;
  console.warn('[ai-studio] Groq falló — usando fallback local');
  return buildAiOutputLocal(params);
}

export async function buildAiOutputVariations(params: {
  tool: AiToolKey;
  prompt: string;
  offer: string;
  audience: string;
  channel: string;
  tone?: ContentTone;
  format?: ContentFormat;
  platform?: ContentPlatform;
  duration?: 15 | 30 | 60;
  businessContext?: Record<string, unknown> | null;
  customContext?: string;
  count?: number;
}): Promise<AiOutputPayload[]> {
  const count = Math.min(params.count ?? 3, 5);
  const tones: ContentTone[] = [
    'viral-aggressive',
    'pain-pleasure',
    'curiosity-gap',
    'ceo-direct',
    'story-relaxed',
  ];
  const requests = Array.from({ length: count }, (_, i) =>
    tryOpenRouterAiStudio({
      ...params,
      tone: tones[i % tones.length],
      customContext: `${params.customContext || ''} — Variación ${i + 1} de ${count}. Tono: ${tones[i % tones.length]}. Sé completamente diferente a las otras variaciones.`.trim(),
    }).catch(() => null)
  );
  const results = await Promise.all(requests);
  const valid = results.filter((r): r is AiOutputPayload => r !== null);
  if (valid.length === 0) return [buildAiOutputLocal(params)];
  return valid;
}

type TrendPlatform = 'instagram' | 'facebook' | 'google' | 'tiktok' | 'cross-channel';

interface TrendSignalInput {
  id: string;
  platform: string;
  accountName: string;
  connected: boolean;
}

interface TrendCampaignInput {
  id: string;
  name: string;
  status: string;
  budget: number;
  analytics?: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
    spend?: number;
    revenue?: number;
  } | null;
}

interface TrendUserInput {
  id: string;
  name: string | null;
  email: string;
  founderAccess?: boolean;
  subscription?: {
    plan?: string | null;
    status?: string | null;
  } | null;
}

export interface TrendInsight {
  id: string;
  platform: TrendPlatform;
  title: string;
  summary: string;
  whyNow: string;
  hook: string;
  formats: string[];
  confidence: number;
  urgency: 'alta' | 'media';
}

export interface CampaignBlueprint {
  id: string;
  name: string;
  objective: string;
  audience: string;
  angle: string;
  offer: string;
  creativeDirection: string;
  launchWindow: string;
}

export interface TrendRadarReport {
  refreshedAt: string;
  refreshAfterMinutes: number;
  marketPulse: string;
  momentumScore: number;
  activePlatforms: string[];
  quickWins: string[];
  hooks: string[];
  insights: TrendInsight[];
  blueprints: CampaignBlueprint[];
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Google',
  tiktok: 'TikTok',
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSeasonalTheme(date: Date) {
  const month = date.getMonth();

  if (month <= 1) {
    return {
      title: 'reinicio de año',
      pulse: 'El mercado responde mejor a ofertas que prometen claridad, orden y velocidad de ejecución.',
      urgency: 'alta' as const,
      launchWindow: 'próximos 7 días',
    };
  }

  if (month <= 4) {
    return {
      title: 'impulso de Q2',
      pulse: 'Las marcas que convierten mejor están acelerando campañas de captación con creatividad orientada a resultado y prueba visible.',
      urgency: 'alta' as const,
      launchWindow: 'próximos 10 días',
    };
  }

  if (month <= 7) {
    return {
      title: 'tráfico de mitad de año',
      pulse: 'La atención premia mensajes directos, diferenciación clara y piezas que condensan valor en segundos.',
      urgency: 'media' as const,
      launchWindow: 'próximas 2 semanas',
    };
  }

  if (month <= 9) {
    return {
      title: 'vuelta a ritmo comercial',
      pulse: 'Funciona mejor el contenido que reengancha con ofertas concretas, urgencia elegante y demostración de producto.',
      urgency: 'alta' as const,
      launchWindow: 'próximos 5 días',
    };
  }

  return {
    title: 'cierre fuerte de año',
    pulse: 'La demanda favorece mensajes con retorno claro, comparativas y decisores listos para invertir antes de cerrar presupuesto.',
    urgency: 'alta' as const,
    launchWindow: 'esta semana',
  };
}

function normalizePlatform(platform?: string | null): TrendPlatform {
  if (!platform) return 'cross-channel';
  const normalized = platform.trim().toLowerCase();
  if (normalized === 'instagram' || normalized === 'facebook' || normalized === 'google' || normalized === 'tiktok') {
    return normalized;
  }
  return 'cross-channel';
}

function getPlatformCatalog(platform: TrendPlatform) {
  switch (platform) {
    case 'instagram':
      return {
        title: 'UGC con transformación visible',
        summary:
          'Los anuncios con rostro humano, promesa concreta y prueba rápida siguen ganando clic cuando muestran antes y después, objeción y resultado en una sola pieza.',
        whyNow:
          'Instagram está premiando secuencias cortas que parecen contenido nativo y reducen la distancia entre descubrimiento y confianza.',
        hook: 'Deja de explicar tu servicio como si fuera una lista. Muéstralo resolviendo un problema en tiempo real.',
        formats: ['Reel vertical de 20s', 'Carrusel problema-solución', 'Historia con CTA directo'],
        objective: 'captación de leads templados',
        angle: 'demostración + autoridad amable',
      };
    case 'facebook':
      return {
        title: 'Prueba social con oferta clara',
        summary:
          'En Facebook convierten mejor las piezas que combinan credibilidad, explicación simple del beneficio y una llamada a la acción muy concreta.',
        whyNow:
          'La plataforma sigue recompensando anuncios que se sienten claros para audiencias maduras y con intención de compra más reflexiva.',
        hook: 'Si tu anuncio no responde en 5 segundos por qué alguien debería confiar en ti, está dejando dinero sobre la mesa.',
        formats: ['Imagen estática con titular fuerte', 'Video testimonial', 'Lead magnet con formulario'],
        objective: 'generación de prospectos calificados',
        angle: 'prueba social + llamada directa',
      };
    case 'google':
      return {
        title: 'Captura de demanda con promesa comparativa',
        summary:
          'La ventaja en Google está en los anuncios que articulan valor diferencial, rapidez y menor fricción frente a la alternativa actual del cliente.',
        whyNow:
          'La intención alta se convierte mejor cuando el copy reduce riesgo y anticipa la objeción principal desde el propio anuncio.',
        hook: 'Haz que tu titular responda por qué elegirte hoy, no solo qué haces.',
        formats: ['Search con promesa comparativa', 'Landing de conversión corta', 'Extensiones con oferta'],
        objective: 'captura de demanda lista para cierre',
        angle: 'comparativa + urgencia racional',
      };
    case 'tiktok':
      return {
        title: 'Narrativa founder-led con ritmo rápido',
        summary:
          'En TikTok está funcionando el contenido que entra por curiosidad, rompe una creencia y revela una oportunidad clara en segundos.',
        whyNow:
          'La plataforma sigue premiando la energía creativa real, especialmente cuando la marca habla con voz humana y no con tono corporativo.',
        hook: 'La forma más rápida de perder atención en TikTok es sonar como anuncio desde el primer segundo.',
        formats: ['Video selfie 15s', 'Pantalla grabada con subtítulos', 'Secuencia de objeción-respuesta'],
        objective: 'top of funnel con alta memorabilidad',
        angle: 'curiosidad + contrarian insight',
      };
    default:
      return {
        title: 'Oferta compacta multi-canal',
        summary:
          'Cuando una marca alinea problema, mecanismo y prueba en una narrativa compacta, puede mover mejor su creatividad entre canales sin perder claridad.',
        whyNow:
          'La consistencia de mensaje entre anuncios, landing y seguimiento acelera aprendizaje y mejora la calidad del lead.',
        hook: 'La creatividad no escala cuando cada canal cuenta una historia distinta del mismo producto.',
        formats: ['Hero de landing', 'Anuncio corto', 'Secuencia de retargeting'],
        objective: 'consistencia de mensaje y conversión',
        angle: 'oferta clara + fricción baja',
      };
  }
}

function calculateMomentum(campaigns: TrendCampaignInput[]) {
  if (!campaigns.length) return 58;

  const totals = campaigns.reduce(
    (acc, campaign) => {
      acc.budget += campaign.budget || 0;
      acc.impressions += campaign.analytics?.impressions || 0;
      acc.clicks += campaign.analytics?.clicks || 0;
      acc.conversions += campaign.analytics?.conversions || 0;
      acc.revenue += campaign.analytics?.revenue || 0;
      return acc;
    },
    { budget: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const conversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
  const roas = totals.budget > 0 ? totals.revenue / totals.budget : 0;

  const score = 45 + ctr * 4 + conversionRate * 3 + roas * 8;
  return Math.max(42, Math.min(96, Math.round(score)));
}

function getActivePlatforms(adAccounts: TrendSignalInput[], campaigns: TrendCampaignInput[]) {
  const fromAccounts = adAccounts
    .filter((account) => account.connected)
    .map((account) => normalizePlatform(account.platform))
    .filter((platform) => platform !== 'cross-channel');

  const fallbackPlatforms =
    campaigns.length > 0 ? ['cross-channel'] : ['instagram', 'facebook', 'google'];

  return Array.from(new Set(fromAccounts.length ? fromAccounts : fallbackPlatforms));
}

function createBlueprint(
  index: number,
  platform: TrendPlatform,
  seasonalTheme: ReturnType<typeof getSeasonalTheme>,
  user: TrendUserInput
): CampaignBlueprint {
  const catalog = getPlatformCatalog(platform);
  const audience =
    platform === 'google'
      ? 'personas con intención alta que ya están buscando una solución'
      : platform === 'tiktok'
        ? 'audiencia fría que responde a creatividad nativa y curiosidad'
        : 'prospectos que sienten el problema pero todavía no confían lo suficiente';

  const offer =
    user.founderAccess || user.subscription?.plan === 'enterprise'
      ? 'demo consultiva con propuesta personalizada y activación rápida'
      : 'demo guiada con quick wins y plan recomendado';

  return {
    id: `blueprint-${platform}-${index}`,
    name: `${capitalize(platform === 'cross-channel' ? 'conversion' : platform)} Sprint ${index + 1}`,
    objective: catalog.objective,
    audience,
    angle: `${catalog.angle} alineado con ${seasonalTheme.title}`,
    offer,
    creativeDirection: `${catalog.title}. Usa ${catalog.formats[0].toLowerCase()} como pieza ancla y deriva el resto desde el mismo mensaje.`,
    launchWindow: seasonalTheme.launchWindow,
  };
}

export function buildTrendRadarReport(params: {
  user: TrendUserInput;
  adAccounts: TrendSignalInput[];
  campaigns: TrendCampaignInput[];
}): TrendRadarReport {
  const { user, adAccounts, campaigns } = params;
  const seasonalTheme = getSeasonalTheme(new Date());
  const activePlatforms = getActivePlatforms(adAccounts, campaigns);
  const momentumScore = calculateMomentum(campaigns);
  const primaryPlatforms = activePlatforms.slice(0, 3);

  const insights = primaryPlatforms.map((platform, index) => {
    const catalog = getPlatformCatalog(platform as TrendPlatform);
    const confidenceBoost = adAccounts.some((account) => normalizePlatform(account.platform) === platform) ? 6 : 0;

    return {
      id: `insight-${platform}-${index}`,
      platform: platform as TrendPlatform,
      title: catalog.title,
      summary: catalog.summary,
      whyNow: `${catalog.whyNow} ${seasonalTheme.pulse}`,
      hook: catalog.hook,
      formats: catalog.formats,
      confidence: Math.min(98, 74 + confidenceBoost + Math.max(0, momentumScore - 60) / 2),
      urgency: seasonalTheme.urgency,
    };
  });

  if (!insights.length) {
    insights.push({
      id: 'insight-cross-channel-0',
      platform: 'cross-channel',
      title: 'Mensaje unificado orientado a conversión',
      summary:
        'Antes de escalar medios, conviene fijar una promesa central, una objeción principal y una demostración compacta que se pueda repetir en landing, anuncios y seguimiento.',
      whyNow: seasonalTheme.pulse,
      hook: 'La consistencia creativa es el atajo más rápido para vender mejor sin multiplicar complejidad.',
      formats: ['Landing corta', 'Video demo', 'Secuencia de retargeting'],
      confidence: 79,
      urgency: seasonalTheme.urgency,
    });
  }

  const blueprints = insights.slice(0, 3).map((insight, index) => createBlueprint(index, insight.platform, seasonalTheme, user));

  const platformLabelList = activePlatforms.map((platform) => PLATFORM_LABELS[platform] || capitalize(platform));

  return {
    refreshedAt: new Date().toISOString(),
    refreshAfterMinutes: user.founderAccess ? 30 : 90,
    marketPulse: `${seasonalTheme.pulse} Nexora debe apostar por piezas con dolor real, prueba visible y CTA de baja fricción.`,
    momentumScore,
    activePlatforms: platformLabelList,
    quickWins: [
      'Abre la creatividad con una objeción reconocible y resuélvela antes del segundo 5.',
      'Usa una sola promesa principal por campaña y repítela igual en anuncio, landing y CTA.',
      'Prioriza piezas que muestren producto o resultado, no solo beneficios abstractos.',
    ],
    hooks: [
      'Si tu anuncio necesita demasiada explicación, está perdiendo a la gente correcta.',
      'Lo que hoy vende mejor no es más volumen, sino una promesa más creíble.',
      'La creatividad que convierte hace sentir que el problema ya fue entendido antes de vender.',
    ],
    insights,
    blueprints,
  };
}

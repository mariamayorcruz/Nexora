const CREATIVE_MAX = {
  imageUrl: 2048,
  primaryText: 2000,
  headline: 500,
  description: 2000,
  cta: 120,
} as const;

function clampStr(value: unknown, max: number) {
  const s = String(value ?? '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

export type NexoraCreativeNormalized = {
  imageUrl: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  variant: 'feed' | 'story';
};

/** Shared shape for Command Center create + PATCH creative payloads. */
export function normalizeNexoraCreative(input: unknown): NexoraCreativeNormalized {
  if (!input || typeof input !== 'object') {
    return {
      imageUrl: '',
      primaryText: '',
      headline: '',
      description: '',
      cta: '',
      variant: 'feed',
    };
  }

  const raw = input as Record<string, unknown>;
  const variantRaw = String(raw.variant || '').toLowerCase();
  const variant = variantRaw === 'story' ? ('story' as const) : ('feed' as const);

  return {
    imageUrl: clampStr(raw.imageUrl, CREATIVE_MAX.imageUrl),
    primaryText: clampStr(raw.primaryText, CREATIVE_MAX.primaryText),
    headline: clampStr(raw.headline, CREATIVE_MAX.headline),
    description: clampStr(raw.description, CREATIVE_MAX.description),
    cta: clampStr(raw.cta, CREATIVE_MAX.cta),
    variant,
  };
}

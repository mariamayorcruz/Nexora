export type MediaKind = 'video' | 'image';

export interface StockMediaAsset {
  id: string;
  kind: MediaKind;
  provider: 'pexels' | 'pixabay' | 'mixkit' | 'unsplash';
  title: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  authorName?: string;
  licenseUrl?: string;
}

export interface RenderScene {
  id: string;
  text: string;
  durationSec: number;
  assetUrl?: string;
}

export interface RenderPlan {
  provider: string;
  outputFormat: string;
  captionStyle: string;
  estimatedDurationSec: number;
  scenes: RenderScene[];
  ffmpegHint: string[];
}

const FALLBACK_VIDEO_ASSETS: StockMediaAsset[] = [
  {
    id: 'mixkit-1',
    kind: 'video',
    provider: 'mixkit',
    title: 'Waves water cinematic',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
    licenseUrl: 'https://mixkit.co/free-stock-video/',
  },
  {
    id: 'mixkit-2',
    kind: 'video',
    provider: 'mixkit',
    title: 'Laptop office work close-up',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-working-on-her-laptop-5075-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200',
    licenseUrl: 'https://mixkit.co/free-stock-video/',
  },
  {
    id: 'mixkit-3',
    kind: 'video',
    provider: 'mixkit',
    title: 'City timelapse traffic',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-hyperlapse-of-traffic-in-a-city-2454-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200',
    licenseUrl: 'https://mixkit.co/free-stock-video/',
  },
];

function buildFallbackImageAssets(query: string): StockMediaAsset[] {
  const encoded = encodeURIComponent(query || 'business marketing');
  return [
    {
      id: 'unsplash-1',
      kind: 'image',
      provider: 'unsplash',
      title: `Unsplash source: ${query || 'business marketing'}`,
      url: `https://source.unsplash.com/1600x900/?${encoded}`,
      thumbnailUrl: `https://source.unsplash.com/640x360/?${encoded}`,
      licenseUrl: 'https://unsplash.com/license',
    },
    {
      id: 'unsplash-2',
      kind: 'image',
      provider: 'unsplash',
      title: 'Unsplash source alt',
      url: `https://source.unsplash.com/1600x900/?${encoded},team`,
      thumbnailUrl: `https://source.unsplash.com/640x360/?${encoded},team`,
      licenseUrl: 'https://unsplash.com/license',
    },
  ];
}

function pickPexelsVideoFile(videoFiles: Array<{ link?: string; quality?: string; width?: number; height?: number }>) {
  return (
    videoFiles.find((file) => file.quality === 'sd' && file.link) ||
    videoFiles.find((file) => file.quality === 'hd' && file.link) ||
    videoFiles.find((file) => file.link)
  );
}

async function searchPexels(query: string, kind: MediaKind, limit: number): Promise<StockMediaAsset[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  const encoded = encodeURIComponent(query);
  const endpoint =
    kind === 'video'
      ? `https://api.pexels.com/videos/search?query=${encoded}&per_page=${limit}`
      : `https://api.pexels.com/v1/search?query=${encoded}&per_page=${limit}`;

  const response = await fetch(endpoint, {
    headers: { Authorization: apiKey },
    cache: 'no-store',
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as {
    videos?: Array<{
      id: number;
      url?: string;
      image?: string;
      duration?: number;
      width?: number;
      height?: number;
      user?: { name?: string };
      video_files?: Array<{ link?: string; quality?: string; width?: number; height?: number }>;
    }>;
    photos?: Array<{
      id: number;
      url?: string;
      alt?: string;
      width?: number;
      height?: number;
      photographer?: string;
      src?: { original?: string; medium?: string };
    }>;
  };

  if (kind === 'video') {
    return (payload.videos || []).flatMap((video) => {
      const selected = pickPexelsVideoFile(video.video_files || []);
      if (!selected?.link) return [];
      return [
        {
          id: `pexels-video-${video.id}`,
          kind: 'video' as const,
          provider: 'pexels' as const,
          title: `Pexels video ${video.id}`,
          url: selected.link,
          thumbnailUrl: video.image,
          width: selected.width || video.width,
          height: selected.height || video.height,
          durationSec: video.duration,
          authorName: video.user?.name,
          licenseUrl: 'https://www.pexels.com/license/',
        },
      ];
    });
  }

  return (payload.photos || []).flatMap((photo) => {
    if (!photo.src?.original) return [];
    return [
      {
        id: `pexels-image-${photo.id}`,
        kind: 'image' as const,
        provider: 'pexels' as const,
        title: photo.alt || `Pexels image ${photo.id}`,
        url: photo.src.original,
        thumbnailUrl: photo.src.medium,
        width: photo.width,
        height: photo.height,
        authorName: photo.photographer,
        licenseUrl: 'https://www.pexels.com/license/',
      },
    ];
  });
}

async function searchPixabay(query: string, kind: MediaKind, limit: number): Promise<StockMediaAsset[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return [];

  const encoded = encodeURIComponent(query);
  const endpoint =
    kind === 'video'
      ? `https://pixabay.com/api/videos/?key=${apiKey}&q=${encoded}&per_page=${limit}`
      : `https://pixabay.com/api/?key=${apiKey}&q=${encoded}&per_page=${limit}&image_type=photo`;

  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    hits?: Array<{
      id: number;
      pageURL?: string;
      tags?: string;
      user?: string;
      duration?: number;
      videos?: {
        medium?: { url?: string; width?: number; height?: number };
        small?: { url?: string; width?: number; height?: number };
      };
      largeImageURL?: string;
      webformatURL?: string;
      imageWidth?: number;
      imageHeight?: number;
    }>;
  };

  if (kind === 'video') {
    return (payload.hits || []).flatMap((hit) => {
      const selected = hit.videos?.medium?.url ? hit.videos.medium : hit.videos?.small;
      if (!selected?.url) return [];
      return [
        {
          id: `pixabay-video-${hit.id}`,
          kind: 'video' as const,
          provider: 'pixabay' as const,
          title: hit.tags || `Pixabay video ${hit.id}`,
          url: selected.url,
          thumbnailUrl: undefined,
          width: selected.width,
          height: selected.height,
          durationSec: hit.duration,
          authorName: hit.user,
          licenseUrl: 'https://pixabay.com/service/license-summary/',
        },
      ];
    });
  }

  return (payload.hits || []).flatMap((hit) => {
    if (!hit.largeImageURL) return [];
    return [
      {
        id: `pixabay-image-${hit.id}`,
        kind: 'image' as const,
        provider: 'pixabay' as const,
        title: hit.tags || `Pixabay image ${hit.id}`,
        url: hit.largeImageURL,
        thumbnailUrl: hit.webformatURL,
        width: hit.imageWidth,
        height: hit.imageHeight,
        authorName: hit.user,
        licenseUrl: 'https://pixabay.com/service/license-summary/',
      },
    ];
  });
}

export async function searchStockMedia(query: string, kind: MediaKind, limit = 8): Promise<StockMediaAsset[]> {
  const normalizedQuery = query.trim() || 'marketing campaign';

  const pexels = await searchPexels(normalizedQuery, kind, limit);
  if (pexels.length > 0) return pexels.slice(0, limit);

  const pixabay = await searchPixabay(normalizedQuery, kind, limit);
  if (pixabay.length > 0) return pixabay.slice(0, limit);

  if (kind === 'video') {
    return FALLBACK_VIDEO_ASSETS.slice(0, limit);
  }

  return buildFallbackImageAssets(normalizedQuery).slice(0, limit);
}

export function buildRenderPlan(params: {
  prompt: string;
  outputFormat: string;
  captionStyle: string;
  assetUrls?: string[];
  provider?: string;
}): RenderPlan {
  const promptParts = params.prompt
    .split(/[\.\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);

  const lines = promptParts.length > 0 ? promptParts : ['Hook principal', 'Prueba visual', 'CTA final'];

  const scenes: RenderScene[] = lines.map((line, index) => ({
    id: `scene-${index + 1}`,
    text: line,
    durationSec: index === 0 ? 3 : 4,
    assetUrl: params.assetUrls?.[index],
  }));

  const estimatedDurationSec = scenes.reduce((sum, scene) => sum + scene.durationSec, 0);

  return {
    provider: params.provider || process.env.VIDEO_RENDER_PROVIDER || 'local-draft',
    outputFormat: params.outputFormat,
    captionStyle: params.captionStyle,
    estimatedDurationSec,
    scenes,
    ffmpegHint: [
      '# Example local render pipeline',
      'ffmpeg -i input.mp4 -vf "scale=1080:1920,subtitles=captions.srt" -r 30 output.mp4',
      '# For multi-scene render, concatenate clips before captions/music pass',
    ],
  };
}

export function getVideoProviderStatus() {
  const provider = process.env.VIDEO_RENDER_PROVIDER || 'local-draft';
  const apiKey = process.env.VIDEO_RENDER_API_KEY || process.env.HEYGEN_API_KEY || process.env.RUNWAY_API_KEY || '';
  const apiUrl = process.env.VIDEO_RENDER_API_URL || '';

  const mode = provider === 'local-draft' ? 'local' : 'remote';

  return {
    provider,
    mode,
    ready: provider === 'local-draft' || Boolean(apiKey || apiUrl),
    hasApiKey: Boolean(apiKey),
    hasApiUrl: Boolean(apiUrl),
  };
}

export async function dispatchRenderJob(params: {
  renderPlan: RenderPlan;
  tool: string;
  userId: string;
}) {
  const status = getVideoProviderStatus();

  if (status.provider === 'local-draft') {
    return {
      provider: status.provider,
      status: 'queued',
      externalJobId: null,
      previewUrl: params.renderPlan.scenes[0]?.assetUrl || null,
    };
  }

  const customUrl = process.env.VIDEO_RENDER_API_URL;
  if (!customUrl) {
    return {
      provider: status.provider,
      status: 'queued',
      externalJobId: null,
      previewUrl: params.renderPlan.scenes[0]?.assetUrl || null,
    };
  }

  const response = await fetch(customUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.VIDEO_RENDER_API_KEY ? `Bearer ${process.env.VIDEO_RENDER_API_KEY}` : '',
    },
    body: JSON.stringify({
      userId: params.userId,
      tool: params.tool,
      renderPlan: params.renderPlan,
    }),
  });

  if (!response.ok) {
    return {
      provider: status.provider,
      status: 'queued',
      externalJobId: null,
      previewUrl: params.renderPlan.scenes[0]?.assetUrl || null,
    };
  }

  const payload = (await response.json()) as { jobId?: string; previewUrl?: string; status?: string };

  return {
    provider: status.provider,
    status: payload.status || 'queued',
    externalJobId: payload.jobId || null,
    previewUrl: payload.previewUrl || params.renderPlan.scenes[0]?.assetUrl || null,
  };
}

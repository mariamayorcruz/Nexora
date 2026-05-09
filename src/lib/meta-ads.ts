type MetaOAuthTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type MetaAdAccount = {
  id: string;
  name?: string;
  account_status?: number;
};

type MetaAdVideo = {
  id: string;
  title?: string;
  source?: string;
  permalink_url?: string;
  thumbnail_url?: string;
  created_time?: string;
  updated_time?: string;
  length?: number;
};

type MetaPage = {
  id: string;
  name: string;
  accessToken: string;
  category?: string;
  igUserId?: string;
};

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v19.0';

function isConfigured(value: string | undefined) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  const blocked = ['placeholder', 'your-', 'tu-', 'changeme', 'example'];
  const lower = normalized.toLowerCase();
  return !blocked.some((token) => lower.includes(token));
}

export function resolveMetaClientId() {
  const candidates = [
    process.env.META_APP_ID,
    process.env.FACEBOOK_APP_ID,
    process.env.NEXT_PUBLIC_META_APP_ID,
    process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
  ];

  return candidates.find((value) => isConfigured(value)) || '';
}

export function resolveMetaClientSecret() {
  const candidates = [process.env.META_APP_SECRET, process.env.FACEBOOK_APP_SECRET];
  return candidates.find((value) => isConfigured(value)) || '';
}

function normalizeMetaAccountId(accountId: string) {
  if (!accountId) return '';
  return accountId.startsWith('act_') ? accountId : `act_${accountId}`;
}

async function graphRequest<T>(
  path: string,
  search: URLSearchParams,
  method: 'GET' | 'POST' = 'GET'
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path.replace(/^\/+/, '')}`);
  search.forEach((value, key) => url.searchParams.set(key, value));

  const response = await fetch(url, { method, cache: 'no-store' });
  const payload = (await response.json()) as T & { error?: { message?: string; code?: number } };

  if (!response.ok || payload.error) {
    const message = payload.error?.message || 'Meta Graph request failed.';
    throw new Error(message);
  }

  return payload;
}

export async function exchangeMetaCodeForToken(params: {
  code: string;
  redirectUri: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<{ accessToken: string; expiresAt: Date | null }> {
  const clientId = String(params.clientId || '').trim() || resolveMetaClientId();
  const clientSecret = String(params.clientSecret || '').trim() || resolveMetaClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error('Meta OAuth is not configured. Missing META_APP_ID / META_APP_SECRET.');
  }

  const firstStepParams = new URLSearchParams();
  firstStepParams.set('client_id', clientId);
  firstStepParams.set('client_secret', clientSecret);
  firstStepParams.set('redirect_uri', params.redirectUri);
  firstStepParams.set('code', params.code);

  const firstStep = await graphRequest<MetaOAuthTokenResponse>('oauth/access_token', firstStepParams);
  const shortLivedToken = String(firstStep.access_token || '').trim();

  if (!shortLivedToken) {
    throw new Error('Meta OAuth did not return an access token.');
  }

  const secondStepParams = new URLSearchParams();
  secondStepParams.set('grant_type', 'fb_exchange_token');
  secondStepParams.set('client_id', clientId);
  secondStepParams.set('client_secret', clientSecret);
  secondStepParams.set('fb_exchange_token', shortLivedToken);

  try {
    const secondStep = await graphRequest<MetaOAuthTokenResponse>('oauth/access_token', secondStepParams);
    const longLivedToken = String(secondStep.access_token || '').trim();
    const expiresIn = Number(secondStep.expires_in || 0);

    return {
      accessToken: longLivedToken || shortLivedToken,
      expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null,
    };
  } catch {
    const expiresIn = Number(firstStep.expires_in || 0);
    return {
      accessToken: shortLivedToken,
      expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null,
    };
  }
}

export async function fetchMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const search = new URLSearchParams();
  search.set('access_token', accessToken);
  search.set('fields', 'id,name,account_status');
  search.set('limit', '20');

  const payload = await graphRequest<{ data?: MetaAdAccount[] }>('me/adaccounts', search);
  return (payload.data || []).filter((account) => Boolean(account.id));
}

export async function fetchMetaAdVideos(params: {
  accessToken: string;
  accountId: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    title: string;
    url: string;
    thumbnailUrl?: string;
    durationSec?: number;
    createdAt?: string;
  }>
> {
  const accountId = normalizeMetaAccountId(params.accountId);
  if (!accountId) {
    return [];
  }

  const search = new URLSearchParams();
  search.set('access_token', params.accessToken);
  search.set('fields', 'id,title,source,permalink_url,thumbnail_url,created_time,updated_time,length');
  search.set('limit', String(Math.max(1, Math.min(params.limit || 12, 25))));

  const payload = await graphRequest<{ data?: MetaAdVideo[] }>(`${accountId}/advideos`, search);

  return (payload.data || [])
    .map((video) => {
      const directUrl = String(video.source || '').trim();
      const pageUrl = String(video.permalink_url || '').trim();
      const bestUrl = directUrl || pageUrl;

      if (!video.id || !bestUrl) {
        return null;
      }

      return {
        id: video.id,
        title: String(video.title || `Meta video ${video.id}`),
        url: bestUrl,
        thumbnailUrl: String(video.thumbnail_url || '').trim() || undefined,
        durationSec: typeof video.length === 'number' ? Math.max(1, Math.round(video.length)) : undefined,
        createdAt: video.updated_time || video.created_time || undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function publishToInstagram(params: {
  accessToken: string;
  igUserId: string;
  imageUrl?: string;
  caption: string;
}): Promise<{ id: string; permalink?: string }> {
  const containerParams = new URLSearchParams();
  containerParams.set('access_token', params.accessToken);
  containerParams.set('caption', params.caption);
  if (params.imageUrl) {
    containerParams.set('image_url', params.imageUrl);
    containerParams.set('media_type', 'IMAGE');
  }

  const container = await graphRequest<{ id: string }>(`${params.igUserId}/media`, containerParams, 'POST');

  if (!container.id) throw new Error('No se pudo crear el container de Instagram.');

  const publishParams = new URLSearchParams();
  publishParams.set('access_token', params.accessToken);
  publishParams.set('creation_id', container.id);

  const result = await graphRequest<{ id: string }>(`${params.igUserId}/media_publish`, publishParams, 'POST');

  return { id: result.id };
}

export async function publishToFacebook(params: {
  accessToken: string;
  pageId: string;
  message: string;
  imageUrl?: string;
}): Promise<{ id: string; permalink?: string }> {
  const postParams = new URLSearchParams();
  postParams.set('access_token', params.accessToken);
  postParams.set('message', params.message);
  if (params.imageUrl) {
    postParams.set('url', params.imageUrl);
  }

  const endpoint = params.imageUrl ? `${params.pageId}/photos` : `${params.pageId}/feed`;
  const result = await graphRequest<{ id: string; post_id?: string }>(endpoint, postParams, 'POST');

  return { id: result.post_id || result.id };
}

export async function fetchMetaPages(accessToken: string): Promise<MetaPage[]> {
  const search = new URLSearchParams();
  search.set('access_token', accessToken);
  search.set('fields', 'id,name,access_token,category,instagram_business_account');
  search.set('limit', '10');

  const payload = await graphRequest<{
    data?: Array<{
      id: string;
      name?: string;
      access_token?: string;
      category?: string;
      instagram_business_account?: { id: string };
    }>;
  }>('me/accounts', search);

  return (payload.data || [])
    .filter((page) => page.id && page.access_token)
    .map((page) => ({
      id: page.id,
      name: String(page.name || page.id),
      accessToken: String(page.access_token || ''),
      category: page.category,
      igUserId: page.instagram_business_account?.id,
    }));
}

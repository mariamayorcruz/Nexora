import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';
import { resolveMetaClientId } from '@/lib/meta-ads';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Platform = 'instagram' | 'facebook' | 'google' | 'tiktok';

const ALLOWED_PLATFORMS = new Set<Platform>(['instagram', 'facebook', 'google', 'tiktok']);

function getUserIdFromRequest(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return null;
  }

  const decoded = verifyUserToken(token);
  return decoded?.userId || null;
}

function encodeState(payload: Record<string, string>) {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

function isConfiguredValue(value: string | undefined) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  const blocked = ['placeholder', 'your-', 'tu-', 'changeme', 'example'];
  const lower = normalized.toLowerCase();
  return !blocked.some((token) => lower.includes(token));
}

function normalizeBaseUrl(value: string | undefined) {
  if (!value) return '';
  return value.trim().replace(/\/$/, '');
}

function resolveCallbackBaseUrl(request: NextRequest) {
  const fromExplicit = normalizeBaseUrl(process.env.CONNECT_OAUTH_REDIRECT_BASE_URL);
  if (fromExplicit) return fromExplicit;

  const fromDomain = normalizeBaseUrl(process.env.NEXT_PUBLIC_DOMAIN);
  if (fromDomain) return fromDomain;

  const fromNextAuth = normalizeBaseUrl(process.env.NEXTAUTH_URL);
  if (fromNextAuth) return fromNextAuth;

  return request.nextUrl.origin;
}

function buildMetaOAuthUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'ads_read,ads_management,business_management');
  return url.toString();
}

function buildGoogleOAuthUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/adwords openid email profile');
  return url.toString();
}

function buildTikTokOAuthUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL('https://ads.tiktok.com/marketing_api/auth');
  url.searchParams.set('app_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

async function resolveMetaClientIdFromWorkspace() {
  const record = await prisma.adminWorkspaceConfig.findUnique({ where: { key: 'main' } });
  const stored = (record?.platformConfig || {}) as Record<string, unknown>;
  return String(stored.metaAppId || '').trim();
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { platform?: string };
    const platform = String(body.platform || '').trim().toLowerCase() as Platform;

    if (!ALLOWED_PLATFORMS.has(platform)) {
      return NextResponse.json({ error: 'Plataforma invalida para OAuth.' }, { status: 400 });
    }

    const callbackBaseUrl = resolveCallbackBaseUrl(request);
    const redirectUri = `${callbackBaseUrl}/api/connect/oauth/callback`;
    const state = encodeState({
      userId,
      platform,
      nonce: randomUUID(),
      ts: String(Date.now()),
    });

    if (platform === 'instagram' || platform === 'facebook') {
      const fromEnv = resolveMetaClientId();
      const clientId = fromEnv || (await resolveMetaClientIdFromWorkspace());
      if (!clientId) {
        return NextResponse.json(
          {
            error:
              'Falta configurar Meta OAuth. Define META_APP_ID (o FACEBOOK_APP_ID) con un valor real en .env.local y en Vercel. Tambien puedes usar NEXT_PUBLIC_META_APP_ID.',
            requiredVars: ['META_APP_ID', 'FACEBOOK_APP_ID', 'NEXT_PUBLIC_META_APP_ID'],
            redirectUri,
            callbackPath: '/api/connect/oauth/callback',
          },
          { status: 412 }
        );
      }

      return NextResponse.json({
        url: buildMetaOAuthUrl(clientId, redirectUri, state),
      });
    }

    if (platform === 'google') {
      const clientId = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
      if (!isConfiguredValue(clientId)) {
        return NextResponse.json(
          {
            error: 'Falta GOOGLE_ADS_CLIENT_ID (o GOOGLE_CLIENT_ID) para iniciar OAuth de Google Ads.',
          },
          { status: 412 }
        );
      }

      return NextResponse.json({
        url: buildGoogleOAuthUrl(clientId, redirectUri, state),
      });
    }

    const tiktokClientId = process.env.TIKTOK_ADS_CLIENT_ID || process.env.TIKTOK_CLIENT_ID || '';
    if (!isConfiguredValue(tiktokClientId)) {
      return NextResponse.json(
        {
          error: 'Falta TIKTOK_ADS_CLIENT_ID (o TIKTOK_CLIENT_ID) para iniciar OAuth de TikTok Ads.',
        },
        { status: 412 }
      );
    }

    return NextResponse.json({
      url: buildTikTokOAuthUrl(tiktokClientId, redirectUri, state),
    });
  } catch (error) {
    console.error('OAuth start error:', error);
    return NextResponse.json({ error: 'No se pudo iniciar OAuth.' }, { status: 500 });
  }
}

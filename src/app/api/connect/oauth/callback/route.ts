import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exchangeMetaCodeForToken, fetchMetaAdAccounts, resolveMetaClientId, resolveMetaClientSecret } from '@/lib/meta-ads';

export const dynamic = 'force-dynamic';

type Platform = 'instagram' | 'facebook' | 'google' | 'tiktok';

type OAuthState = {
  userId: string;
  platform: Platform;
  nonce: string;
  ts: string;
};

function decodeState(stateValue: string | null): OAuthState | null {
  if (!stateValue) {
    return null;
  }

  try {
    const raw = Buffer.from(stateValue, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw) as Partial<OAuthState>;

    if (!parsed.userId || !parsed.platform || !parsed.nonce || !parsed.ts) {
      return null;
    }

    if (!['instagram', 'facebook', 'google', 'tiktok'].includes(parsed.platform)) {
      return null;
    }

    return parsed as OAuthState;
  } catch {
    return null;
  }
}

function buildRedirect(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/dashboard/connect', request.nextUrl.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
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

async function resolveMetaCredentialsFromWorkspace() {
  const record = await prisma.adminWorkspaceConfig.findUnique({ where: { key: 'main' } });
  const stored = (record?.platformConfig || {}) as Record<string, unknown>;
  return {
    clientId: String(stored.metaAppId || '').trim(),
    clientSecret: String(stored.metaAppSecret || '').trim(),
  };
}

export async function GET(request: NextRequest) {
  const state = decodeState(request.nextUrl.searchParams.get('state'));
  if (!state) {
    return buildRedirect(request, { oauth: 'error', reason: 'invalid_state' });
  }

  const error = request.nextUrl.searchParams.get('error');
  const code = request.nextUrl.searchParams.get('code');

  try {
    if (error || !code) {
      await prisma.connectionRequest.create({
        data: {
          userId: state.userId,
          platform: state.platform,
          setupPreference: 'oauth',
          status: 'failed',
          notes: error ? `oauth_error:${error}` : 'oauth_error:no_code',
        },
      });

      return buildRedirect(request, {
        oauth: 'error',
        platform: state.platform,
        reason: error || 'missing_code',
      });
    }

    if (state.platform === 'instagram' || state.platform === 'facebook') {
      const workspace = await resolveMetaCredentialsFromWorkspace();
      const clientId = workspace.clientId || resolveMetaClientId();
      const clientSecret = workspace.clientSecret || resolveMetaClientSecret();

      if (!clientId || !clientSecret) {
        await prisma.connectionRequest.create({
          data: {
            userId: state.userId,
            platform: state.platform,
            setupPreference: 'oauth',
            status: 'failed',
            notes: 'oauth_error:meta_config_missing',
          },
        });

        return buildRedirect(request, {
          oauth: 'error',
          platform: state.platform,
          reason: 'meta_config_missing',
        });
      }

      const redirectUri = `${resolveCallbackBaseUrl(request)}/api/connect/oauth/callback`;
      const tokenData = await exchangeMetaCodeForToken({
        code,
        redirectUri,
        clientId,
        clientSecret,
      });

      const adAccounts = await fetchMetaAdAccounts(tokenData.accessToken);
      const primaryAccount =
        adAccounts.find((account) => Number(account.account_status || 0) === 1) ||
        adAccounts[0] ||
        null;

      const accountId = primaryAccount?.id || `meta-user-${Date.now()}`;
      const accountName = primaryAccount?.name || `${state.platform.toUpperCase()} Ads`;

      await prisma.adAccount.upsert({
        where: {
          userId_platform_accountId: {
            userId: state.userId,
            platform: state.platform,
            accountId,
          },
        },
        create: {
          userId: state.userId,
          platform: state.platform,
          accountId,
          accessToken: tokenData.accessToken,
          expiresAt: tokenData.expiresAt,
          accountName,
          connected: true,
        },
        update: {
          accessToken: tokenData.accessToken,
          expiresAt: tokenData.expiresAt,
          accountName,
          connected: true,
        },
      });

      await prisma.connectionRequest.create({
        data: {
          userId: state.userId,
          platform: state.platform,
          setupPreference: 'oauth',
          status: 'authorized',
          notes: `oauth_success:meta:${new Date().toISOString()}`,
        },
      });

      return buildRedirect(request, {
        oauth: 'success',
        platform: state.platform,
      });
    }

    const existingAccount = await prisma.adAccount.findFirst({
      where: {
        userId: state.userId,
        platform: state.platform,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!existingAccount) {
      await prisma.adAccount.create({
        data: {
          userId: state.userId,
          platform: state.platform,
          accountId: `oauth-${state.platform}-${Date.now()}`,
          accessToken: `oauth-code:${code.slice(0, 42)}`,
          accountName: `${state.platform.toUpperCase()} OAuth`,
          connected: true,
        },
      });
    }

    await prisma.connectionRequest.create({
      data: {
        userId: state.userId,
        platform: state.platform,
        setupPreference: 'oauth',
        status: 'authorized',
        notes: `oauth_success:${new Date().toISOString()}`,
      },
    });

    return buildRedirect(request, {
      oauth: 'success',
      platform: state.platform,
    });
  } catch (dbError) {
    console.error('OAuth callback error:', dbError);
    return buildRedirect(request, {
      oauth: 'error',
      platform: state.platform,
      reason: 'callback_failed',
    });
  }
}

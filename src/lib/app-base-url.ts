import type { NextRequest } from 'next/server';

function trimSlash(s: string) {
  return s.replace(/\/$/, '');
}

function normalizeExplicitBase(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  return v.startsWith('http') ? trimSlash(v) : `https://${trimSlash(v)}`;
}

/** Origen canónico desde env (emails, enlaces públicos). Prioriza `NEXT_PUBLIC_APP_URL`. */
function resolveExplicitPublicUrlFromEnv(): string | undefined {
  return (
    normalizeExplicitBase(process.env.NEXT_PUBLIC_APP_URL) || normalizeExplicitBase(process.env.APP_BASE_URL)
  );
}

function devLocalhostFallback(): string {
  return 'http://localhost:3000';
}

function productionLastResortBase(): string {
  return 'https://www.gotnexora.com';
}

/**
 * Origen público de la app (OAuth redirect, redirects post-login).
 * Orden: NEXT_PUBLIC_APP_URL / APP_BASE_URL → cabeceras proxy (Vercel) → nextUrl → env de dominio → VERCEL_URL.
 */
export function resolveAppBaseUrl(request: NextRequest): string {
  const explicit = resolveExplicitPublicUrlFromEnv();
  if (explicit) {
    return explicit;
  }

  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (forwardedHost) {
    const proto = (forwardedProto?.split(',')[0] ?? 'https').trim() || 'https';
    const host = forwardedHost.split(',')[0].trim();
    if (host) return `${proto}://${host}`;
  }

  try {
    const origin = request.nextUrl?.origin;
    if (origin && origin !== 'null') return trimSlash(origin);
  } catch {
    /* ignore */
  }

  const domain = process.env.NEXT_PUBLIC_DOMAIN?.trim();
  if (domain) {
    return domain.startsWith('http') ? trimSlash(domain) : `https://${trimSlash(domain)}`;
  }

  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth) return trimSlash(nextAuth);

  if (process.env.VERCEL_URL) {
    return `https://${trimSlash(process.env.VERCEL_URL)}`;
  }

  if (process.env.NODE_ENV !== 'production') {
    return devLocalhostFallback();
  }
  return productionLastResortBase();
}

/**
 * Origen público sin `NextRequest` (cron, mailers, jobs). Prioriza `NEXT_PUBLIC_APP_URL` para enlaces en correos.
 */
export function resolveAppBaseUrlFromEnv(): string {
  const explicit = resolveExplicitPublicUrlFromEnv();
  if (explicit) {
    return explicit;
  }

  const domain = process.env.NEXT_PUBLIC_DOMAIN?.trim();
  if (domain) {
    return domain.startsWith('http') ? trimSlash(domain) : `https://${trimSlash(domain)}`;
  }

  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth) return trimSlash(nextAuth);

  if (process.env.VERCEL_URL) {
    return `https://${trimSlash(process.env.VERCEL_URL)}`;
  }

  if (process.env.NODE_ENV !== 'production') {
    return devLocalhostFallback();
  }
  return productionLastResortBase();
}

/** Ruta completa del callback OAuth de Calendar (para mensajes y Google Cloud Console). */
export function calendarOAuthRedirectUri(request: NextRequest): string {
  return `${resolveAppBaseUrl(request)}/api/crm/calendar/connect/callback`;
}

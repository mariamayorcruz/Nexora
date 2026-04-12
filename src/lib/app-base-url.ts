import type { NextRequest } from 'next/server';

function trimSlash(s: string) {
  return s.replace(/\/$/, '');
}

/**
 * Origen público de la app (OAuth redirect, redirects post-login).
 * Orden: APP_BASE_URL / NEXT_PUBLIC_APP_URL → cabeceras proxy (Vercel) → nextUrl → env de dominio → VERCEL_URL.
 */
export function resolveAppBaseUrl(request: NextRequest): string {
  const explicit = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.startsWith('http') ? trimSlash(explicit) : `https://${trimSlash(explicit)}`;
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

  return 'http://localhost:3000';
}

/**
 * Origen público sin `NextRequest` (cron, mailers, jobs). Misma prioridad de env que en producción.
 */
export function resolveAppBaseUrlFromEnv(): string {
  const explicit = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.startsWith('http') ? trimSlash(explicit) : `https://${trimSlash(explicit)}`;
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

  return 'http://localhost:3000';
}

/** Ruta completa del callback OAuth de Calendar (para mensajes y Google Cloud Console). */
export function calendarOAuthRedirectUri(request: NextRequest): string {
  return `${resolveAppBaseUrl(request)}/api/crm/calendar/connect/callback`;
}

import { resolveAppBaseUrlFromEnv } from '@/lib/app-base-url';
import { capitalizeLeadNameForEmail } from '@/lib/format-person-name';

const DEFAULT_VIDEO_STUDIO_URL = 'https://estudio-video-web.vercel.app';
export const AUDIT_FALLBACK_NAME = 'Cliente';

export const AUDIT_DIAGNOSIS_BULLETS = [
  'Hay campañas o esfuerzos que están consumiendo energía o presupuesto sin retorno claro.',
  'Parte de los leads no está siendo bien aprovechada.',
  'Hay oportunidades rápidas de mejora sin necesidad de aumentar inversión.',
] as const;

function stripPlaceholders(value: string) {
  return value.replace(/\{\{[^}]*\}\}/g, '').replace(/\s+/g, ' ').trim();
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

export function displayNameForAudit(name: string | null | undefined, email: string) {
  const emailLocalPart = String(email || '').split('@')[0] || '';
  const raw = stripPlaceholders(String(name || '').trim() || emailLocalPart);
  const normalized = capitalizeLeadNameForEmail(raw);
  return normalized || AUDIT_FALLBACK_NAME;
}

export function getAuditMeetingLink(): string | undefined {
  const url = process.env.NEXT_PUBLIC_AUDIT_MEETING_URL?.trim();
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

/** Enlaces a pricing: usa `NEXT_PUBLIC_APP_URL` (vía resolveAppBaseUrlFromEnv) salvo que pases `baseUrl` explícito. */
export function getAuditPricingUrl(baseUrl?: string) {
  const origin = trimTrailingSlash(baseUrl || resolveAppBaseUrlFromEnv());
  return `${origin}/#pricing`;
}

export function getAuditVideoStudioUrl() {
  return process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || DEFAULT_VIDEO_STUDIO_URL;
}

export function buildAuditPdfPath(token: string) {
  return `/api/lead-magnets/audit-pdf?t=${encodeURIComponent(token)}`;
}

export function buildAuditPdfUrl(baseUrl: string, token: string) {
  return `${trimTrailingSlash(baseUrl)}${buildAuditPdfPath(token)}`;
}

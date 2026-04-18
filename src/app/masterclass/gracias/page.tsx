import Link from 'next/link';
import { Suspense } from 'react';
import {
  AUDIT_DIAGNOSIS_BULLETS,
  displayNameForAudit,
  getAuditMeetingLink,
  getAuditPricingUrl,
  getAuditVideoStudioUrl,
} from '@/lib/audit-flow';
import { auditVariantLabelFromNicheParam, resolveAuditNiche } from '@/lib/lead-magnets';
import { AuditPdfLinkFromQuery } from './audit-pdf-link';

type AuditNiche = 'servicios' | 'ecommerce' | 'inmobiliario' | 'coaching';

type NicheTheme = {
  badgeClass: string;
  panelClass: string;
};

export const dynamic = 'force-dynamic';

function queryParam(
  sp: { [key: string]: string | string[] | undefined } | undefined,
  key: string
): string {
  const v = sp?.[key];
  if (v === undefined || v === null) return '';
  const s = Array.isArray(v) ? v[0] : v;
  return String(s ?? '').trim();
}

const THEMES: Record<AuditNiche, NicheTheme> = {
  servicios: {
    badgeClass: 'text-cyan-300',
    panelClass: 'border-cyan-400/30 bg-cyan-400/5 text-cyan-100',
  },
  ecommerce: {
    badgeClass: 'text-emerald-300',
    panelClass: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  },
  inmobiliario: {
    badgeClass: 'text-amber-300',
    panelClass: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  },
  coaching: {
    badgeClass: 'text-fuchsia-300',
    panelClass: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100',
  },
};

export default async function MasterclassThankYouPage({
  searchParams,
}: {
  searchParams?: { delivery?: string; email?: string; niche?: string; name?: string; t?: string };
}) {
  const email = queryParam(searchParams, 'email');
  const delivery = queryParam(searchParams, 'delivery') || 'pending_setup';
  const niche = resolveAuditNiche(queryParam(searchParams, 'niche'));
  const theme = THEMES[niche];
  const nicheLabel = auditVariantLabelFromNicheParam(niche);
  const firstName = displayNameForAudit(
    queryParam(searchParams, 'name') || null,
    email || 'cliente@gotnexora.com'
  );
  const meetingUrl = getAuditMeetingLink();
  const pricingHref = getAuditPricingUrl();
  const videoStudioUrl = getAuditVideoStudioUrl();

  return (
    <main className="min-h-screen bg-[#060816] px-4 py-24 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[2.5rem] border border-white/10 bg-slate-900/75 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.4)] md:p-10">
          <p className={`text-xs uppercase tracking-[0.32em] ${theme.badgeClass}`}>
            Tu auditoría ya está lista · {nicheLabel}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
            {firstName}, ya vimos qué está fallando.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Ahora puedes aplicar esto paso a paso dentro de Nexora.
          </p>

          <div
            className={`mt-8 rounded-[1.6rem] border p-5 text-sm leading-7 ${
              delivery === 'sent'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : delivery === 'failed'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : theme.panelClass
            }`}
          >
            {delivery === 'sent' ? (
              <p>
                Te enviamos el correo con el PDF adjunto y el enlace{email ? ` a ${email}` : ''}. Revisa también
                promociones.
              </p>
            ) : delivery === 'failed' ? (
              <p>
                Tu auditoría quedó registrada; el correo puede estar pendiente de configuración. Usa el enlace de
                abajo para descargar el mismo dossier en PDF.
              </p>
            ) : (
              <p>
                Tu acceso está registrado. En cuanto el correo esté activo, recibirás el dossier; mientras tanto
                puedes abrir el PDF aquí.
              </p>
            )}
          </div>

          <div className="mt-10 rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Resumen del dossier</p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-200">
              {AUDIT_DIAGNOSIS_BULLETS.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-7 text-slate-400">
              En el PDF adjunto y en el enlace de abajo encontrarás el detalle: qué está fallando, dónde se pierde
              oportunidad y qué aplicar esta semana, sin añadir complejidad.
            </p>
          </div>

          <div className="mt-10 rounded-[2rem] border border-teal-300/20 bg-teal-400/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-200/80">Siguiente paso</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Abre primero tu auditoría completa.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Este es el recurso prometido. Revísalo primero y luego decide si quieres implementarlo dentro de Nexora
              o pedir que lo revisemos contigo.
            </p>
            <div className="mt-6">
              <Suspense fallback={null}>
                <AuditPdfLinkFromQuery />
              </Suspense>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4">
            <a
              href={pricingHref}
              className="inline-flex justify-center rounded-2xl bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 px-6 py-3 text-center text-sm font-semibold text-white transition hover:brightness-110 sm:w-fit"
            >
              Suscríbete ahora
            </a>
            {meetingUrl ? (
              <a
                href={meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex justify-center rounded-2xl border border-cyan-300/40 bg-slate-900/70 px-6 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:bg-slate-800 sm:w-fit"
              >
                Prefiero que me lo expliquen
              </a>
            ) : null}
          </div>

          <p className="mt-10 text-center text-xs text-slate-500 sm:text-left">
            ¿Necesitas el estudio de video?{' '}
            <Link href={videoStudioUrl} className="text-slate-400 underline hover:text-slate-300">
              Ábrelo aquí
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

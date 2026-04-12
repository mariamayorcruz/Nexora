import Link from 'next/link';
import { buildMasterclassEmail, getLeadMagnetLinks } from '@/lib/lead-magnets';

type AuditNiche = 'servicios' | 'ecommerce' | 'inmobiliario' | 'coaching';

type NicheTheme = {
  label: string;
  badgeClass: string;
  titleAccentClass: string;
  panelClass: string;
  insightTitle: string;
  insightBullets: string[];
};

const THEMES: Record<AuditNiche, NicheTheme> = {
  servicios: {
    label: 'Servicios',
    badgeClass: 'text-cyan-300',
    titleAccentClass: 'text-cyan-100',
    panelClass: 'border-cyan-400/30 bg-cyan-400/5 text-cyan-100',
    insightTitle: 'Foco recomendado para servicios',
    insightBullets: [
      'Acelera primer contacto comercial en menos de 24h.',
      'Vincula cada lead a una siguiente accion con fecha.',
      'Refuerza autoridad con casos por tipo de cliente.',
    ],
  },
  ecommerce: {
    label: 'E-commerce',
    badgeClass: 'text-emerald-300',
    titleAccentClass: 'text-emerald-100',
    panelClass: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
    insightTitle: 'Foco recomendado para e-commerce',
    insightBullets: [
      'Pausa audiencias con CPA fuera de rango antes de escalar.',
      'Dobla creativos ganadores con variaciones de hook y oferta.',
      'Prioriza rentabilidad neta, no solo volumen de compras.',
    ],
  },
  inmobiliario: {
    label: 'Inmobiliario',
    badgeClass: 'text-amber-300',
    titleAccentClass: 'text-amber-100',
    panelClass: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
    insightTitle: 'Foco recomendado para inmobiliario',
    insightBullets: [
      'Sube show rate con confirmaciones y recordatorios por etapa.',
      'Filtra perfil comprador para priorizar citas de alta intencion.',
      'Nutre leads no listos con secuencia corta y concreta.',
    ],
  },
  coaching: {
    label: 'Coaching / Infoproducto',
    badgeClass: 'text-fuchsia-300',
    titleAccentClass: 'text-fuchsia-100',
    panelClass: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100',
    insightTitle: 'Foco recomendado para coaching',
    insightBullets: [
      'Mejora aplicacion a llamada con filtro de fit.',
      'Abre llamadas con diagnostico, no con pitch directo.',
      'Conecta objeciones con costo real de no actuar.',
    ],
  },
};

function normalizeNiche(value?: string): AuditNiche {
  const niche = String(value || '').trim().toLowerCase();
  if (niche === 'ecommerce') return 'ecommerce';
  if (niche === 'inmobiliario') return 'inmobiliario';
  if (niche === 'coaching') return 'coaching';
  return 'servicios';
}

export default async function MasterclassThankYouPage({
  searchParams,
}: {
  searchParams?: { delivery?: string; email?: string; niche?: string };
}) {
  const email = searchParams?.email || '';
  const delivery = searchParams?.delivery || 'pending_setup';
  const niche = normalizeNiche(searchParams?.niche);
  const theme = THEMES[niche];
  const emailPreview = await buildMasterclassEmail({ email: email || 'hola@nexora.com', niche });
  const links = getLeadMagnetLinks();

  return (
    <main className="min-h-screen bg-[#060816] px-4 py-24 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2.5rem] border border-white/10 bg-slate-900/75 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.4)] md:p-10">
          <p className={`text-xs uppercase tracking-[0.32em] ${theme.badgeClass}`}>Auditoría completada · {theme.label}</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl text-white">
            Tu diagnóstico en 7 minutos está listo, {email ? email.split('@')[0].split('.')[0] : 'amigo'}.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Te compartimos exactamente dónde están las fugas, qué mover primero y cómo implementarlo en Nexora esta
            semana sin seguir improvisando.
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
                ✓ Diagnóstico enviado a{email ? ` ${email}` : ' tu correo'}. Revisa bandeja principal y promociones.
              </p>
            ) : delivery === 'failed' ? (
              <p>
                Tu auditoría ya quedó registrada. El correo está pendiente de configuración, pero abajo tienes el
                diagnóstico completo para no perder momentum.
              </p>
            ) : (
              <p>
                Tu acceso está registrado y el correo está en proceso. Aquí debajo tienes tu diagnóstico inmediato.
              </p>
            )}
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
              <p className={`text-xs uppercase tracking-[0.24em] font-semibold ${theme.badgeClass}`}>Paso 1</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Identifica las fugas</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Qué campañas están consumiendo presupuesto sin retorno suficiente, dónde se pierde dinero.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
              <p className={`text-xs uppercase tracking-[0.24em] font-semibold ${theme.badgeClass}`}>Paso 2</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Revisa el seguimiento</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Dónde se pierden leads entre canales, en qué parte del funnel se frena la conversión.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
              <p className={`text-xs uppercase tracking-[0.24em] font-semibold ${theme.badgeClass}`}>Esta semana</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Próxima acción</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Qué hacer los próximos 7 días para recuperar rentabilidad y activar mejor seguimiento.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
            <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${theme.titleAccentClass}`}>{theme.insightTitle}</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-200">
              {theme.insightBullets.map((bullet) => (
                <p key={bullet}>✓ {bullet}</p>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] border border-orange-400/30 bg-orange-500/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">Lo que define tu diagnóstico</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-200">
              <p>✓ <strong>Si gastas mucho pero no conviertes:</strong> el problema es saturación de herramientas o falta de seguimiento.</p>
              <p>✓ <strong>Si tienes leads pero no avanzan:</strong> necesitas CRM + flujo de etapas, no más campañas.</p>
              <p>✓ <strong>Si saltas entre Meta, Google, TikTok:</strong> una consola unificada es lo que cierres más cuando tengas todos datos en un lugar.</p>
              <p>✓ <strong>Si no sabes exactamente qué esperar:</strong> tu siguiente paso es agendar 15 minutos con alguien que haya visto casos como el tuyo.</p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <Link
              href={`${links.signupUrl}?source=audit&niche=${niche}`}
              className="rounded-2xl bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 px-6 py-3 text-center text-sm font-semibold text-white transition hover:brightness-110"
            >
              Agendar demostracion (15 min)
            </Link>
            <Link href="/#pricing" className="rounded-2xl border border-cyan-300/40 bg-slate-900/70 px-6 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:bg-slate-800">
              Ver planes de Nexora
            </Link>
            <Link
              href={links.aiStudioUrl}
              className="rounded-2xl border border-slate-500 bg-slate-900 px-6 py-3 text-center text-sm font-semibold text-slate-300 transition hover:border-slate-400 hover:bg-slate-800"
            >
              Abrir estudio de video
            </Link>
          </div>

          <div className="mt-12 rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 font-semibold">Esto es lo que le llegó por correo</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{emailPreview.subject}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{emailPreview.preview}</p>
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-5 text-sm leading-7 text-slate-200">
              <p className="font-semibold text-white">Extracto del correo:</p>
              <p className="mt-3">
                Hola,
              </p>
              <p className="mt-2">
                Tu auditoría en 7 minutos está lista. Aquí están los 3 puntos donde puedes recuperar más rentabilidad esta semana.
              </p>
              <ul className="mt-4 space-y-2">
                <li>✓ Paso 1: Identifica campañas que gastan sin retorno suficiente (la fuga).</li>
                <li>✓ Paso 2: Localiza dónde se pierden leads entre canales (seguimiento roto).</li>
                <li>✓ Paso 3: Define tu acción ejecutable para mejorar ROI esta semana.</li>
              </ul>
              <p className="mt-4 text-slate-400">
                Si tienes dudas específicas sobre tu diagnóstico, responde este correo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

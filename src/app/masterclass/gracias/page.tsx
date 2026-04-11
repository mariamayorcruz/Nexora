import Link from 'next/link';
import { buildMasterclassEmail, getLeadMagnetLinks } from '@/lib/lead-magnets';

export default function MasterclassThankYouPage({
  searchParams,
}: {
  searchParams?: { delivery?: string; email?: string };
}) {
  const email = searchParams?.email || '';
  const delivery = searchParams?.delivery || 'pending_setup';
  const emailPreview = buildMasterclassEmail({ email: email || 'hola@nexora.com' });
  const links = getLeadMagnetLinks();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_55%,#f8fafc_100%)] px-4 py-24 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-10">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Entrega inmediata</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">Tu guia gratuita de Nexora ya esta lista.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Aqui no te dejamos con una promesa vacia. Te entregamos una guia propia para ayudarte a ordenar la
            decision, aterrizar la oferta y convertir una idea difusa en un sistema mas claro.
          </p>

          <div
            className={`mt-8 rounded-[1.6rem] border p-5 text-sm leading-7 ${
              delivery === 'sent'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : delivery === 'failed'
                ? 'border-amber-200 bg-amber-50 text-amber-950'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {delivery === 'sent' ? (
              <p>
                Tambien te lo enviamos por correo{email ? ` a ${email}` : ''}. Si no lo ves enseguida, revisa promociones
                o spam.
              </p>
            ) : delivery === 'failed' ? (
              <p>
                Tu acceso ya quedo registrado, pero el correo no pudo salir en este intento. Aun asi, ya tienes la
                entrega completa aqui mismo para no perder momentum.
              </p>
            ) : (
              <p>
                Tu acceso ya quedo registrado. Mientras el envio por correo termina de quedar configurado, aqui tienes la
                entrega inmediata y los siguientes pasos claros.
              </p>
            )}
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <div className="rounded-[2rem] bg-slate-50 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">01</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">La promesa principal</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Define que estas vendiendo realmente y cual es el resultado que hace que alguien quiera seguir contigo.
              </p>
            </div>
            <div className="rounded-[2rem] bg-slate-50 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">02</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">El cuello de botella</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Detecta si el problema esta en la oferta, el mensaje, el funnel, el seguimiento o la falta de sistema.
              </p>
            </div>
            <div className="rounded-[2rem] bg-slate-50 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">03</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">El siguiente paso</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Baja esa claridad a campana, pitch, propuesta o secuencia dentro de Nexora para convertir mejor.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-[2rem] border border-orange-200 bg-orange-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Mapa de decisiones Nexora</p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-orange-950">
              <p>1. Si tu promesa todavia se explica demasiado, no necesitas mas volumen: necesitas mas claridad.</p>
              <p>2. Si tienes leads pero no avanzan, el problema ya no es trafico: es seguimiento, oferta o confianza.</p>
              <p>3. Si la operacion depende de demasiadas herramientas separadas, lo que falta no es esfuerzo: es sistema.</p>
              <p>4. Si ya sabes que estas vendiendo y a quien, el siguiente salto es convertir eso en una pieza ejecutable: anuncio, pitch, CRM y funnel.</p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <Link href="/dashboard/studio" className="btn-primary text-center">
              Ir a AI Studio Nexora
            </Link>
            <Link href="/#pricing" className="btn-secondary text-center">
              Contratar un plan
            </Link>
            <Link
              href={links.appUrl || '/auth/signup'}
              className="rounded-full border border-slate-300 px-6 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              {links.appUrl ? 'Descargar la app' : 'Acceso prioritario a la app'}
            </Link>
          </div>

          <div className="mt-12 rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Esto es lo que le llega a la persona</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">{emailPreview.subject}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{emailPreview.preview}</p>
            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700">
              <p>Hola,</p>
              <p className="mt-3">
                Tu recurso gratuito ya esta listo. Aqui tienes una guia para mejorar tu proceso comercial y definir el
                siguiente paso con mayor claridad.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>Ir a AI Studio Nexora</li>
                <li>Ver planes de Nexora</li>
                <li>{links.appUrl ? 'Descargar la app' : 'Acceso prioritario a la app'}</li>
              </ul>
              <p className="mt-4">Si quiere ayuda para aterrizarlo, puede responder al correo.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

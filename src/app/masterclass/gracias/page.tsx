import Link from 'next/link';

export default function MasterclassThankYouPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_55%,#f8fafc_100%)] px-4 py-24 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-10">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Entrega inmediata</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
            Tu guía gratuita de Nexora ya está lista.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Aquí no te dejamos con una promesa vacía. Te entregamos una guía propia para ayudarte a ordenar la
            decisión, aterrizar la oferta y convertir una idea difusa en un sistema más claro.
          </p>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <div className="rounded-[2rem] bg-slate-50 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">01</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">La promesa principal</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Define qué estás vendiendo realmente y cuál es el resultado que hace que alguien quiera seguir contigo.
              </p>
            </div>
            <div className="rounded-[2rem] bg-slate-50 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">02</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">El cuello de botella</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Detecta si el problema está en la oferta, el mensaje, el funnel, el seguimiento o la falta de sistema.
              </p>
            </div>
            <div className="rounded-[2rem] bg-slate-50 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">03</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">El siguiente paso</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Baja esa claridad a campaña, pitch, propuesta o secuencia dentro de Nexora para convertir mejor.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-[2rem] border border-orange-200 bg-orange-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Mapa de decisiones Nexora</p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-orange-950">
              <p>1. Si tu promesa todavía se explica demasiado, no necesitas más volumen: necesitas más claridad.</p>
              <p>2. Si tienes leads pero no avanzan, el problema ya no es tráfico: es seguimiento, oferta o confianza.</p>
              <p>3. Si la operación depende de demasiadas herramientas separadas, lo que falta no es esfuerzo: es sistema.</p>
              <p>4. Si ya sabes qué estás vendiendo y a quién, el siguiente salto es convertir eso en una pieza ejecutable: anuncio, pitch, CRM y funnel.</p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/dashboard/studio" className="btn-primary text-center">
              Llevar esto a AI Studio
            </Link>
            <Link href="/auth/signup" className="btn-secondary text-center">
              Crear cuenta en Nexora
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

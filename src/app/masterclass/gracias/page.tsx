import Link from 'next/link';

export default function MasterclassThankYouPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_55%,#f8fafc_100%)] px-4 py-24 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-10">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Entrega inmediata</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
            Tu master class gratis ya está lista.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            En lugar de dejarte solo con una promesa, Nexora te entrega un recurso accionable para ayudarte a ordenar
            decisiones, aterrizar la oferta y avanzar con más claridad.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              'Descarga el PDF ahora mismo',
              'Úsalo como mapa rápido de decisión',
              'Luego vuelve para convertir esto en sistema',
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50 p-5 text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a href="/resources/el-mapa-de-decisiones-48-horas.pdf" download className="btn-primary text-center">
              Descargar el recurso
            </a>
            <Link href="/auth/signup" className="btn-secondary text-center">
              Crear cuenta en Nexora
            </Link>
          </div>

          <div className="mt-10 rounded-[2rem] border border-orange-200 bg-orange-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Qué sigue después</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-orange-950">
              <p>1. Lee el mapa y detecta dónde se te está rompiendo la claridad comercial.</p>
              <p>2. Usa AI Studio para convertir eso en hooks, propuesta, pitch o secuencia.</p>
              <p>3. Lleva esa operación a campañas, funnel y CRM dentro de Nexora.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

'use client';

export default function Demo() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-dark text-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Demo en Vivo</h2>
          <p className="text-xl text-gray-300">Mira cómo funciona Nexora en 3 minutos</p>
        </div>

        <div className="relative">
          <div className="aspect-video rounded-2xl overflow-hidden border border-gray-700 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-10 flex flex-col justify-between">
            <div>
              <span className="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-300">
                DEMO OFICIAL NEXORA
              </span>
              <h3 className="mt-4 text-2xl md:text-3xl font-bold leading-tight">
                Vista real del dashboard unificado de anuncios
              </h3>
              <p className="mt-3 text-gray-300 max-w-2xl">
                Sustituye este bloque con tu video oficial cuando lo tengas listo.
                Mientras tanto, puedes agendar una demo guiada con tu equipo.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/auth/signup"
                className="inline-flex items-center rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-400 transition-colors"
              >
                Probar ahora
              </a>
              <a
                href="mailto:demo@gotnexora.com"
                className="inline-flex items-center rounded-lg border border-gray-500 px-5 py-3 text-sm font-semibold text-white hover:border-gray-300 transition-colors"
              >
                Solicitar demo
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="font-bold mb-2">Conexión Rápida</h3>
            <p className="text-gray-300">Conecta tus redes en menos de 5 minutos</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="font-bold mb-2">Análisis Inmediato</h3>
            <p className="text-gray-300">Ve todos tus datos en el dashboard unificado</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="font-bold mb-2">Optimización Automática</h3>
            <p className="text-gray-300">Deja que la IA trabaje por ti</p>
          </div>
        </div>
      </div>
    </section>
  );
}

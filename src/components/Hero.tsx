'use client';

import RevealOnScroll from '@/components/ui/RevealOnScroll';

const quickStats = [
  { value: '-12h', label: 'semana ahorrada' },
  { value: '3.4x', label: 'ROAS promedio' },
  { value: '<10 min', label: 'nueva cuenta' },
];

const workspaceModules = [
  { name: 'Meta Ads', status: 'Conectado', tone: 'emerald' },
  { name: 'Google Ads', status: 'Conectado', tone: 'emerald' },
  { name: 'TikTok Ads', status: 'Conectado', tone: 'emerald' },
  { name: 'CRM', status: 'Pipeline activo', tone: 'cyan' },
  { name: 'Facturacion', status: 'Stripe activo', tone: 'amber' },
];

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-[#060816]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.25),transparent_40%),radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_35%)]" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 backdrop-blur-md">
            ✅ Reemplaza 4 plataformas + Excel
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight text-white md:text-7xl">
            Una sola plataforma.<br />
            <span className="bg-gradient-to-r from-orange-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              4 anuncios. 0 caos.
            </span>
          </h1>

          <p className="mb-8 text-xl leading-relaxed text-slate-300">
            Centraliza Meta, Google, TikTok, CRM y facturación.<br />
            IA que te ayuda a vender más, no solo a reportar.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="#diagnostico"
              className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-4 text-lg font-semibold text-slate-950 transition hover:brightness-110"
            >
              Quiero mi auditoría gratis (7 min)
            </a>
            <a
              href="#demo"
              className="rounded-2xl border border-cyan-300/35 bg-slate-900/70 px-8 py-4 text-lg font-semibold text-cyan-100 transition hover:bg-slate-800"
            >
              Ver demo en vivo
            </a>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            {quickStats.map((item, index) => (
              <RevealOnScroll key={item.label} delayMs={index * 100}>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4">
                  <p className="text-3xl font-bold text-emerald-400">{item.value}</p>
                  <p className="text-sm text-slate-400">{item.label}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>

        <div className="relative space-y-4">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
            <div className="aspect-video">
              <video
                className="h-full w-full object-cover"
                controls
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              >
                <source src="/videos/nexora-demo.mp4" type="video/mp4" />
                Tu navegador no pudo cargar el video.
              </video>
            </div>
          </div>
          <div className="absolute -right-4 -top-4 rounded-2xl bg-emerald-500 px-6 py-2 text-sm font-bold text-black shadow-xl">
            Live Workspace
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Nexora Live Workspace</h3>
              <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                4 anuncios activos
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Vista operativa única para campañas, seguimiento comercial y facturación.
            </p>

            <div className="mt-4 grid gap-2">
              {workspaceModules.map((module) => (
                <div key={module.name} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2">
                  <span className="text-sm text-slate-200">{module.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      module.tone === 'emerald'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : module.tone === 'amber'
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-cyan-500/15 text-cyan-300'
                    }`}
                  >
                    {module.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

export default function Demo() {
  const secondCutUrl = '/videos/nexora-vsl-demo.mp4';

  return (
    <section id="demo" className="relative overflow-hidden bg-[#060816] py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 text-center">

        {/* Heading */}
        <div className="mb-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Nexora en acción: Todo en una sola pantalla
          </h2>
          <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto">
            Centraliza Meta Ads, Google Ads, TikTok Ads, CRM y IA.<br />
            <span className="text-orange-400 font-medium">
              Deja de saltar entre 4 plataformas y empieza a escalar sin caos.
            </span>
          </p>
        </div>

        {/* Video container */}
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-cyan-400/20 bg-black shadow-2xl">
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
              <source src={secondCutUrl} type="video/mp4" />
              Tu navegador no pudo cargar el video demo.
            </video>
          </div>

          {/* Floating badge */}
          <div className="absolute left-6 top-6 flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-1.5 text-sm font-bold text-black shadow-lg">
            <span className="w-2 h-2 bg-black rounded-full animate-pulse" />
            LIVE WORKSPACE
          </div>
        </div>

        <p className="text-sm text-slate-400 mt-6">
          Duración aproximada: ve cómo se ve el dashboard real en menos de 2 minutos
        </p>
      </div>
    </section>
  );
}

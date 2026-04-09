'use client';

type DemoHighlight = {
  badge: string;
  title: string;
  description: string;
};

const highlights: DemoHighlight[] = [
  {
    badge: 'Control',
    title: 'Visión unificada del rendimiento',
    description: 'Muestra inversión, conversiones, ROI y estado de campañas en una sola lectura.',
  },
  {
    badge: 'Velocidad',
    title: 'Decisiones más rápidas',
    description: 'Evita saltar entre plataformas y detecta antes qué conviene escalar, pausar o corregir.',
  },
  {
    badge: 'Claridad',
    title: 'Más orden para vender mejor',
    description: 'La experiencia está pensada para equipos, agencias y negocios que quieren operar con control real.',
  },
];

export default function Demo() {
  const videoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || '/videos/nexora-demo.mp4';

  return (
    <section id="demo" className="bg-slate-950 px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <span className="section-tag section-tag-dark">Demo</span>
          <h2 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
            Un demo real para vender mejor el producto.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Este video muestra con más claridad cómo se siente Nexora en uso real: control, lectura rápida del rendimiento y una operación publicitaria mucho más ordenada.
          </p>
        </div>

        <div className="mt-12 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_25px_80px_rgba(15,23,42,0.5)]">
            <video
              className="aspect-video w-full bg-black object-cover"
              controls
              playsInline
              preload="metadata"
            >
              <source src={videoUrl} type="video/mp4" />
              Tu navegador no pudo cargar el video.
            </video>
          </div>

          <div className="space-y-4">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 transition hover:bg-white/[0.06]"
              >
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{item.badge}</p>
                <h3 className="mt-3 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
              </div>
            ))}

            <div className="rounded-[1.75rem] border border-orange-400/20 bg-orange-400/10 p-6">
              <p className="text-xs uppercase tracking-[0.28em] text-orange-200">Lo que comunica</p>
              <p className="mt-3 text-sm leading-7 text-orange-50">
                Nexora no solo organiza campañas. También transmite una operación más seria, más clara y más lista para escalar sin caos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

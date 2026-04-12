'use client';

import RevealOnScroll from '@/components/ui/RevealOnScroll';

interface Testimonial {
  name: string;
  role: string;
  company: string;
  industry: string;
  result: string;
  metric: string;
  quote: string;
  timeframe: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Carla M.',
    role: 'Directora de Marketing',
    company: 'Estudio creativo de servicios',
    industry: 'Servicios',
    result: '+31% leads calificados',
    metric: 'en 45 días',
    quote:
      'Antes perdíamos prospectos entre canales porque nadie tenía la foto completa. Con Nexora unificamos campañas y seguimiento comercial en una sola vista. Ahora el equipo sabe exactamente qué mover cada día.',
    timeframe: '45 días',
  },
  {
    name: 'Diego R.',
    role: 'Founder & CEO',
    company: 'Ecommerce de nicho',
    industry: 'Ecommerce',
    result: '-22% costo por adquisición',
    metric: 'en 6 semanas',
    quote:
      'Reasignamos presupuesto con lectura diaria de rendimiento. Pausamos las campañas de bajo retorno que antes pasaban desapercibidas. El ahorro en 6 semanas cubrió con creces el costo de la plataforma.',
    timeframe: '6 semanas',
  },
  {
    name: 'Ana P.',
    role: 'Socia Comercial',
    company: 'Consultoría B2B',
    industry: 'Consultoría',
    result: '+18% cierres desde pipeline',
    metric: 'en 2 meses',
    quote:
      'El pipeline con etapas y siguientes acciones claras cambió completamente cómo seguimos oportunidades. Pasamos de un Excel caótico a un flujo comercial con ritmo. Los cierres subieron 18% en dos meses.',
    timeframe: '2 meses',
  },
];

export default function Testimonials() {
  return (
    <section className="relative overflow-hidden bg-[#060816] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <RevealOnScroll>
          <div className="mb-14 text-center">
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-400">Resultados reales</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Lo que logran los equipos que usan Nexora
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
              No estimaciones. Casos de clientes que unificaron su operación y midieron el impacto.
            </p>
          </div>
        </RevealOnScroll>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((item, index) => (
            <RevealOnScroll key={item.name} delayMs={index * 100}>
              <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-slate-900/60 p-7 backdrop-blur transition hover:border-cyan-400/30 hover:shadow-[0_0_40px_rgba(34,211,238,0.07)]">
                {/* Metric badge */}
                <div className="mb-5 inline-flex w-fit flex-col rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                  <span className="text-2xl font-bold text-emerald-400">{item.result}</span>
                  <span className="mt-0.5 text-xs text-emerald-300/70">{item.metric}</span>
                </div>

                {/* Quote */}
                <p className="flex-1 text-sm leading-7 text-slate-300">"{item.quote}"</p>

                {/* Attribution */}
                <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 text-sm font-bold text-white">
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="text-xs text-slate-400">
                      {item.role} · {item.company}
                    </p>
                  </div>
                  <span className="ml-auto rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    {item.industry}
                  </span>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

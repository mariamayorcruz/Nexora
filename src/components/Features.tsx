'use client';

import {
  Activity,
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Shield,
  Users,
} from 'lucide-react';

const painPoints = [
  {
    stat: '14h',
    title: 'Perdidas revisando plataformas separadas',
    description:
      'Saltas entre Meta, Google, TikTok, hojas de cálculo y mensajes internos. Cada cambio operativo corta foco y retrasa decisiones.',
  },
  {
    stat: '$0 visibilidad',
    title: 'Cobras, inviertes y reportas sin una vista central',
    description:
      'Sin una consola unificada es difícil saber qué campaña empuja negocio y cuál solo consume presupuesto.',
  },
  {
    stat: '1 sola fuente',
    title: 'Tu operación necesita un sistema, no otro parche',
    description:
      'Una landing que vende mejor funciona cuando el producto detrás transmite orden, seguridad y autoridad visual.',
  },
];

const pillars = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard unificado',
    description: 'Métricas, gasto, campañas y estados en un layout que reduce ruido y acelera lectura.',
  },
  {
    icon: Activity,
    title: 'Centro de campañas',
    description: 'Consulta actividad, presupuestos y rendimiento desde una sola vista operativa.',
  },
  {
    icon: BarChart3,
    title: 'Analítica clara',
    description: 'Señales visibles para ROI, CTR, conversiones y gasto, sin tener que perseguir números.',
  },
  {
    icon: Users,
    title: 'Panel admin incluido',
    description: 'Usuarios, suscripciones, campañas y configuración del sistema bajo el mismo proyecto.',
  },
  {
    icon: CreditCard,
    title: 'Base lista para cobro',
    description: 'Flujo de autenticación y Stripe conectados para soportar monetización desde el inicio.',
  },
  {
    icon: Shield,
    title: 'Confianza visual',
    description: 'Mensajes más maduros, jerarquía de venta mejor resuelta y una experiencia más creíble.',
  },
];

export default function Features() {
  return (
    <section id="solution" className="bg-[#f8f6f1] px-4 py-24 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <span className="section-tag">El problema</span>
            <h2 className="mt-6 max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">
              Si el sistema se siente improvisado, la conversión también.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Saleads.ai funciona por una cosa muy clara: habla de dolor real, muestra un flujo simple y deja ver producto.
              Aquí estamos llevando Nexora en esa dirección, con una narrativa más directa y una capa visual mucho más sólida.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {painPoints.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
              >
                <p className="text-3xl font-semibold text-slate-950">{item.stat}</p>
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20">
          <div className="max-w-3xl">
            <span className="section-tag">La solución</span>
            <h3 className="mt-6 text-3xl font-semibold text-slate-950 md:text-4xl">
              Una homepage más completa, más eficiente y mejor conectada con el producto real.
            </h3>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Mantuvimos la esencia SaaS de alto valor, pero bajamos el discurso a cosas que este proyecto sí puede sostener hoy:
              autenticación, dashboard, campañas, analítica, administración y monetización.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;

              return (
                <article
                  key={pillar.title}
                  className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="mt-5 text-xl font-semibold text-slate-950">{pillar.title}</h4>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{pillar.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

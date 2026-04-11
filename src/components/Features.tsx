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
    title: 'Perdidas por operar en plataformas separadas',
    description:
      'Saltas entre Meta, Google, TikTok, hojas de cálculo y mensajes internos. Cada cambio operativo corta foco y retrasa decisiones.',
  },
  {
    stat: '0 visibilidad',
    title: 'Inviertes sin una lectura central del negocio',
    description:
      'Sin una consola unificada es difícil saber qué campaña empuja negocio y cuál solo consume presupuesto.',
  },
  {
    stat: '1 sola fuente',
    title: 'Tu operación necesita un sistema, no otro parche',
    description:
      'Cuando campañas, seguimiento y resultados viven en el mismo lugar, es más fácil vender con consistencia.',
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
    title: 'Gestión centralizada',
    description: 'Administra usuarios, planes y configuración desde una sola consola, sin depender de herramientas externas ni hojas separadas.',
  },
  {
    icon: CreditCard,
    title: 'Cobro online listo para activar',
    description: 'Nexora ya incluye flujo con Stripe para planes y pagos con tarjeta. Solo necesitas configurar tus claves y precios para comenzar a cobrar.',
  },
  {
    icon: Shield,
    title: 'Experiencia que genera confianza',
    description: 'Presentación clara, mensajes directos y flujo de acceso limpio para que cada usuario entienda el valor antes de registrarse.',
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
              Si operas en caos, el crecimiento se vuelve impredecible.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              La mayoría de equipos no falla por falta de esfuerzo, sino por falta de sistema. Nexora une campañas,
              analítica y seguimiento comercial para convertir datos en acciones claras.
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
              Una plataforma única para atraer, seguir y cerrar mejor.
            </h3>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Nexora está diseñada para dar claridad operativa: menos tiempo en tareas repetitivas y más tiempo en decisiones que impactan ventas.
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

'use client';

import RevealOnScroll from '@/components/ui/RevealOnScroll';
import {
  Activity,
  BarChart3,
  CreditCard,
  LayoutDashboard,
  MessageSquareText,
  Shield,
  Target,
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
    icon: Users,
    title: 'CRM y seguimiento',
    description: 'Organiza leads, etapas, próximas acciones y seguimiento comercial sin salir de Nexora.',
  },
  {
    icon: Target,
    title: 'Funnel y captación',
    description: 'Conecta campañas con formularios, embudos y oportunidades para ver mejor qué termina convirtiendo.',
  },
  {
    icon: MessageSquareText,
    title: 'Asistente IA en el panel',
    description: 'El usuario puede preguntar en lenguaje natural sobre campañas, rendimiento, conexiones y próximos pasos dentro del dashboard.',
  },
  {
    icon: CreditCard,
    title: 'Cobro y suscripciones',
    description: 'Nexora ya incluye flujo con Stripe para planes, suscripciones y facturación lista para operar.',
  },
  {
    icon: BarChart3,
    title: 'Analítica y control',
    description: 'Lee ROI, CTR, conversiones y desempeño general sin perseguir datos en varias herramientas.',
  },
  {
    icon: Shield,
    title: 'Gestión centralizada',
    description: 'Administra usuarios, planes y configuración desde una sola consola con una experiencia más seria y consistente.',
  },
];

export default function Features() {
  return (
    <section id="solution" className="bg-[#050816] px-4 py-24 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <span className="section-tag section-tag-dark">El problema</span>
            <h2 className="mt-6 max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">
              Si operas en caos, el crecimiento se vuelve impredecible.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              La mayoría de equipos no falla por falta de esfuerzo, sino por falta de sistema. Nexora une campañas,
              analítica y seguimiento comercial para convertir datos en acciones claras.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {painPoints.map((item, index) => (
              <RevealOnScroll key={item.title} delayMs={index * 90}>
                <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.45)]">
                  <p className="text-3xl font-semibold text-cyan-300">{item.stat}</p>
                  <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>

        <div className="mt-20">
          <div className="max-w-3xl">
            <span className="section-tag section-tag-dark">La solución</span>
            <h3 className="mt-6 text-3xl font-semibold text-white md:text-4xl">
              Una plataforma única para atraer, seguir y cerrar mejor.
            </h3>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Nexora está diseñada para dar claridad operativa: campañas, CRM, funnel, cobro y ayuda asistida por IA en una misma base de trabajo.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon;

              return (
                <RevealOnScroll key={pillar.title} delayMs={120 + index * 70}>
                  <article className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-7 shadow-[0_18px_50px_rgba(2,6,23,0.4)] transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_24px_70px_rgba(8,47,73,0.45)]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h4 className="mt-5 text-xl font-semibold text-white">{pillar.title}</h4>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{pillar.description}</p>
                  </article>
                </RevealOnScroll>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

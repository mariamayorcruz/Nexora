'use client';

import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';

const plans = [
  {
    name: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 24,
    description: 'Para negocios que quieren ordenar su operación publicitaria sin crecer costos fijos.',
    features: ['1 workspace', 'Dashboard principal', 'Centro de campañas', 'Auth y pagos base', 'Soporte por email'],
  },
  {
    name: 'Growth',
    monthlyPrice: 79,
    yearlyPrice: 64,
    description: 'La mejor relación entre control, administración y escalado para una operación activa.',
    features: [
      '3 workspaces',
      'Analítica avanzada',
      'Panel admin',
      'Gestión de usuarios y suscripciones',
      'Prioridad de soporte',
    ],
    featured: true,
  },
  {
    name: 'Scale',
    monthlyPrice: 149,
    yearlyPrice: 124,
    description: 'Para equipos que necesitan más control, más cuentas y una base lista para seguir construyendo.',
    features: [
      'Workspaces ampliados',
      'Configuración administrativa extendida',
      'Soporte prioritario',
      'Base para personalizaciones',
      'Acompañamiento de implementación',
    ],
  },
];

export default function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <section id="pricing" className="bg-[#fffdf7] px-4 py-24 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="section-tag">Precios</span>
            <h2 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
              Una estructura comercial mucho más clara y lista para convertir.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              También mejoré la forma en la que presentas el pricing: menos ruido, mejor jerarquía y una propuesta
              que se siente más premium sin perder claridad.
            </p>
          </div>

          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                billing === 'monthly' ? 'bg-slate-950 text-white' : 'text-slate-600'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBilling('yearly')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                billing === 'yearly' ? 'bg-slate-950 text-white' : 'text-slate-600'
              }`}
            >
              Anual
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const price = billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;

            return (
              <article
                key={plan.name}
                className={`relative flex h-full flex-col rounded-[2rem] border p-8 transition duration-300 ${
                  plan.featured
                    ? 'border-orange-300 bg-slate-950 text-white shadow-[0_30px_100px_rgba(249,115,22,0.18)]'
                    : 'border-slate-200 bg-white text-slate-900 shadow-[0_16px_50px_rgba(15,23,42,0.06)]'
                }`}
              >
                {plan.featured && (
                  <div className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-full bg-orange-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950">
                    <Sparkles className="h-3.5 w-3.5" />
                    Más recomendado
                  </div>
                )}

                <div className="pt-8">
                  <h3 className="text-2xl font-semibold">{plan.name}</h3>
                  <p className={`mt-4 text-sm leading-7 ${plan.featured ? 'text-slate-300' : 'text-slate-600'}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mt-8">
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-semibold">${price}</span>
                    <span className={`pb-2 text-sm ${plan.featured ? 'text-slate-300' : 'text-slate-500'}`}>
                      / mes
                    </span>
                  </div>
                  <p className={`mt-3 text-sm ${plan.featured ? 'text-orange-200' : 'text-slate-500'}`}>
                    {billing === 'yearly' ? 'Facturación anual con mejor margen' : 'Facturación mensual flexible'}
                  </p>
                </div>

                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${
                          plan.featured ? 'bg-white/10 text-orange-300' : 'bg-slate-100 text-orange-500'
                        }`}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                      <span className={plan.featured ? 'text-slate-100' : 'text-slate-700'}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-10">
                  <Link href="/auth/signup" className={plan.featured ? 'btn-primary w-full text-center' : 'btn-secondary w-full text-center'}>
                    Elegir {plan.name}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

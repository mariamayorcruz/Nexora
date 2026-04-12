'use client';

import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import RevealOnScroll from '@/components/ui/RevealOnScroll';
import { BILLING_PLANS, BillingCycle, BillingPlan } from '@/lib/billing';

const displayOrder: BillingPlan[] = ['starter', 'professional', 'enterprise'];

export default function Pricing() {
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  const persistSelectedPlan = (plan: BillingPlan) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      'nexoraSelectedPlan',
      JSON.stringify({
        plan,
        billing,
        savedAt: Date.now(),
      })
    );
  };

  return (
    <section id="pricing" className="bg-[#060a1a] px-4 py-24 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="section-tag section-tag-dark">Precios</span>
            <h2 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
              Planes claros, consistentes con Stripe y listos para convertir.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Alineamos lo que ve el cliente en la landing con lo que realmente compra y gestiona después dentro de Nexora.
            </p>
          </div>

          <div className="inline-flex self-start rounded-full border border-white/15 bg-slate-900/80 p-1 shadow-[0_8px_30px_rgba(2,6,23,0.45)] lg:self-auto">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                billing === 'monthly' ? 'bg-cyan-500/25 text-cyan-200' : 'text-slate-400'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBilling('yearly')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                billing === 'yearly' ? 'bg-cyan-500/25 text-cyan-200' : 'text-slate-400'
              }`}
            >
              Anual
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {displayOrder.map((planKey, index) => {
            const plan = BILLING_PLANS[planKey];
            const price = billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const featured = plan.key === 'professional';

            return (
              <RevealOnScroll key={plan.key} delayMs={index * 110}>
                <article
                  className={`relative flex h-full flex-col rounded-[2rem] border p-6 sm:p-8 transition duration-300 ${
                    featured
                      ? 'border-orange-300 bg-slate-950 text-white shadow-[0_30px_100px_rgba(249,115,22,0.18)]'
                      : 'border-white/10 bg-slate-900/75 text-slate-100 shadow-[0_16px_50px_rgba(2,6,23,0.45)]'
                  }`}
                >
                  {featured && (
                    <div className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-full bg-orange-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950">
                      <Sparkles className="h-3.5 w-3.5" />
                      Más recomendado
                    </div>
                  )}

                  <div className="pt-8">
                    <p className={`text-xs uppercase tracking-[0.24em] ${featured ? 'text-orange-200' : 'text-slate-400'}`}>
                      {plan.label}
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold">{plan.marketingLabel}</h3>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{plan.description}</p>
                  </div>

                  <div className="mt-8">
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-semibold">${price}</span>
                      <span className={`pb-2 text-sm ${featured ? 'text-slate-300' : 'text-slate-400'}`}>/ mes</span>
                    </div>
                    <p className={`mt-3 text-sm ${featured ? 'text-orange-200' : 'text-slate-400'}`}>
                      {billing === 'yearly' ? 'Facturación anual con mejor margen' : 'Facturación mensual flexible'}
                    </p>
                  </div>

                  <ul className="mt-8 space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${
                            featured ? 'bg-white/10 text-orange-300' : 'bg-slate-800 text-cyan-300'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </span>
                        <span className={featured ? 'text-slate-100' : 'text-slate-200'}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-10">
                    <Link
                      href={`/auth/signup?plan=${plan.key}&billing=${billing}`}
                      onClick={() => persistSelectedPlan(plan.key)}
                      className={featured ? 'btn-primary w-full text-center' : 'btn-secondary w-full text-center'}
                    >
                      Elegir {plan.marketingLabel}
                    </Link>
                  </div>
                </article>
              </RevealOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}

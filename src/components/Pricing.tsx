'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { BILLING_PLANS, BillingCycle, BillingPlan } from '@/lib/billing';
import { useLang } from '@/context/LanguageContext';

const displayOrder: BillingPlan[] = ['starter', 'professional', 'enterprise'];
const billing: BillingCycle = 'monthly';

const MONTHLY_DISPLAY_OVERRIDES: Partial<Record<BillingPlan, number>> = {
  starter: 30,
  enterprise: 199,
};

function monthlyDisplayPrice(planKey: BillingPlan): number {
  return MONTHLY_DISPLAY_OVERRIDES[planKey] ?? BILLING_PLANS[planKey].monthlyPrice;
}

const planContent: Record<BillingPlan, {
  en: { description: string; features: string[] };
  es: { description: string; features: string[] };
}> = {
  starter: {
    en: {
      description: 'For businesses ready to get organized and start closing more customers.',
      features: ['1 workspace', 'Main dashboard', 'Campaign center', 'Base CRM', '250 AI credits / month'],
    },
    es: {
      description: 'Para negocios listos para organizarse y cerrar más clientes.',
      features: ['1 workspace', 'Dashboard principal', 'Centro de campañas', 'CRM base', '250 créditos IA / mes'],
    },
  },
  professional: {
    en: {
      description: 'The right balance of AI, automation and analytics for businesses that are growing.',
      features: ['3 workspaces', 'Advanced analytics', 'Creative radar', 'Suggested automations', '1,800 AI credits / month'],
    },
    es: {
      description: 'El balance correcto de IA, automatización y analítica para negocios en crecimiento.',
      features: ['3 workspaces', 'Analítica avanzada', 'Radar creativo', 'Automatizaciones sugeridas', '1,800 créditos IA / mes'],
    },
  },
  enterprise: {
    en: {
      description: 'For teams running marketing, content and follow-up at full capacity.',
      features: ['Expanded capacity', 'Priority support', 'Advanced video & repurpose', 'Customization base', '6,500 AI credits / month'],
    },
    es: {
      description: 'Para equipos que operan marketing, contenido y seguimiento a plena capacidad.',
      features: ['Capacidad ampliada', 'Soporte prioritario', 'Video y repurpose avanzado', 'Base para personalizaciones', '6,500 créditos IA / mes'],
    },
  },
};

const content = {
  en: {
    tag: 'Pricing',
    h2: 'Simple, transparent pricing.',
    sub: 'No hidden fees. No agency contracts. Start with a 7-day trial for just $1.',
    billing: 'Billed monthly',
    featured: 'Most popular',
    cta: (featured: boolean, price: number) => featured ? `Get started for $${price}/mo` : `Start for $${price}/mo`,
    trial: '7-day trial. $1 today.',
    guarantee: 'No commitment. Cancel anytime. Instant access.',
  },
  es: {
    tag: 'Precios',
    h2: 'Precios simples y transparentes.',
    sub: 'Sin tarifas ocultas. Sin contratos. Empieza con 7 días de prueba por solo $1.',
    billing: 'Facturación mensual',
    featured: 'Más popular',
    cta: (_featured: boolean, price: number) => `Empezar por $${price}/mes`,
    trial: 'Prueba 7 días. $1 hoy.',
    guarantee: 'Sin compromiso. Cancela cuando quieras. Acceso inmediato.',
  },
};

export default function Pricing() {
  const { lang } = useLang();
  const t = content[lang];

  const persistSelectedPlan = (plan: BillingPlan) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('nexoraSelectedPlan', JSON.stringify({ plan, billing, savedAt: Date.now() }));
  };

  return (
    <section id="pricing" className="bg-slate-50 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">
            {t.tag}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold text-slate-900 md:text-5xl">{t.h2}</h2>
          <p className="mt-4 text-lg text-slate-500">{t.sub}</p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {displayOrder.map((planKey) => {
            const plan = BILLING_PLANS[planKey];
            const price = monthlyDisplayPrice(planKey);
            const featured = plan.key === 'professional';
            const pc = planContent[planKey][lang];

            return (
              <article
                key={plan.key}
                className={`relative flex flex-col rounded-2xl border p-8 transition ${
                  featured
                    ? 'border-slate-900 bg-slate-900 text-white shadow-2xl'
                    : 'border-slate-200 bg-white shadow-sm hover:shadow-md'
                }`}
              >
                {featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-[#0ea5e9] px-4 py-1 text-xs font-bold text-white shadow">
                      {t.featured}
                    </span>
                  </div>
                )}

                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${featured ? 'text-slate-400' : 'text-slate-400'}`}>
                    {plan.label}
                  </p>
                  <h3 className={`mt-2 text-2xl font-extrabold ${featured ? 'text-white' : 'text-slate-900'}`}>
                    {plan.marketingLabel}
                  </h3>
                  <p className={`mt-2 text-sm leading-6 ${featured ? 'text-slate-400' : 'text-slate-500'}`}>
                    {pc.description}
                  </p>
                </div>

                <div className="mt-6">
                  <div className="flex items-end gap-1">
                    <span className={`text-5xl font-extrabold ${featured ? 'text-white' : 'text-slate-900'}`}>
                      ${price}
                    </span>
                    <span className={`pb-1 text-sm ${featured ? 'text-slate-400' : 'text-slate-400'}`}>/ mo</span>
                  </div>
                  <p className={`mt-1 text-xs ${featured ? 'text-slate-400' : 'text-slate-400'}`}>{t.billing}</p>
                  <p className={`mt-1 text-xs font-medium ${featured ? 'text-sky-400' : 'text-sky-600'}`}>{t.trial}</p>
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  {pc.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        featured ? 'bg-[#0ea5e9]' : 'bg-sky-100'
                      }`}>
                        <Check className={`h-3 w-3 ${featured ? 'text-white' : 'text-[#0ea5e9]'}`} />
                      </span>
                      <span className={`text-sm ${featured ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <Link
                    href={`/auth/signup?plan=${plan.key}&billing=${billing}`}
                    onClick={() => persistSelectedPlan(plan.key)}
                    className="block w-full rounded-xl bg-[#0ea5e9] py-3 text-center text-sm font-bold text-white transition hover:bg-[#0284c7]"
                  >
                    {t.cta(featured, price)}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">{t.guarantee}</p>
      </div>
    </section>
  );
}

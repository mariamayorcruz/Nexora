'use client';

import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import DashboardMockupHero from '@/components/DashboardMockupHero';

const stats = [
  { value: 'More', label: 'Revenue potential', labelEs: 'Potencial de ingresos' },
  { value: 'Hours', label: 'Saved on manual work', labelEs: 'menos trabajo manual' },
  { value: '<10min', label: 'To get started', labelEs: 'para comenzar' },
];

const copy = {
  en: {
    badge: 'CRM + AI + Automation. One platform.',
    pain: 'Your competitor replied in 2 minutes. You replied in 3 hours. That\'s where you lost the customer.',
    h1a: 'Stop losing customers.',
    h1b: 'Start closing them.',
    sub: 'Nexora gives your business the AI system to attract, follow up and close more customers. No agencies. No chaos.',
    cta1: 'Start free trial',
    cta2: 'See how it works',
    trial: '7-day trial. $1 today. Cancel anytime.',
  },
  es: {
    pain: 'Tu competencia respondió en 2 minutos. Tú en 3 horas. Ahí perdiste al cliente.',
    badge: 'CRM + IA + Automatización. Una sola plataforma.',
    h1a: 'Deja de perder clientes.',
    h1b: 'Empieza a cerrarlos.',
    sub: 'Nexora le da a tu negocio el sistema con IA para atraer, dar seguimiento y cerrar más clientes. Sin agencias. Sin caos.',
    cta1: 'Prueba gratis 7 días',
    cta2: 'Cómo funciona',
    trial: 'Prueba 7 días. Solo $1 hoy. Cancela cuando quieras.',
  },
};

export default function Hero() {
  const { lang } = useLang();
  const t = copy[lang];

  return (
    <section className="relative overflow-hidden bg-white pt-24 pb-16">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.06),transparent_50%),radial-gradient(circle_at_20%_80%,rgba(14,165,233,0.04),transparent_40%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700">
              ✦ {t.badge}
            </div>

            <p className="mb-4 text-sm font-medium text-red-500">{t.pain}</p>
            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
              {t.h1a}<br />
              <span className="text-sky-500">{t.h1b}</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-500">
              {t.sub}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/signup"
                className="rounded-xl bg-[#0ea5e9] px-8 py-4 text-base font-semibold text-white transition hover:bg-[#0284c7]"
              >
                {t.cta1}
              </Link>
              <Link
                href="#demo"
                className="rounded-xl border border-slate-300 bg-transparent px-8 py-4 text-base font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                {t.cta2} →
              </Link>
            </div>

            <p className="mt-4 text-sm text-slate-400">{t.trial}</p>

            <div className="mt-12 grid grid-cols-3 gap-6">
              {stats.map((s) => (
                <div key={s.value} className="border-l-2 border-sky-200 pl-4">
                  <p className="text-3xl font-extrabold text-slate-900">{s.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{lang === 'en' ? s.label : s.labelEs}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — mockup */}
          <div className="relative">
            <div className="rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
              <DashboardMockupHero />
            </div>
            <div className="absolute -bottom-4 -left-4 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-lg">
              <p className="text-xs text-slate-400">Trusted by</p>
              <p className="text-sm font-semibold text-slate-900">Businesses growing with Nexora</p>
            </div>
            <div className="absolute -right-4 -top-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 shadow-lg">
              <p className="text-xs font-semibold text-sky-600">● AI active</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


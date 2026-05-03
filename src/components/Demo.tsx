'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLang } from '@/context/LanguageContext';
import DashboardMockupDemo from '@/components/DashboardMockupDemo';

const content = {
  en: {
    tag: 'See it in action',
    h2: 'Your entire business. One screen.',
    sub: 'Watch how Nexora replaces your CRM, ad tools, follow-up sequences and reporting — in under 10 minutes.',
    calcTag: 'ROI Calculator',
    calcH2: 'See how much you save.',
    calcSub: 'Select what you currently use and see your monthly savings vs Nexora.',
    categories: [
      { key: 'crm', label: 'CRM', tools: 'HubSpot / Salesforce', cost: 500 },
      { key: 'ads', label: 'Ad management', tools: 'Agency / Motion / Madgicx', cost: 800 },
      { key: 'content', label: 'Content & copy', tools: 'Jasper / ChatGPT / Canva', cost: 120 },
      { key: 'automation', label: 'Automation', tools: 'Zapier / ActiveCampaign', cost: 200 },
      { key: 'analytics', label: 'Analytics', tools: 'Databox / Supermetrics', cost: 150 },
    ],
    teamLabel: 'Team size',
    savingsLabel: 'Monthly savings',
    annualLabel: 'Annual savings',
    cta: 'Start saving today →',
    nexoraPrice: 79,
  },
  es: {
    tag: 'Vélo en acción',
    h2: 'Todo tu negocio. Una sola pantalla.',
    sub: 'Ve cómo Nexora reemplaza tu CRM, herramientas de anuncios, secuencias de seguimiento y reportes — en menos de 10 minutos.',
    calcTag: 'Calculadora de ahorro',
    calcH2: 'Ve cuánto ahorras.',
    calcSub: 'Selecciona lo que usas actualmente y ve tu ahorro mensual vs Nexora.',
    categories: [
      { key: 'crm', label: 'CRM', tools: 'HubSpot / Salesforce', cost: 500 },
      { key: 'ads', label: 'Gestión de anuncios', tools: 'Agencia / Motion / Madgicx', cost: 800 },
      { key: 'content', label: 'Contenido y copy', tools: 'Jasper / ChatGPT / Canva', cost: 120 },
      { key: 'automation', label: 'Automatización', tools: 'Zapier / ActiveCampaign', cost: 200 },
      { key: 'analytics', label: 'Analítica', tools: 'Databox / Supermetrics', cost: 150 },
    ],
    teamLabel: 'Tamaño del equipo',
    savingsLabel: 'Ahorro mensual',
    annualLabel: 'Ahorro anual',
    cta: 'Empieza a ahorrar hoy →',
    nexoraPrice: 79,
  },
};

export default function Demo() {
  const { lang } = useLang();
  const t = content[lang];
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [teamSize, setTeamSize] = useState(1);

  const totalToolCost = t.categories
    .filter((c) => selected[c.key])
    .reduce((sum, c) => sum + c.cost, 0) * teamSize;

  const monthlySavings = Math.max(0, totalToolCost - t.nexoraPrice);
  const annualSavings = monthlySavings * 12;

  const toggle = (key: string) =>
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <section id="demo" className="bg-white px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-24">

        {/* Demo mockup */}
        <div>
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">
              {t.tag}
            </span>
            <h2 className="mt-4 text-4xl font-extrabold text-slate-900 md:text-5xl">{t.h2}</h2>
            <p className="mt-4 text-lg text-slate-500">{t.sub}</p>
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl">
            <DashboardMockupDemo />
          </div>
        </div>

        {/* ROI Calculator */}
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">
              {t.calcTag}
            </span>
            <h2 className="mt-4 text-4xl font-extrabold text-slate-900 md:text-5xl">{t.calcH2}</h2>
            <p className="mt-4 text-lg text-slate-500">{t.calcSub}</p>

            <div className="mt-8 space-y-3">
              {t.categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => toggle(cat.key)}
                  className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
                    selected[cat.key]
                      ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-200'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{cat.label}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{cat.tools}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-600">${cat.cost}/mo</span>
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                        selected[cat.key]
                          ? 'border-sky-500 bg-sky-500'
                          : 'border-slate-300'
                      }`}>
                        {selected[cat.key] && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <span className="text-sm text-slate-500">{t.teamLabel}</span>
              <input
                type="range"
                min={1}
                max={20}
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="flex-1 min-w-0 h-2 cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#0ea5e9] [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-slate-200 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-[#0ea5e9] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-slate-200 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#0ea5e9]"
              />
              <span className="w-6 text-center text-sm font-bold text-slate-900">{teamSize}</span>
            </div>
          </div>

          {/* Results */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{t.savingsLabel}</p>
              <p className="mt-2 text-6xl font-extrabold text-slate-900">
                ${monthlySavings.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-8">
              <p className="text-sm font-medium text-sky-600">{t.annualLabel}</p>
              <p className="mt-2 text-6xl font-extrabold text-sky-600">
                ${annualSavings.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              {lang === 'en'
                ? `Based on replacing selected tools with Nexora at $${t.nexoraPrice}/mo for ${teamSize} user${teamSize > 1 ? 's' : ''}.`
                : `Basado en reemplazar las herramientas seleccionadas con Nexora a $${t.nexoraPrice}/mes para ${teamSize} usuario${teamSize > 1 ? 's' : ''}.`}
            </div>
            <Link
              href="/auth/signup"
              className="rounded-xl bg-[#0ea5e9] px-6 py-4 text-center text-base font-semibold text-white transition hover:bg-[#0284c7]"
            >
              {t.cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

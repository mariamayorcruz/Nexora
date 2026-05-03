'use client';

import Link from 'next/link';
import { BarChart2, Bot, Users, Zap } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';

const content = {
  en: {
    tag: 'Why Nexora',
    h2: 'Everything your business needs to grow.',
    sub: 'CRM, AI, campaigns and automation — unified in one clean workspace.',
    metrics: [
      { value: '2.8x', label: 'More leads closed', detail: 'Teams using Nexora close nearly 3x more leads in their first 60 days.' },
      { value: '91%', label: 'Less manual follow-up', detail: '91% of follow-ups are automated — your team focuses on closing.' },
      { value: '99%', label: 'Lower cost vs agencies', detail: 'Agency-level results at a fraction of the price.' },
    ],
    features: [
      { icon: Users, title: 'Smart CRM', desc: 'Track every lead, deal, and client in one place. AI suggests next actions so nothing falls through the cracks.' },
      { icon: Bot, title: 'AI Content Studio', desc: 'Generate ads, UGC scripts, email sequences and pitch decks in seconds — trained on what actually converts.' },
      { icon: Zap, title: 'Automation Engine', desc: 'Set up follow-up sequences, campaign triggers and reminders once. Nexora runs them for you, 24/7.' },
      { icon: BarChart2, title: 'Campaign Analytics', desc: 'Connect Meta, Google and TikTok. See what\'s working and where to move your budget — in real time.' },
    ],
    cta: 'Start free trial →',
  },
  es: {
    tag: 'Por qué Nexora',
    h2: 'Todo lo que tu negocio necesita para crecer.',
    sub: 'CRM, IA, campañas y automatización — unificados en un solo workspace.',
    metrics: [
      { value: '2.8x', label: 'Más leads cerrados', detail: 'Los equipos que usan Nexora cierran casi 3 veces más leads en sus primeros 60 días.' },
      { value: '91%', label: 'Menos seguimiento manual', detail: 'El 91% de los seguimientos se automatizan — tu equipo se enfoca en cerrar.' },
      { value: '99%', label: 'Menor costo vs agencias', detail: 'Resultados de agencia a una fracción del precio.' },
    ],
    features: [
      { icon: Users, title: 'CRM Inteligente', desc: 'Gestiona cada lead, negocio y cliente en un solo lugar. La IA sugiere próximas acciones para que nada se pierda.' },
      { icon: Bot, title: 'Studio IA de Contenido', desc: 'Genera anuncios, guiones UGC, secuencias de email y pitch decks en segundos — entrenado en lo que realmente convierte.' },
      { icon: Zap, title: 'Motor de Automatización', desc: 'Configura secuencias de seguimiento, disparadores de campaña y recordatorios una vez. Nexora los ejecuta por ti, 24/7.' },
      { icon: BarChart2, title: 'Analítica de Campañas', desc: 'Conecta Meta, Google y TikTok. Ve qué funciona y dónde mover tu presupuesto — en tiempo real.' },
    ],
    cta: 'Empezar prueba gratis →',
  },
};

export default function Features() {
  const { lang } = useLang();
  const t = content[lang];

  return (
    <section id="solution" className="bg-slate-50 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">
            {t.tag}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">{t.h2}</h2>
          <p className="mt-4 text-lg text-slate-500">{t.sub}</p>
        </div>

        {/* Metrics */}
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-slate-200 shadow-sm md:grid-cols-3">
          {t.metrics.map((m) => (
            <div key={m.value} className="bg-white px-8 py-10">
              <p className="text-5xl font-extrabold text-slate-900">{m.value}</p>
              <p className="mt-2 text-base font-semibold text-slate-800">{m.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{m.detail}</p>
            </div>
          ))}
        </div>

        {/* Feature grid */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                  <Icon className="h-5 w-5 text-sky-600" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-14 text-center">
          <Link
            href="/auth/signup"
            className="inline-block rounded-xl bg-[#0ea5e9] px-8 py-4 text-base font-semibold text-white transition hover:bg-[#0284c7]"
          >
            {t.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}

'use client';

import { Check, Minus } from 'lucide-react';
import { useLang } from '@/context/LanguageContext';

type CellValue = boolean | 'partial';

type CmpRow = {
  label: string;
  nexora: CellValue;
  typical: CellValue;
  agency: CellValue;
};

const content: Record<
  'en' | 'es',
  {
    tag: string;
    h2: string;
    sub: string;
    colNexora: string;
    colTypical: string;
    colAgency: string;
    rows: CmpRow[];
    footnote: string;
  }
> = {
  en: {
    tag: 'Compare',
    h2: 'Nexora vs. piecing tools together.',
    sub: 'See why teams consolidate CRM, ads, content and automation into one workspace.',
    colNexora: 'Nexora',
    colTypical: 'Typical stack',
    colAgency: 'Agency retainers',
    rows: [
      { label: 'Single subscription / predictable cost', nexora: true, typical: false, agency: false },
      { label: 'CRM + pipeline in one place', nexora: true, typical: 'partial', agency: true },
      { label: 'AI content & campaigns (Studio)', nexora: true, typical: 'partial', agency: true },
      { label: 'Cross-channel analytics (Meta, Google, TikTok)', nexora: true, typical: 'partial', agency: true },
      { label: 'Automation & sequences without Zapier sprawl', nexora: true, typical: false, agency: 'partial' },
      { label: 'Self-serve setup (<10 min)', nexora: true, typical: 'partial', agency: false },
    ],
    footnote: 'Typical stack = separate CRM, AI tools, automation and reporting billed separately.',
  },
  es: {
    tag: 'Comparar',
    h2: 'Nexora frente a unir herramientas sueltas.',
    sub: 'Por qué equipos unifican CRM, anuncios, contenido y automatización en un solo lugar.',
    colNexora: 'Nexora',
    colTypical: 'Stack típico',
    colAgency: 'Retainers de agencia',
    rows: [
      { label: 'Suscripción única / costo predecible', nexora: true, typical: false, agency: false },
      { label: 'CRM + pipeline en un solo lugar', nexora: true, typical: 'partial', agency: true },
      { label: 'IA para contenido y campañas (Studio)', nexora: true, typical: 'partial', agency: true },
      { label: 'Analítica multicanal (Meta, Google, TikTok)', nexora: true, typical: 'partial', agency: true },
      { label: 'Automatización sin multiplicar Zapier', nexora: true, typical: false, agency: 'partial' },
      { label: 'Configuración autónoma (<10 min)', nexora: true, typical: 'partial', agency: false },
    ],
    footnote: 'Stack típico = CRM, herramientas de IA, automatización y reporting por separado.',
  },
};

function Cell({ value }: { value: boolean | 'partial' }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center">
        <Check className="h-5 w-5 text-sky-600" aria-hidden />
        <span className="sr-only">Yes</span>
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex items-center justify-center text-slate-400" title="Partial">
        <Minus className="h-5 w-5" aria-hidden />
        <span className="sr-only">Partial</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center text-slate-300" aria-hidden>
      —
    </span>
  );
}

export default function ComparisonTable() {
  const { lang } = useLang();
  const t = content[lang];

  return (
    <section className="border-y border-slate-200 bg-white px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">
            {t.tag}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold text-slate-900 md:text-5xl">{t.h2}</h2>
          <p className="mt-4 text-lg text-slate-500">{t.sub}</p>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th scope="col" className="px-5 py-4 font-semibold text-slate-900 md:px-6">
                  {' '}
                </th>
                <th scope="col" className="px-5 py-4 text-center font-semibold text-slate-900 md:px-6">
                  {t.colNexora}
                </th>
                <th scope="col" className="px-5 py-4 text-center font-semibold text-slate-700 md:px-6">
                  {t.colTypical}
                </th>
                <th scope="col" className="px-5 py-4 text-center font-semibold text-slate-700 md:px-6">
                  {t.colAgency}
                </th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row) => (
                <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                  <th scope="row" className="max-w-[280px] px-5 py-4 font-medium text-slate-700 md:px-6">
                    {row.label}
                  </th>
                  <td className="bg-sky-50/50 px-5 py-4 text-center md:px-6">
                    <Cell value={row.nexora} />
                  </td>
                  <td className="px-5 py-4 text-center md:px-6">
                    <Cell value={row.typical} />
                  </td>
                  <td className="px-5 py-4 text-center md:px-6">
                    <Cell value={row.agency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">{t.footnote}</p>
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { AdPreviewCard } from '@/components/AdPreviewCard';
import type { AdPreviewVariant } from '@/components/AdPreviewCard';

const SAMPLE_IMAGE =
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80&auto=format&fit=crop';

export default function AdPreviewDemoPage() {
  const [imageUrl, setImageUrl] = useState(SAMPLE_IMAGE);
  const [primaryText, setPrimaryText] = useState(
    'Impulsa tus ventas esta temporada con envío gratis en pedidos superiores a $50.'
  );
  const [headline, setHeadline] = useState('Hasta 40% de descuento en colección seleccionada');
  const [description, setDescription] = useState(
    'Oferta por tiempo limitado. Combina con otros beneficios exclusivos para miembros. No dejes pasar esta oportunidad de renovar tu inventario con los mejores precios del mercado y soporte dedicado.'
  );
  const [cta, setCta] = useState('Comprar ahora');
  const [platform, setPlatform] = useState<'facebook' | 'instagram'>('instagram');
  const [variant, setVariant] = useState<AdPreviewVariant>('feed');

  const cardProps = useMemo(
    () => ({
      imageUrl,
      primaryText,
      headline,
      description,
      cta,
      platform,
      variant,
    }),
    [imageUrl, primaryText, headline, description, cta, platform, variant]
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-[#060816] dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Demo
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Ad preview · live editor</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              Edit fields below; the card updates immediately. Try an empty or broken image URL to see the
              fallback.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-[#1877F2] hover:underline dark:text-sky-400"
          >
            ← Volver al dashboard
          </Link>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1e293b]">
            <Field label="imageUrl">
              <textarea
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
                spellCheck={false}
              />
            </Field>
            <Field label="primaryText">
              <textarea
                value={primaryText}
                onChange={(e) => setPrimaryText(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
              />
            </Field>
            <Field label="headline">
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
              />
            </Field>
            <Field label="description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
              />
            </Field>
            <Field label="cta">
              <input
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="platform">
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as 'facebook' | 'instagram')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
                >
                  <option value="instagram">instagram</option>
                  <option value="facebook">facebook</option>
                </select>
              </Field>
              <Field label="variant">
                <select
                  value={variant}
                  onChange={(e) => setVariant(e.target.value as AdPreviewVariant)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
                >
                  <option value="feed">feed</option>
                  <option value="story">story</option>
                </select>
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Live preview
            </p>
            <AdPreviewCard {...cardProps} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Edit3, Globe2, Pause, Play, Search } from 'lucide-react';
import type { UnifiedCampaign } from '@/types/command-center';

const STATUS_CLASS: Record<UnifiedCampaign['status'], string> = {
  active: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300',
  paused: 'border-amber-500/30 bg-amber-500/20 text-amber-300',
  review: 'border-blue-500/30 bg-blue-500/20 text-blue-300',
  ended: 'border-slate-600 bg-slate-700/40 text-slate-300',
  draft: 'border-violet-500/35 bg-violet-500/15 text-violet-200',
};

function platformIcon(platform: UnifiedCampaign['channel']['platform']) {
  if (platform === 'meta') {
    return <Globe2 size={15} className="shrink-0 text-blue-400" />;
  }

  if (platform === 'google') {
    return <Search size={15} className="shrink-0 text-red-400" />;
  }

  return <span className="text-xs text-slate-300">TT</span>;
}

function labelForStatus(status: UnifiedCampaign['status']) {
  if (status === 'active') {
    return '\u2022 Activa';
  }
  if (status === 'paused') {
    return '\u23F8 Pausada';
  }
  if (status === 'ended') {
    return 'Finalizada';
  }
  if (status === 'draft') {
    return 'Borrador';
  }
  return 'En revisi\u00F3n';
}

export function CampaignCard({
  campaign,
  selected,
  onSelect,
  onToggleStatus,
  onOpenStudio,
  onActivate,
  activating = false,
}: {
  campaign: UnifiedCampaign;
  selected: boolean;
  onSelect: (campaign: UnifiedCampaign) => void;
  onToggleStatus: (campaign: UnifiedCampaign) => void;
  onOpenStudio: (campaign: UnifiedCampaign) => void;
  onActivate?: (campaign: UnifiedCampaign) => void | Promise<void>;
  activating?: boolean;
}) {
  const budgetPct = Math.max(0, Math.min(100, (campaign.budget.spent / Math.max(1, campaign.budget.daily)) * 100));

  const imageSrc = (campaign.creative.imageUrl || campaign.creative.thumbnail || '').trim();
  const headline = (campaign.creative.headline || '').trim();
  const primaryText = (campaign.creative.primaryText || '').trim();
  const ctaLabel = (campaign.creative.cta || '').trim();
  const hasOverlayCopy = Boolean(headline || primaryText || ctaLabel);

  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  const showImage = Boolean(imageSrc) && !imageFailed;

  return (
    <article
      onClick={() => onSelect(campaign)}
      className={`group cursor-pointer overflow-hidden rounded-xl border bg-slate-900 transition-all duration-200 ease-out ${
        selected
          ? 'border-cyan-400/80 shadow-[0_0_0_1px_rgba(34,211,238,0.35)] ring-1 ring-cyan-400/25'
          : campaign.status === 'draft'
            ? 'border-violet-500/30 ring-1 ring-violet-500/15 hover:-translate-y-0.5 hover:border-violet-400/40 hover:shadow-xl hover:shadow-black/35 active:translate-y-0 active:shadow-lg active:shadow-black/25'
            : 'border-slate-800 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-900 hover:shadow-xl hover:shadow-black/35 hover:ring-1 hover:ring-white/10 active:translate-y-0 active:shadow-lg active:shadow-black/25'
      }`}
    >
      <div
        className={`relative w-full overflow-hidden bg-slate-950 ${
          campaign.creative.variant === 'story' ? 'aspect-[9/16] max-h-[220px]' : 'aspect-video max-h-[200px]'
        }`}
      >
        {showImage ? (
          /* eslint-disable-next-line @next/next/no-img-element -- remote creative URLs not in next/image config */
          <img
            src={imageSrc}
            alt={headline || campaign.name}
            className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full min-h-[120px] w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">{campaign.channel.platform}</span>
          </div>
        )}

        {hasOverlayCopy ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/50 to-transparent px-3 pb-3.5 pt-12 text-left">
            {headline ? (
              <p
                lang="es"
                className="line-clamp-2 text-[13px] font-semibold leading-snug text-white [text-wrap:pretty] [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_20px_rgba(0,0,0,0.45)]"
              >
                {headline}
              </p>
            ) : null}
            {primaryText ? (
              <p
                lang="es"
                className="mt-1 line-clamp-3 break-words text-[12px] font-normal leading-relaxed text-white/95 hyphens-auto [text-wrap:pretty] [text-shadow:0_1px_2px_rgba(0,0,0,0.88),0_0_18px_rgba(0,0,0,0.5)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_calc(100%-1.35em),transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,#000_0%,#000_calc(100%-1.35em),transparent_100%)]"
              >
                {primaryText}
              </p>
            ) : null}
            {ctaLabel ? (
              <span
                className="mt-2 inline-flex max-w-full items-center rounded-md bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-900 shadow-md [text-shadow:none] ring-1 ring-black/5"
                title={ctaLabel}
              >
                <span className="truncate">{ctaLabel}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="absolute left-3 top-3">
          <span className={`rounded border px-2 py-1 text-xs font-medium ${STATUS_CLASS[campaign.status]}`}>
            {labelForStatus(campaign.status)}
          </span>
        </div>

        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onOpenStudio(campaign);
            }}
            className="rounded-lg bg-black/70 p-2 text-white backdrop-blur hover:bg-cyan-500"
          >
            <Edit3 size={15} />
          </button>
          {campaign.status !== 'draft' ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggleStatus(campaign);
              }}
              className="rounded-lg bg-black/70 p-2 text-white backdrop-blur hover:bg-emerald-500"
            >
              {campaign.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
            </button>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 pr-1">
            {headline ? (
              <p
                lang="es"
                className="mb-2 line-clamp-2 text-[15px] font-semibold leading-tight text-white [text-wrap:pretty]"
              >
                {headline}
              </p>
            ) : null}
            <div
              className={
                headline
                  ? 'rounded-lg border border-slate-700/70 bg-slate-800/40 px-2.5 py-2'
                  : ''
              }
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Campaña (Nexora)</p>
              <h3 className={`truncate text-sm ${headline ? 'mt-0.5 font-medium text-slate-300' : 'font-semibold text-white'}`}>
                {campaign.name}
              </h3>
            </div>
          </div>
          {platformIcon(campaign.channel.platform)}
        </div>
        <p className="mb-3 text-xs text-slate-400">{campaign.channel.accountName}</p>

        <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-800/50 p-2">
            <p className="uppercase text-slate-400">ROAS</p>
            <p className={`font-mono font-bold ${campaign.metrics.roas >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {campaign.metrics.roas.toFixed(2)}x
            </p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-2">
            <p className="uppercase text-slate-400">CPA</p>
            <p className="font-mono font-bold text-white">${campaign.metrics.cpa.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-2">
            <p className="uppercase text-slate-400">Gasto</p>
            <p className="font-mono text-white">${campaign.metrics.spend.toFixed(0)}</p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-2">
            <p className="uppercase text-slate-400">Conv.</p>
            <p className="font-mono text-white">{campaign.metrics.conversions}</p>
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-400">Presupuesto diario</span>
            <span className="text-white">
              ${campaign.budget.spent.toFixed(0)} / ${campaign.budget.daily.toFixed(0)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${budgetPct}%` }} />
          </div>
        </div>

        {campaign.status === 'draft' && onActivate ? (
          <button
            type="button"
            disabled={activating}
            onClick={(event) => {
              event.stopPropagation();
              void onActivate(campaign);
            }}
            className="mt-3 w-full rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-center text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {activating ? 'Activando…' : 'Activar campaña'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

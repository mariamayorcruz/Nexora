import { Edit3, Globe2, Pause, Play, Search } from 'lucide-react';
import type { UnifiedCampaign } from '@/types/command-center';

const STATUS_CLASS: Record<UnifiedCampaign['status'], string> = {
  active: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300',
  paused: 'border-amber-500/30 bg-amber-500/20 text-amber-300',
  review: 'border-blue-500/30 bg-blue-500/20 text-blue-300',
  ended: 'border-slate-600 bg-slate-700/40 text-slate-300',
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
  if (status === 'active') return '● Activa';
  if (status === 'paused') return '⏸ Pausada';
  if (status === 'ended') return 'Finalizada';
  return 'En revisión';
}

export function CampaignCard({
  campaign,
  selected,
  onSelect,
  onToggleStatus,
  onOpenStudio,
}: {
  campaign: UnifiedCampaign;
  selected: boolean;
  onSelect: (campaign: UnifiedCampaign) => void;
  onToggleStatus: (campaign: UnifiedCampaign) => void;
  onOpenStudio: (campaign: UnifiedCampaign) => void;
}) {
  const budgetPct = Math.max(0, Math.min(100, (campaign.budget.spent / Math.max(1, campaign.budget.daily)) * 100));

  return (
    <article
      onClick={() => onSelect(campaign)}
      className={`group cursor-pointer overflow-hidden rounded-xl border bg-slate-900 transition ${
        selected ? 'border-cyan-400/80 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]' : 'border-slate-800 hover:border-slate-600'
      }`}
    >
      <div className="relative h-40 overflow-hidden bg-slate-950">
        {campaign.creative.thumbnail ? (
          <img src={campaign.creative.thumbnail} alt={campaign.name} className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">{campaign.channel.platform}</span>
          </div>
        )}
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
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleStatus(campaign);
            }}
            className="rounded-lg bg-black/70 p-2 text-white backdrop-blur hover:bg-emerald-500"
          >
            {campaign.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="truncate pr-2 text-sm font-semibold text-white">{campaign.name}</h3>
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
      </div>
    </article>
  );
}

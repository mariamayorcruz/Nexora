import { Globe2, Music2, Plug, Search, TrendingUp } from 'lucide-react';
import type { ConnectedChannel } from '@/types/command-center';

function getPlatformStyle(platform: ConnectedChannel['platform']) {
  if (platform === 'meta') {
    return {
      icon: Globe2,
      chip: 'Meta Ads',
      iconClass: 'bg-blue-600',
      cardClass: 'border-blue-500/30 bg-blue-500/10',
    };
  }

  if (platform === 'google') {
    return {
      icon: Search,
      chip: 'Google Ads',
      iconClass: 'bg-red-500',
      cardClass: 'border-red-500/30 bg-red-500/10',
    };
  }

  return {
    icon: Music2,
    chip: 'TikTok Ads',
    iconClass: 'bg-black',
    cardClass: 'border-slate-600 bg-slate-900',
  };
}

export function ChannelCard({
  channel,
  limitedConnection = false,
  onConnect,
}: {
  channel: ConnectedChannel;
  /** Google/TikTok without full Ads API token (placeholder accountId). */
  limitedConnection?: boolean;
  onConnect: (platform: ConnectedChannel['platform']) => void;
}) {
  const style = getPlatformStyle(channel.platform);
  const Icon = style.icon;

  return (
    <article
      className={`rounded-xl border p-4 transition ${channel.connected ? style.cardClass : 'border-slate-700 bg-slate-900'}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${style.iconClass}`}>
          <Icon size={18} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{channel.accountName}</p>
          <span
            className={`text-xs ${
              channel.connected
                ? limitedConnection
                  ? 'text-amber-400'
                  : 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {channel.connected
              ? limitedConnection
                ? '● Conexión limitada'
                : '● Conectado'
              : '● Desconectado'}
          </span>
        </div>
      </div>

      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">
        {style.chip}
      </span>

      {channel.connected ? (
        <div className="mt-3 flex items-end justify-between text-sm">
          <div>
            <p className="text-xs text-slate-400">Gasto hoy</p>
            <p className="font-mono font-semibold text-white">${channel.spendToday.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Campañas</p>
            <p className="font-semibold text-white">{channel.activeCampaigns}</p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onConnect(channel.platform)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          <Plug size={15} />
          Conectar ahora
        </button>
      )}

      {channel.connected && !limitedConnection ? (
        <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-400">
          <TrendingUp size={12} />
          Datos sincronizados
        </div>
      ) : null}
    </article>
  );
}

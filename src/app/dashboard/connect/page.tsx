'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MousePointer2, Plus, Plug, RefreshCw, TrendingUp } from 'lucide-react';
import { CampaignCard } from '@/components/dashboard/command-center/CampaignCard';
import { ChannelCard } from '@/components/dashboard/command-center/ChannelCard';
import { IntelligenceFeed } from '@/components/dashboard/command-center/IntelligenceFeed';
import type { IntelligenceFeedItem } from '@/components/dashboard/command-center/IntelligenceFeed';
import type { UnifiedCampaign, UnifiedStatsResponse } from '@/types/command-center';

type FilterKey = 'all' | 'active' | 'paused' | 'review';
type SortKey = 'spend' | 'roas' | 'updated';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'Activas' },
  { key: 'paused', label: 'Pausadas' },
  { key: 'review', label: 'En revisión' },
];

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'spend', label: 'Gasto (Alto)' },
  { key: 'roas', label: 'ROAS' },
  { key: 'updated', label: 'Recientes' },
];

const EMPTY_STATS: UnifiedStatsResponse = {
  campaigns: [],
  channels: [],
  totals: {
    spendToday: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    roas: 0,
    cpa: 0,
  },
};

function mapCommandPlatformToOauth(platform: 'meta' | 'google' | 'tiktok') {
  if (platform === 'meta') {
    return 'instagram';
  }

  return platform;
}

function mapInsightPlatformToUnified(platform: string): 'meta' | 'google' | 'tiktok' {
  if (platform === 'google') return 'google';
  if (platform === 'tiktok') return 'tiktok';
  return 'meta';
}

function mapInsightPlatformToStudio(platform: string) {
  if (platform === 'tiktok') return 'tiktok';
  if (platform === 'google') return 'youtube-shorts';
  return 'instagram-reels';
}

export default function CommandCenterPage() {
  const [stats, setStats] = useState<UnifiedStatsResponse>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('spend');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [syncingCampaignId, setSyncingCampaignId] = useState<string | null>(null);
  const [showConnectPicker, setShowConnectPicker] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/campaigns/unified/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const data = (await response.json()) as UnifiedStatsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudieron cargar las métricas del Command Center.');
      }

      setStats(data);
      if (!selectedCampaignId && data.campaigns.length > 0) {
        setSelectedCampaignId(data.campaigns[0].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar la vista unificada.');
    } finally {
      setLoading(false);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('oauth');
    const platform = params.get('platform');

    if (oauth === 'success') {
      setMessage(`Canal ${platform || 'seleccionado'} conectado. Ya puedes operar campañas desde aquí.`);
      void fetchStats();
    }

    if (oauth === 'error') {
      setMessage(`No se pudo completar OAuth para ${platform || 'la plataforma seleccionada'}.`);
    }
  }, [fetchStats]);

  const filteredCampaigns = useMemo(() => {
    let campaigns = stats.campaigns;

    if (filter !== 'all') {
      campaigns = campaigns.filter((campaign) => campaign.status === filter);
    }

    if (sort === 'roas') {
      return [...campaigns].sort((a, b) => b.metrics.roas - a.metrics.roas);
    }

    if (sort === 'updated') {
      return [...campaigns].sort((a, b) => b.schedule.start.localeCompare(a.schedule.start));
    }

    return [...campaigns].sort((a, b) => b.metrics.spend - a.metrics.spend);
  }, [filter, sort, stats.campaigns]);

  const selectedCampaign = useMemo(
    () => stats.campaigns.find((campaign) => campaign.id === selectedCampaignId) || null,
    [selectedCampaignId, stats.campaigns]
  );

  const handleConnect = async (platform: 'meta' | 'google' | 'tiktok') => {
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/connect/oauth/start', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform: mapCommandPlatformToOauth(platform) }),
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'No se pudo iniciar OAuth para este canal.');
      }

      window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar OAuth.');
    }
  };

  const handleCreateUnifiedCampaign = async () => {
    const connectedPlatforms = Array.from(new Set(stats.channels.filter((c) => c.connected).map((c) => c.platform)));

    setIsCreating(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const payload = {
        name: `Campaña Multi-canal ${new Date().toLocaleDateString('es-ES')}`,
        platforms: connectedPlatforms.length > 0 ? connectedPlatforms : ['meta'],
        budgetDaily: 400,
      };

      const response = await fetch('/api/campaigns/unified/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo crear campaña multi-canal.');
      }

      setMessage(data.message || 'Campaña creada correctamente.');
      await fetchStats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear campaña multi-canal.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleCampaign = async (campaign: UnifiedCampaign) => {
    try {
      const token = localStorage.getItem('token');
      const action = campaign.status === 'active' ? 'pause' : 'resume';
      const response = await fetch(`/api/campaigns/${campaign.id}/pause`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo actualizar estado de la campaña.');
      }

      setMessage(data.message || 'Estado de campaña actualizado.');
      await fetchStats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar estado de campaña.');
    }
  };

  const handleSyncCampaign = async (campaignId: string) => {
    setSyncingCampaignId(campaignId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/campaigns/${campaignId}/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo sincronizar campaña.');
      }

      setMessage(data.message || 'Sincronización completada.');
      await fetchStats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo sincronizar campaña.');
    } finally {
      setSyncingCampaignId(null);
    }
  };

  const handleDuplicateCampaign = async (campaignId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/campaigns/${campaignId}/duplicate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo duplicar campaña.');
      }

      setMessage(data.message || 'Campaña duplicada.');
      await fetchStats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo duplicar campaña.');
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    const confirmed = window.confirm('Esta acción eliminará la campaña seleccionada. ¿Continuar?');
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo eliminar campaña.');
      }

      setMessage(data.message || 'Campaña eliminada.');
      await fetchStats();
      setSelectedCampaignId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo eliminar campaña.');
    }
  };

  const handleEditCampaign = async (campaign: UnifiedCampaign) => {
    const nextName = window.prompt('Nuevo nombre de campaña', campaign.name);
    if (!nextName || !nextName.trim()) return;

    const nextBudgetRaw = window.prompt('Nuevo presupuesto diario (USD)', String(campaign.budget.daily));
    const nextBudget = Number(nextBudgetRaw || campaign.budget.daily);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: nextName.trim(),
          budget: Number.isFinite(nextBudget) ? nextBudget : campaign.budget.daily,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo editar campaña.');
      }

      setMessage('Campaña actualizada.');
      await fetchStats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo editar campaña.');
    }
  };

  const handleOpenStudio = (campaign: UnifiedCampaign) => {
    if (campaign.creative.studioProjectId) {
      window.location.href = `/dashboard/studio?project=${campaign.creative.studioProjectId}`;
      return;
    }

    window.location.href = '/dashboard/studio';
  };

  const handleExecuteIntelligence = async (item: IntelligenceFeedItem) => {
    try {
      const token = localStorage.getItem('token');
      const platform = mapInsightPlatformToUnified(item.platform);
      const name = item.kind === 'insight' ? item.title : item.name;
      const description = item.kind === 'insight' ? item.hook : `${item.creativeDirection}. Oferta: ${item.offer}.`;

      const response = await fetch('/api/campaigns/unified/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          budgetDaily: item.kind === 'insight' ? 350 : 500,
          platforms: [platform],
        }),
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo ejecutar este blueprint.');
      }

      setMessage(data.message || 'Blueprint ejecutado. Abriendo Nexora Studio...');
      await fetchStats();

      const params = new URLSearchParams({
        brief: item.kind === 'insight' ? item.hook : item.creativeDirection,
        platform: mapInsightPlatformToStudio(item.platform),
        format: item.kind === 'insight' ? 'full-script' : 'storyboard',
        duration: item.kind === 'insight' ? '30' : '60',
        source: 'intelligence-feed',
      });

      window.location.href = `/dashboard/studio?${params.toString()}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo ejecutar el blueprint.');
    }
  };

  const totalConnectedChannels = stats.channels.filter((channel) => channel.connected).length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-200">
      <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 backdrop-blur">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">Nexora Command Center</h1>
          <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-xs text-cyan-400">LIVE DATA</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchStats()}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
          >
            Actualizar
          </button>
          <button
            onClick={handleCreateUnifiedCampaign}
            disabled={isCreating}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-60"
          >
            <Plus size={16} />
            {isCreating ? 'Creando...' : 'Nueva Campaña'}
          </button>
        </div>
      </header>

      {message ? (
        <div className="border-b border-slate-800 bg-slate-900/70 px-6 py-2 text-xs text-cyan-200">{message}</div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-900/30">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Cuentas activas</h2>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {stats.channels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} onConnect={handleConnect} />
            ))}

            <button
              onClick={() => setShowConnectPicker((current) => !current)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-3 text-sm text-slate-500 transition hover:border-cyan-500 hover:text-cyan-400"
            >
              <Plug size={16} />
              Conectar nuevo canal
            </button>
            {showConnectPicker ? (
              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-2">
                <button
                  onClick={() => handleConnect('meta')}
                  className="w-full rounded-md border border-slate-700 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-500"
                >
                  Conectar Meta (Instagram/Facebook)
                </button>
                <button
                  onClick={() => handleConnect('google')}
                  className="w-full rounded-md border border-slate-700 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-500"
                >
                  Conectar Google Ads
                </button>
                <button
                  onClick={() => handleConnect('tiktok')}
                  className="w-full rounded-md border border-slate-700 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-500"
                >
                  Conectar TikTok Ads
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-800 bg-slate-900/50 p-4">
            <p className="mb-1 text-xs text-slate-500">Gasto total</p>
            <p className="text-2xl font-bold text-white">${stats.totals.spendToday.toFixed(2)}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp size={12} />
              {totalConnectedChannels} canales conectados
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    filter === item.key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Ordenar por:</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-white"
              >
                {SORTS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-64 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 text-slate-500">
              <Plus size={28} className="mb-2" />
              {totalConnectedChannels === 0 ? (
                <>
                  <p className="font-medium text-slate-300">Conecta tu primer canal publicitario</p>
                  <p className="mt-1 max-w-xs text-center text-xs text-slate-500">Conecta Meta, Google Ads o TikTok Ads desde el panel izquierdo para empezar a gestionar campañas reales.</p>
                  <button
                    onClick={() => setShowConnectPicker(true)}
                    className="mt-4 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300"
                  >
                    Conectar canal →
                  </button>
                </>
              ) : (
                <>
                  <p className="font-medium">No hay campañas para este filtro</p>
                  <button
                    onClick={handleCreateUnifiedCampaign}
                    className="mt-4 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300"
                  >
                    Crear campaña multi-canal
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  selected={campaign.id === selectedCampaignId}
                  onSelect={(value) => setSelectedCampaignId(value.id)}
                  onToggleStatus={handleToggleCampaign}
                  onOpenStudio={handleOpenStudio}
                />
              ))}
            </div>
          )}
        </main>

        <aside className="flex w-[26rem] min-w-[26rem] flex-col border-l border-slate-800 bg-slate-900/30">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Detalle de campaña</h2>
          </div>

          {!selectedCampaign ? (
            <div className="border-b border-slate-800 px-6 py-10 text-center text-slate-500">
              <MousePointer2 size={48} className="mx-auto mb-4 opacity-20" />
              <p>Selecciona una campaña para ver detalles y acciones rápidas.</p>
            </div>
          ) : (
            <div className="space-y-5 border-b border-slate-800 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Campaña</p>
                <h3 className="mt-1 text-lg font-semibold text-white">{selectedCampaign.name}</h3>
                <p className="text-sm text-slate-400">{selectedCampaign.channel.accountName}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs text-slate-400">ROAS</p>
                  <p className="font-mono text-white">{selectedCampaign.metrics.roas.toFixed(2)}x</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs text-slate-400">CPA</p>
                  <p className="font-mono text-white">${selectedCampaign.metrics.cpa.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs text-slate-400">Clicks</p>
                  <p className="font-mono text-white">{selectedCampaign.metrics.clicks}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs text-slate-400">Conv.</p>
                  <p className="font-mono text-white">{selectedCampaign.metrics.conversions}</p>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Acciones rápidas</p>
                <button
                  onClick={() => handleOpenStudio(selectedCampaign)}
                  className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-cyan-300"
                >
                  Editar creativo en Nexora Studio
                </button>
                <button
                  onClick={() => void handleEditCampaign(selectedCampaign)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200"
                >
                  Editar campaña
                </button>
                <button
                  onClick={() => void handleDuplicateCampaign(selectedCampaign.id)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200"
                >
                  Duplicar campaña
                </button>
                <button
                  onClick={() => handleToggleCampaign(selectedCampaign)}
                  className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-300"
                >
                  {selectedCampaign.status === 'active' ? 'Pausar campaña' : 'Reactivar campaña'}
                </button>
                <button
                  onClick={() => void handleSyncCampaign(selectedCampaign.id)}
                  disabled={syncingCampaignId === selectedCampaign.id}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 disabled:opacity-60"
                >
                  <RefreshCw size={14} className={syncingCampaignId === selectedCampaign.id ? 'animate-spin' : ''} />
                  {syncingCampaignId === selectedCampaign.id ? 'Sincronizando...' : 'Sincronizar métricas'}
                </button>
                <button
                  onClick={() => void handleDeleteCampaign(selectedCampaign.id)}
                  className="w-full rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-300"
                >
                  Eliminar campaña
                </button>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-400">
                Flujo recomendado: crear multi-canal, ajustar creativo en Nexora Studio y sincronizar resultados cada 15 minutos.
              </div>

              <Link href="/dashboard/campaigns/smart" className="inline-block text-xs text-cyan-400 hover:text-cyan-300">
                Ir a Smart Campaign
              </Link>
            </div>
          )}

          <div className="min-h-0 flex-1">
            <IntelligenceFeed onExecute={handleExecuteIntelligence} />
          </div>
        </aside>
      </div>
    </div>
  );
}

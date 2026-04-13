'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MousePointer2, Plus, Plug, RefreshCw, TrendingUp, X } from 'lucide-react';
import { AdPreviewCard } from '@/components/AdPreviewCard';
import type { AdPreviewVariant } from '@/components/AdPreviewCard';
import { CampaignCard } from '@/components/dashboard/command-center/CampaignCard';
import { ChannelCard } from '@/components/dashboard/command-center/ChannelCard';
import { IntelligenceFeed } from '@/components/dashboard/command-center/IntelligenceFeed';
import type { IntelligenceFeedItem } from '@/components/dashboard/command-center/IntelligenceFeed';
import type { CommandPlatform, ConnectedChannel, UnifiedCampaign, UnifiedStatsResponse } from '@/types/command-center';

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

/** Single form value: maps to Marketing API channel + AdPreviewCard Meta placement. */
type CreateFlowPlatform = 'meta-instagram' | 'meta-facebook' | 'google' | 'tiktok';

function createFlowToApiPlatforms(key: CreateFlowPlatform): Array<'meta' | 'google' | 'tiktok'> {
  if (key === 'meta-instagram' || key === 'meta-facebook') return ['meta'];
  return [key];
}

function createFlowToAdPreviewPlatform(key: CreateFlowPlatform): 'facebook' | 'instagram' {
  if (key === 'meta-facebook') return 'facebook';
  return 'instagram';
}

function createFlowToAssistChannelLabel(key: CreateFlowPlatform): string {
  if (key === 'meta-instagram') return 'Meta · Instagram';
  if (key === 'meta-facebook') return 'Meta · Facebook';
  if (key === 'google') return 'Google Ads';
  return 'TikTok Ads';
}

function unifiedChannelToCreateFlowPlatform(platform: CommandPlatform): CreateFlowPlatform {
  if (platform === 'google') return 'google';
  if (platform === 'tiktok') return 'tiktok';
  return 'meta-instagram';
}

/** Google/TikTok OAuth placeholder accounts use accountId `oauth-{platform}-{ts}` — no full Ads API token in Nexora yet. */
function isLimitedChannelConnection(channel: ConnectedChannel): boolean {
  if (!channel.connected) return false;
  if (channel.platform !== 'google' && channel.platform !== 'tiktok') return false;
  return channel.accountId.startsWith('oauth-');
}

function normalizePlatformForDraft(platform: string): CommandPlatform {
  if (platform === 'instagram' || platform === 'facebook') return 'meta';
  if (platform === 'google') return 'google';
  return 'tiktok';
}

function nexoraCreativeFromTargetingClient(targeting: unknown) {
  const empty = {
    imageUrl: undefined as string | undefined,
    primaryText: undefined as string | undefined,
    headline: undefined as string | undefined,
    description: undefined as string | undefined,
    cta: undefined as string | undefined,
    variant: undefined as 'feed' | 'story' | undefined,
  };

  if (!targeting || typeof targeting !== 'object') {
    return empty;
  }

  const raw = (targeting as Record<string, unknown>).nexoraCreative;
  if (!raw || typeof raw !== 'object') {
    return empty;
  }

  const c = raw as Record<string, unknown>;
  const variantRaw = String(c.variant || '').toLowerCase();
  const variant = variantRaw === 'story' ? ('story' as const) : variantRaw === 'feed' ? ('feed' as const) : undefined;

  const str = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s || undefined;
  };

  return {
    imageUrl: str(c.imageUrl),
    primaryText: str(c.primaryText),
    headline: str(c.headline),
    description: str(c.description),
    cta: str(c.cta),
    variant,
  };
}

function meApiRowToUnifiedDraft(c: Record<string, unknown>): UnifiedCampaign {
  const id = String(c.id || '');
  const name = String(c.name || '');
  const budget = Number(c.budget);
  const budgetSafe = Number.isFinite(budget) ? budget : 0;
  const startRaw = c.startDate;
  const start =
    startRaw instanceof Date
      ? startRaw.toISOString()
      : typeof startRaw === 'string'
        ? startRaw
        : new Date(String(startRaw)).toISOString();
  const endRaw = c.endDate;
  const end =
    endRaw == null || endRaw === ''
      ? new Date(new Date(start).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : endRaw instanceof Date
        ? endRaw.toISOString()
        : String(endRaw);

  const adAccount = c.adAccount as { platform?: string; accountName?: string } | undefined;
  const platform = normalizePlatformForDraft(adAccount?.platform || 'instagram');
  const accountName = String(adAccount?.accountName || 'Cuenta');
  const accountId = String(c.adAccountId || 'nexora-borrador');

  const analytics = c.analytics as Record<string, unknown> | null | undefined;
  const spend = Number(analytics?.spend) || 0;
  const revenue = Number(analytics?.revenue) || 0;
  const conversions = Number(analytics?.conversions) || 0;
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = conversions > 0 ? spend / conversions : spend;

  const fromTargeting = nexoraCreativeFromTargetingClient(c.targeting);
  const imageUrl = fromTargeting.imageUrl;
  const thumbnail = imageUrl || null;

  return {
    id,
    name,
    status: 'draft',
    channel: {
      platform,
      accountName,
      accountId,
    },
    metrics: {
      spend,
      impressions: Number(analytics?.impressions) || 0,
      clicks: Number(analytics?.clicks) || 0,
      conversions,
      roas,
      cpa,
    },
    creative: {
      type: 'video' as const,
      thumbnail,
      studioProjectId: undefined,
      imageUrl,
      primaryText: fromTargeting.primaryText,
      headline: fromTargeting.headline,
      description: fromTargeting.description,
      cta: fromTargeting.cta,
      variant: fromTargeting.variant,
    },
    budget: {
      daily: budgetSafe,
      total: budgetSafe * 30,
      spent: spend,
      remaining: Math.max(0, budgetSafe - spend),
    },
    schedule: {
      start,
      end,
    },
    actions: ['pause', 'resume', 'duplicate', 'edit', 'delete'],
  };
}

export default function CommandCenterPage() {
  const [stats, setStats] = useState<UnifiedStatsResponse>(EMPTY_STATS);
  const [draftCampaigns, setDraftCampaigns] = useState<UnifiedCampaign[]>([]);
  const [statsFetchedAt, setStatsFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('spend');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [syncingCampaignId, setSyncingCampaignId] = useState<string | null>(null);
  const [duplicatingCampaignId, setDuplicatingCampaignId] = useState<string | null>(null);
  const [activatingCampaignId, setActivatingCampaignId] = useState<string | null>(null);
  const [showConnectPicker, setShowConnectPicker] = useState(false);

  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [createPlatform, setCreatePlatform] = useState<CreateFlowPlatform>('meta-instagram');
  const [budgetDaily, setBudgetDaily] = useState(400);
  const [imageUrl, setImageUrl] = useState('');
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [cta, setCta] = useState('Ver más');
  const [variant, setVariant] = useState<AdPreviewVariant>('feed');
  const [copyAssistLoading, setCopyAssistLoading] = useState<'primaryText' | 'headline' | 'cta' | null>(null);
  const [copyAssistSuggestion, setCopyAssistSuggestion] = useState<{
    field: 'primaryText' | 'headline' | 'cta';
    text: string;
  } | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const authHeaders = { Authorization: `Bearer ${token}` };
      const [statsResponse, meResponse] = await Promise.all([
        fetch('/api/campaigns/unified/stats', {
          headers: authHeaders,
          cache: 'no-store',
        }),
        fetch('/api/users/me', {
          headers: authHeaders,
          cache: 'no-store',
        }),
      ]);

      const data = (await statsResponse.json()) as UnifiedStatsResponse & { error?: string };
      if (!statsResponse.ok) {
        throw new Error(data.error || 'No se pudieron cargar las métricas del Command Center.');
      }

      let drafts: UnifiedCampaign[] = [];
      if (meResponse.ok) {
        const me = (await meResponse.json()) as { campaigns?: Array<Record<string, unknown>> };
        const rows = Array.isArray(me.campaigns) ? me.campaigns : [];
        const draftRows = rows
          .filter((row) => String(row.status || '').toLowerCase() === 'draft')
          .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        drafts = draftRows.map((row) => meApiRowToUnifiedDraft(row));
      }

      setStats(data);
      setDraftCampaigns(drafts);
      setStatsFetchedAt(new Date().toISOString());
      if (!selectedCampaignId) {
        if (data.campaigns.length > 0) {
          setSelectedCampaignId(data.campaigns[0].id);
        } else if (drafts.length > 0) {
          setSelectedCampaignId(drafts[0].id);
        }
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

  useEffect(() => {
    if (!showCreateCampaignModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) {
        setShowCreateCampaignModal(false);
        setEditingCampaignId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCreateCampaignModal, isCreating]);

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

  const selectedCampaign = useMemo(() => {
    return (
      stats.campaigns.find((campaign) => campaign.id === selectedCampaignId) ||
      draftCampaigns.find((campaign) => campaign.id === selectedCampaignId) ||
      null
    );
  }, [selectedCampaignId, stats.campaigns, draftCampaigns]);

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

  const closeCampaignModal = () => {
    setShowCreateCampaignModal(false);
    setEditingCampaignId(null);
    setCopyAssistLoading(null);
    setCopyAssistSuggestion(null);
  };

  const runCopyAssist = useCallback(
    async (field: 'primaryText' | 'headline' | 'cta') => {
      setCopyAssistLoading(field);
      setCopyAssistSuggestion(null);
      try {
        const token = localStorage.getItem('token');
        const task = field === 'primaryText' ? 'improve-primary' : field === 'headline' ? 'headline' : 'cta';
        const response = await fetch('/api/ai/campaign-copy-assist', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            task,
            campaignName: campaignName.trim(),
            description: description.trim(),
            primaryText: primaryText.trim(),
            headline: headline.trim(),
            cta: cta.trim(),
            channelLabel: createFlowToAssistChannelLabel(createPlatform),
          }),
        });
        const data = (await response.json()) as { suggestion?: string; error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'No se pudo generar el texto.');
        }
        const text = String(data.suggestion || '').trim();
        if (!text) {
          throw new Error('La IA devolvió un texto vacío.');
        }
        setCopyAssistSuggestion({ field, text });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Error al usar la asistencia IA.');
      } finally {
        setCopyAssistLoading(null);
      }
    },
    [campaignName, createPlatform, cta, description, headline, primaryText]
  );

  const openCreateCampaignModal = () => {
    setEditingCampaignId(null);
    const dateLabel = new Date().toLocaleDateString('es-ES');
    setCampaignName(`Campaña Multi-canal ${dateLabel}`);
    setCreatePlatform('meta-instagram');
    setBudgetDaily(400);
    setImageUrl('');
    setPrimaryText('');
    setHeadline('');
    setDescription('');
    setCta('Ver más');
    setVariant('feed');
    setShowCreateCampaignModal(true);
  };

  const openEditCampaignModal = (campaign: UnifiedCampaign) => {
    setEditingCampaignId(campaign.id);
    setSelectedCampaignId(campaign.id);
    setCampaignName(campaign.name);
    setCreatePlatform(unifiedChannelToCreateFlowPlatform(campaign.channel.platform));
    setBudgetDaily(campaign.budget.daily);
    setImageUrl(campaign.creative.imageUrl ?? '');
    setPrimaryText(campaign.creative.primaryText ?? '');
    setHeadline(campaign.creative.headline ?? '');
    setDescription(campaign.creative.description ?? '');
    setCta(campaign.creative.cta?.trim() ? campaign.creative.cta : 'Ver más');
    setVariant(campaign.creative.variant ?? 'feed');
    setShowCreateCampaignModal(true);
  };

  const submitCreateCampaignModal = async () => {
    const name = campaignName.trim();
    if (!name) {
      setMessage('Indica un nombre de campaña.');
      return;
    }

    setIsCreating(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const creative = {
        imageUrl: imageUrl.trim(),
        primaryText: primaryText.trim(),
        headline: headline.trim(),
        description: description.trim(),
        cta: cta.trim(),
        variant,
      };
      const raw = Number.isFinite(budgetDaily) ? budgetDaily : 400;
      const budgetValue = Math.max(50, Math.min(50000, raw));

      if (editingCampaignId) {
        const response = await fetch(`/api/campaigns/${editingCampaignId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            budget: budgetValue,
            creative,
          }),
        });

        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'No se pudo guardar la campaña.');
        }

        setMessage('Campaña actualizada.');
        closeCampaignModal();
        await fetchStats();
      } else {
        const payload = {
          name,
          platforms: createFlowToApiPlatforms(createPlatform),
          budgetDaily: budgetValue,
          creative,
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
        closeCampaignModal();
        await fetchStats();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : editingCampaignId
            ? 'No se pudo guardar la campaña.'
            : 'No se pudo crear campaña multi-canal.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleActivateCampaign = async (campaign: UnifiedCampaign) => {
    if (campaign.status !== 'draft') return;

    setActivatingCampaignId(campaign.id);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'active' }),
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo activar la campaña.');
      }

      setMessage(data.message || 'Campaña activada.');
      await fetchStats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo activar la campaña.');
    } finally {
      setActivatingCampaignId(null);
    }
  };

  const handleToggleCampaign = async (campaign: UnifiedCampaign) => {
    if (campaign.status === 'draft') {
      return;
    }
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

  const handleDuplicateCampaign = async (campaign: UnifiedCampaign) => {
    setDuplicatingCampaignId(campaign.id);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const creative = {
        imageUrl: (campaign.creative.imageUrl || campaign.creative.thumbnail || '').trim(),
        primaryText: (campaign.creative.primaryText || '').trim(),
        headline: (campaign.creative.headline || '').trim(),
        description: (campaign.creative.description || '').trim(),
        cta: (campaign.creative.cta || '').trim(),
        variant: campaign.creative.variant ?? 'feed',
      };

      const response = await fetch('/api/campaigns/unified/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${campaign.name.trim()} (copia)`,
          platforms: [campaign.channel.platform],
          budgetDaily: campaign.budget.daily,
          creative,
        }),
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo duplicar campaña.');
      }

      setMessage(data.message || 'Campaña duplicada.');
      await fetchStats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo duplicar campaña.');
    } finally {
      setDuplicatingCampaignId(null);
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

  const handleEditCampaign = (campaign: UnifiedCampaign) => {
    openEditCampaignModal(campaign);
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
        <div className="flex items-baseline gap-4">
          <h1 className="text-xl font-bold text-white">Nexora Command Center</h1>
          <div className="flex flex-col gap-0.5">
            <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-xs text-cyan-400">Datos en Nexora</span>
            {statsFetchedAt ? (
              <span className="text-[11px] text-slate-500">
                {'\u00DAltima actualizaci\u00f3n: '}
                {new Date(statsFetchedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchStats()}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
          >
            Actualizar
          </button>
          <button
            type="button"
            onClick={openCreateCampaignModal}
            disabled={isCreating}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-60"
          >
            <Plus size={16} />
            Nueva Campaña
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
              <ChannelCard
                key={channel.id}
                channel={channel}
                limitedConnection={isLimitedChannelConnection(channel)}
                onConnect={handleConnect}
              />
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
          <p className="mb-4 rounded-lg border border-slate-700/80 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
            La vista principal muestra campañas en canales conectados. Los borradores aparecen en la sección inferior.
          </p>
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
          ) : (
            <>
              {filteredCampaigns.length === 0 ? (
                <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 text-slate-500">
                  <Plus size={28} className="mb-2" />
                  {totalConnectedChannels === 0 ? (
                    <>
                      <p className="font-medium text-slate-300">Conecta tu primer canal publicitario</p>
                      <p className="mt-1 max-w-xs text-center text-xs text-slate-500">
                        Conecta Meta, Google Ads o TikTok Ads desde el panel izquierdo para empezar a gestionar campañas reales.
                      </p>
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
                        type="button"
                        onClick={openCreateCampaignModal}
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
                      onSelect={openEditCampaignModal}
                      onToggleStatus={handleToggleCampaign}
                      onOpenStudio={handleOpenStudio}
                      onActivate={handleActivateCampaign}
                      activating={activatingCampaignId === campaign.id}
                    />
                  ))}
                </div>
              )}

              {draftCampaigns.length > 0 ? (
                <section className="mt-10 border-t border-slate-800 pt-8">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-violet-300">Borradores</h2>
                    <p className="mt-1 max-w-2xl text-xs text-slate-500">
                      Campañas guardadas en Nexora que aún no están en la vista principal (canal sin conectar o estado borrador).
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    {draftCampaigns.map((campaign) => (
                      <CampaignCard
                        key={campaign.id}
                        campaign={campaign}
                        selected={campaign.id === selectedCampaignId}
                        onSelect={openEditCampaignModal}
                        onToggleStatus={handleToggleCampaign}
                        onOpenStudio={handleOpenStudio}
                        onActivate={handleActivateCampaign}
                        activating={activatingCampaignId === campaign.id}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
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
                  onClick={() => handleEditCampaign(selectedCampaign)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200"
                >
                  Editar campaña
                </button>
                {selectedCampaign.status === 'draft' ? (
                  <button
                    type="button"
                    onClick={() => void handleActivateCampaign(selectedCampaign)}
                    disabled={activatingCampaignId === selectedCampaign.id}
                    className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-300 disabled:opacity-60"
                  >
                    {activatingCampaignId === selectedCampaign.id ? 'Activando…' : 'Activar campaña'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleDuplicateCampaign(selectedCampaign)}
                  disabled={duplicatingCampaignId === selectedCampaign.id}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 disabled:opacity-60"
                >
                  {duplicatingCampaignId === selectedCampaign.id ? 'Duplicando…' : 'Duplicar campaña'}
                </button>
                {selectedCampaign.status !== 'draft' ? (
                  <button
                    onClick={() => handleToggleCampaign(selectedCampaign)}
                    className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-300"
                  >
                    {selectedCampaign.status === 'active' ? 'Pausar en Nexora' : 'Reactivar en Nexora'}
                  </button>
                ) : null}
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

      {showCreateCampaignModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-campaign-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            aria-label="Cerrar"
            disabled={isCreating}
            onClick={() => !isCreating && closeCampaignModal()}
          />
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 id="create-campaign-title" className="text-lg font-semibold text-white">
                  {editingCampaignId ? 'Editar campaña' : 'Nueva campaña'}
                </h2>
                <p className="mt-1 max-w-xl text-xs text-slate-400">
                  Los datos creativos son solo para vista previa aquí. Al guardar, la campaña se registra en{' '}
                  <strong className="text-slate-200">Nexora</strong> con el mismo flujo de siempre.{' '}
                  <strong className="text-amber-200/90">No se publica en Meta Ads</strong> ni en otros canales todavía.
                </p>
              </div>
              <button
                type="button"
                disabled={isCreating}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                onClick={() => closeCampaignModal()}
                aria-label="Cerrar formulario"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_min(340px,40%)]">
              <div className="max-h-[min(72vh,720px)] overflow-y-auto border-b border-slate-800 p-5 lg:border-b-0 lg:border-r">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-400">Nombre de campaña</span>
                    <input
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                      placeholder="Ej. Lanzamiento primavera"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-400">Canal</span>
                      <select
                        value={createPlatform}
                        onChange={(e) => setCreatePlatform(e.target.value as CreateFlowPlatform)}
                        disabled={Boolean(editingCampaignId)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="meta-instagram">Meta · Instagram</option>
                        <option value="meta-facebook">Meta · Facebook</option>
                        <option value="google">Google Ads</option>
                        <option value="tiktok">TikTok Ads</option>
                      </select>
                      {editingCampaignId ? (
                        <p className="mt-1 text-[11px] text-slate-500">El canal publicitario no se puede cambiar aquí.</p>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-400">Presupuesto diario (USD)</span>
                      <input
                        type="number"
                        min={50}
                        max={50000}
                        value={budgetDaily}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setBudgetDaily(value < 50 ? 50 : value);
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-400">URL de imagen (vista previa)</span>
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                      placeholder="https://…"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-400">Texto principal</span>
                      <button
                        type="button"
                        disabled={isCreating || copyAssistLoading !== null}
                        onClick={() => void runCopyAssist('primaryText')}
                        className="shrink-0 rounded-md border border-violet-500/35 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                      >
                        {copyAssistLoading === 'primaryText' ? 'Generando...' : 'Mejorar texto'}
                      </button>
                    </span>
                    <textarea
                      value={primaryText}
                      onChange={(e) => setPrimaryText(e.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                    />
                    {copyAssistSuggestion?.field === 'primaryText' ? (
                      <div className="mt-2 rounded-lg border border-violet-500/25 bg-slate-950/80 px-3 py-2 text-xs">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/90">Sugerencia</p>
                        <p className="mt-1 text-slate-200">{copyAssistSuggestion.text}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-emerald-600/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-500"
                            onClick={() => {
                              setPrimaryText(copyAssistSuggestion.text);
                              setCopyAssistSuggestion(null);
                            }}
                          >
                            Aplicar
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-600 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                            onClick={() => setCopyAssistSuggestion(null)}
                          >
                            Descartar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </label>
                  <label className="block">
                    <span className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-400">Titular</span>
                      <button
                        type="button"
                        disabled={isCreating || copyAssistLoading !== null}
                        onClick={() => void runCopyAssist('headline')}
                        className="shrink-0 rounded-md border border-violet-500/35 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                      >
                        {copyAssistLoading === 'headline' ? 'Generando...' : 'Generar headline'}
                      </button>
                    </span>
                    <input
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                    {copyAssistSuggestion?.field === 'headline' ? (
                      <div className="mt-2 rounded-lg border border-violet-500/25 bg-slate-950/80 px-3 py-2 text-xs">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/90">Sugerencia</p>
                        <p className="mt-1 text-slate-200">{copyAssistSuggestion.text}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-emerald-600/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-500"
                            onClick={() => {
                              setHeadline(copyAssistSuggestion.text);
                              setCopyAssistSuggestion(null);
                            }}
                          >
                            Aplicar
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-600 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                            onClick={() => setCopyAssistSuggestion(null)}
                          >
                            Descartar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-400">Descripción</span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-400">CTA</span>
                        <button
                          type="button"
                          disabled={isCreating || copyAssistLoading !== null}
                          onClick={() => void runCopyAssist('cta')}
                          className="shrink-0 rounded-md border border-violet-500/35 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                        >
                          {copyAssistLoading === 'cta' ? 'Generando...' : 'Sugerir CTA'}
                        </button>
                      </span>
                      <input
                        value={cta}
                        onChange={(e) => setCta(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                      {copyAssistSuggestion?.field === 'cta' ? (
                        <div className="mt-2 rounded-lg border border-violet-500/25 bg-slate-950/80 px-3 py-2 text-xs">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/90">Sugerencia</p>
                          <p className="mt-1 text-slate-200">{copyAssistSuggestion.text}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-md bg-emerald-600/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-500"
                              onClick={() => {
                                setCta(copyAssistSuggestion.text);
                                setCopyAssistSuggestion(null);
                              }}
                            >
                              Aplicar
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-slate-600 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                              onClick={() => setCopyAssistSuggestion(null)}
                            >
                              Descartar
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-400">Formato vista previa</span>
                      <select
                        value={variant}
                        onChange={(e) => setVariant(e.target.value as AdPreviewVariant)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      >
                        <option value="feed">Feed (16:9)</option>
                        <option value="story">Historia (9:16)</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex max-h-[min(72vh,720px)] flex-col gap-3 overflow-y-auto bg-slate-950/50 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vista previa</p>
                {createPlatform === 'google' || createPlatform === 'tiktok' ? (
                  <p className="text-[11px] leading-snug text-slate-500">
                    Referencia estilo Meta; el canal seleccionado es {createPlatform === 'google' ? 'Google Ads' : 'TikTok'}.
                  </p>
                ) : null}
                <div className="mx-auto w-full max-w-sm">
                  <AdPreviewCard
                    imageUrl={imageUrl}
                    primaryText={primaryText}
                    headline={headline}
                    description={description}
                    cta={cta}
                    platform={createFlowToAdPreviewPlatform(createPlatform)}
                    variant={variant}
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/80 px-5 py-4">
              <button
                type="button"
                disabled={isCreating}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                onClick={() => closeCampaignModal()}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isCreating}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-60"
                onClick={() => void submitCreateCampaignModal()}
              >
                {isCreating
                  ? 'Guardando…'
                  : editingCampaignId
                    ? 'Guardar cambios'
                    : 'Guardar en Nexora'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

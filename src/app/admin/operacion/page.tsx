'use client';

import Link from 'next/link';
import { AlertCircle, BarChart3, Command, Rocket, TrendingUp, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type AdminAlert = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  actionLabel?: string;
  actionHref?: string;
};

type BusinessMetrics = {
  conversionRate: number;
  revenuePerLead: number;
  revenueByPlan: Array<{ plan: string; totalRevenue: number; count: number }>;
  revenueBySource: Array<{ source: string; campaign: string; revenue: number; leads: number; conversions: number }>;
};

type ConversionAutomationStats = {
  needsSalesFollowupCount: number;
  paidLeadCapturesExcludedCount: number;
  onboardingStartedUsersCount: number;
  followupQueue: Array<{
    id: string;
    email: string;
    createdAt: string | null;
    salesFollowupMarkedAt: string | null;
    salesRecoveryFollowupSentAt: string | null;
    paid: boolean;
  }>;
};

type AdminStats = {
  totalRevenue: number;
  monthlyRevenue: number;
  mrr: number;
  alerts: AdminAlert[];
  recentUsers: Array<{ id: string; email: string; name?: string | null; createdAt: string }>;
  business?: BusinessMetrics;
  conversionAutomation?: ConversionAutomationStats;
  funnel?: {
    captured: number;
    convertedToCrm: number;
    qualified: number;
    won: number;
    recent: Array<{
      id: string;
      email: string;
      name?: string | null;
      source: string;
      resource: string;
      createdAt: string;
      stage: string;
      value: number;
      convertedToCrmAt?: string | null;
      paid?: boolean;
      paidFromCapture?: boolean;
      convertedToPaidAt?: string | null;
      plan?: string | null;
      subscriptionStatus?: string | null;
      revenue?: number;
      attribution?: FunnelAttribution | null;
    }>;
  };
};

type Campaign = {
  id: string;
  name: string;
  platform: string;
  status: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  user: {
    name: string;
    email: string;
  };
};

function normalizeStage(stage?: string | null) {
  if (!stage) return 'lead';
  return stage.toLowerCase();
}

type FunnelAttribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  landingPath: string | null;
};

function formatAttributionOneLine(a: FunnelAttribution | null | undefined) {
  if (!a) return '—';
  const utm = [a.utmSource, a.utmMedium, a.utmCampaign].filter(Boolean).join(' · ');
  if (utm) return utm;
  if (a.referrer) return `ref: ${a.referrer.length > 56 ? `${a.referrer.slice(0, 56)}…` : a.referrer}`;
  if (a.landingPath) return a.landingPath.length > 56 ? `${a.landingPath.slice(0, 56)}…` : a.landingPath;
  return '—';
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function formatConversionRate(rate: number | undefined) {
  if (rate == null || Number.isNaN(rate)) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function formatRevenuePerLead(value: number | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return usd.format(value);
}

function formatAdminShortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminOperacionPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')?.trim();
        if (!token) {
          console.warn('[admin/stats debug operacion] no token in localStorage');
          return;
        }

        const authHeaders = { Authorization: `Bearer ${token}` };
        const [statsResponse, campaignsResponse] = await Promise.all([
          fetch('/api/admin/stats', { headers: authHeaders, cache: 'no-store', signal: ac.signal }),
          fetch('/api/admin/campaigns', { headers: authHeaders, cache: 'no-store', signal: ac.signal }),
        ]);

        if (ac.signal.aborted) return;

        const statsData = await statsResponse.json();
        const campaignsData = await campaignsResponse.json();

        if (ac.signal.aborted) return;

        const statsAccepted =
          statsResponse.ok &&
          statsData.stats != null &&
          typeof statsData.stats === 'object' &&
          !Array.isArray(statsData.stats);

        console.log('[admin/stats debug operacion]', {
          httpStatus: statsResponse.status,
          tokenPresent: Boolean(token),
          payloadKeys: statsData && typeof statsData === 'object' ? Object.keys(statsData) : [],
          hasStatsKey: Object.prototype.hasOwnProperty.call(statsData, 'stats'),
          statsType: statsData.stats === null ? 'null' : typeof statsData.stats,
          statsIsArray: Array.isArray(statsData.stats),
          statsAccepted,
        });

        if (statsAccepted) {
          console.log('[admin/stats debug operacion] setStats applied');
          setStats(statsData.stats as AdminStats);
        } else {
          console.error('[admin/stats debug operacion] stats rejected', statsResponse.status, statsData?.error);
          setStats(null);
        }
        setCampaigns(campaignsData.campaigns || []);
      } catch (error) {
        if (ac.signal.aborted) return;
        console.error('Error loading admin operation center:', error);
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchData();
    return () => ac.abort();
  }, []);

  const activeCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.status === 'active').slice(0, 4), [campaigns]);
  const recentLeads = useMemo(() => (stats?.funnel?.recent || []).slice(0, 6), [stats?.funnel?.recent]);
  const urgentAlerts = useMemo(() => (stats?.alerts || []).slice(0, 3), [stats?.alerts]);
  const newLeads = recentLeads.filter((lead) => normalizeStage(lead.stage) === 'lead').length;

  const business = stats?.business;
  const topPlan = business?.revenueByPlan?.length ? business.revenueByPlan[0] : null;
  const topSource = business?.revenueBySource?.length ? business.revenueBySource[0] : null;
  const convAuto = stats?.conversionAutomation;

  if (loading) {
    return <div className="py-12 text-center text-slate-500">Cargando centro de operaciones...</div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Centro de Operaciones</h1>
          <p className="text-sm text-slate-400">Todo el negocio en tiempo real</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/connect" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500">
            + Crear Campaña
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <BarChart3 size={18} className="text-cyan-400" />
            Resumen de negocio
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-medium text-slate-500">Tasa de conversión</p>
              <p className="mt-1 text-2xl font-bold text-white">{business ? formatConversionRate(business.conversionRate) : '—'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {business ? 'Cerrados ÷ capturas totales' : 'Sin datos de negocio en la respuesta.'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-medium text-slate-500">Ingreso por lead</p>
              <p className="mt-1 text-2xl font-bold text-white">{business ? formatRevenuePerLead(business.revenuePerLead) : '—'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {business ? 'Facturación pagada / capturas totales' : 'Sin datos de negocio en la respuesta.'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-medium text-slate-500">Plan con más ingresos</p>
              {topPlan ? (
                <>
                  <p className="mt-1 truncate text-lg font-bold capitalize text-white" title={topPlan.plan}>
                    {topPlan.plan}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-cyan-400">{usd.format(topPlan.totalRevenue)}</p>
                  <p className="mt-1 text-xs text-slate-500">{topPlan.count} cliente{topPlan.count !== 1 ? 's' : ''}</p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-bold text-slate-500">—</p>
                  <p className="mt-1 text-xs text-slate-500">Sin ingresos agrupados por plan todavía.</p>
                </>
              )}
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-medium text-slate-500">Fuente con más ingresos</p>
              {topSource ? (
                <>
                  <p className="mt-1 truncate text-lg font-bold text-white" title={`${topSource.source} · ${topSource.campaign}`}>
                    {topSource.source}
                    {topSource.campaign && topSource.campaign !== '(none)' ? (
                      <span className="block truncate text-sm font-normal text-slate-400">{topSource.campaign}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-cyan-400">{usd.format(topSource.revenue)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {topSource.leads} leads · {topSource.conversions} conversiones
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-bold text-slate-500">—</p>
                  <p className="mt-1 text-xs text-slate-500">Sin atribución UTM con ingresos todavía.</p>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="col-span-12 rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <Zap size={18} className="text-amber-400" />
            Automatización de conversión
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-medium text-slate-500">Cola · necesita follow-up</p>
              <p className="mt-1 text-2xl font-bold text-white">{convAuto != null ? convAuto.needsSalesFollowupCount : '—'}</p>
              <p className="mt-1 text-xs text-slate-500">LeadCapture con needsSalesFollowup = true</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-medium text-slate-500">Excluidos (captura pagada)</p>
              <p className="mt-1 text-2xl font-bold text-white">{convAuto != null ? convAuto.paidLeadCapturesExcludedCount : '—'}</p>
              <p className="mt-1 text-xs text-slate-500">Filas LeadCapture con paid = true</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-medium text-slate-500">Onboarding iniciado</p>
              <p className="mt-1 text-2xl font-bold text-white">{convAuto != null ? convAuto.onboardingStartedUsersCount : '—'}</p>
              <p className="mt-1 text-xs text-slate-500">Usuarios con onboardingStartedAt</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase text-slate-500">
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Creado</th>
                  <th className="px-3 py-2 font-medium">Marcado follow-up</th>
                  <th className="px-3 py-2 font-medium">Recuperación enviada</th>
                  <th className="px-3 py-2 font-medium">Pago</th>
                </tr>
              </thead>
              <tbody>
                {!convAuto || convAuto.followupQueue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      Nadie en cola de recuperación (o sin datos de API todavía).
                    </td>
                  </tr>
                ) : (
                  convAuto.followupQueue.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/80 text-slate-300">
                      <td className="max-w-[220px] truncate px-3 py-2 font-mono text-xs" title={row.email}>
                        {row.email}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">{formatAdminShortDate(row.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">{formatAdminShortDate(row.salesFollowupMarkedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">{formatAdminShortDate(row.salesRecoveryFollowupSentAt)}</td>
                      <td className="px-3 py-2 text-xs">{row.paid ? <span className="text-emerald-400">Pagado</span> : <span className="text-slate-500">No</span>}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="col-span-12 rounded-xl border border-slate-800 bg-gradient-to-br from-cyan-600 to-blue-700 p-5 text-white xl:col-span-3">
          <p className="text-sm opacity-80">MRR Mensual</p>
          <p className="mt-1 text-3xl font-bold">${(stats?.mrr ?? 0).toLocaleString()}</p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <TrendingUp size={16} />
            <span>${(stats?.monthlyRevenue ?? 0).toLocaleString()} cobrados este mes</span>
          </div>
        </section>

        <section className="col-span-12 rounded-xl border border-slate-800 bg-slate-900 p-5 xl:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <Command size={18} className="text-cyan-400" />
              Pipeline Activo
            </h2>
            <span className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-400">{newLeads} nuevos</span>
          </div>

          <div className="space-y-2">
            {recentLeads.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">No hay leads recientes. El siguiente paso es activar captación y automatizaciones.</div>
            ) : (
              recentLeads.map((lead) => {
                const status = normalizeStage(lead.stage);
                const dot =
                  status === 'lead'
                    ? 'bg-emerald-400'
                    : status === 'contacted'
                      ? 'bg-blue-400'
                      : status === 'qualified'
                        ? 'bg-violet-400'
                        : status === 'proposal'
                          ? 'bg-amber-400'
                          : 'bg-cyan-400';
                const elapsed = Math.max(1, Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60)));
                const statusLabel =
                  status === 'lead'
                    ? 'lead'
                    : status === 'contacted'
                      ? 'contactado'
                      : status === 'qualified'
                        ? 'calificado'
                        : status === 'proposal'
                          ? 'propuesta'
                          : 'cerrado';
                return (
                  <div key={lead.id} className="group flex cursor-pointer items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/50 p-3 transition hover:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${dot}`} />
                      <div>
                        <p className="text-sm font-medium text-white transition group-hover:text-cyan-400">{lead.name || lead.email}</p>
                        <p className="text-xs text-slate-500">
                          {lead.email} · {lead.source} · {statusLabel} · {lead.paid ? 'Pagado' : 'Sin pago'} · {elapsed}h
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Plan: {lead.plan ?? '—'} · Facturado (pagado): ${(lead.revenue ?? 0).toLocaleString()}
                          {lead.subscriptionStatus ? ` · Sub: ${lead.subscriptionStatus}` : ''}
                        </p>
                        <p className="text-[10px] text-slate-500" title={lead.attribution?.referrer || lead.attribution?.landingPath || undefined}>
                          Atrib.: {formatAttributionOneLine(lead.attribution)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-slate-300">${lead.value || 0}</p>
                      <p className="text-[10px] uppercase text-slate-500">{statusLabel}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 grid gap-3 border-t border-slate-800 pt-4 text-xs text-slate-400 sm:grid-cols-4">
            <div>
              <p className="text-lg font-semibold text-white">{stats?.funnel?.captured || 0}</p>
              <p>Captados</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{stats?.funnel?.convertedToCrm || 0}</p>
              <p>En CRM</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{stats?.funnel?.qualified || 0}</p>
              <p>Calificados</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{stats?.funnel?.won || 0}</p>
              <p>Cerrados</p>
            </div>
          </div>

          <Link href="/admin/clientes" className="mt-4 block rounded-lg border border-dashed border-slate-700 py-2 text-center text-sm text-cyan-400 transition hover:border-cyan-500/50 hover:text-cyan-300">
            Ver clientes completo →
          </Link>
        </section>

        <section className="col-span-12 rounded-xl border border-slate-800 bg-slate-900 p-5 xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <Rocket size={18} className="text-purple-400" />
              Campañas en Vivo
            </h2>
          </div>

          <div className="space-y-3">
            {activeCampaigns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">No hay campañas activas. Usa Command Center para lanzar la primera.</div>
            ) : (
              activeCampaigns.map((campaign) => {
                const impressions = campaign.impressions ?? 0;
                const clicks = campaign.clicks ?? 0;
                const budget = campaign.budget ?? 0;
                const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0';
                return (
                  <div key={campaign.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{campaign.name}</p>
                        <p className="text-xs text-slate-500">{campaign.platform} • Presupuesto: ${campaign.budget}/día</p>
                      </div>
                      <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400">Activa</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-700/50 pt-3">
                      <div>
                        <p className="text-lg font-bold text-white">{impressions.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500">Impresiones</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{clicks.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500">Clics</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-400">{ctr}%</p>
                        <p className="text-[10px] text-slate-500">CTR</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="col-span-12 rounded-xl border border-slate-800 bg-slate-900 p-5 xl:col-span-3">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
            <AlertCircle size={16} className="text-amber-400" />
            Atención Requerida
          </h3>
          <div className="space-y-3">
            {urgentAlerts.length === 0 ? (
              <div className="rounded-lg bg-slate-800 p-3 text-sm text-slate-500">Sin alertas críticas ahora mismo.</div>
            ) : (
              urgentAlerts.map((alert) => (
                <div key={alert.id} className={`rounded-lg border p-3 ${alert.severity === 'high' ? 'border-amber-500/20 bg-amber-500/10' : 'border-slate-700 bg-slate-800'}`}>
                  <p className={`text-sm ${alert.severity === 'high' ? 'text-amber-200' : 'text-slate-300'}`}>{alert.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{alert.detail}</p>
                  {alert.actionHref ? <Link href={alert.actionHref} className="mt-1 inline-block text-xs text-cyan-400 hover:underline">{alert.actionLabel || 'Resolver ahora'}</Link> : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface AnalyticsCampaign {
  id: string;
  status: string;
  adAccount?: {
    platform: string;
  } | null;
  analytics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue?: number;
  } | null;
}

interface LeadCapture {
  id: string;
  source: string;
  resource: string;
  createdAt: string;
  convertedToCrmAt?: string | null;
}

interface CrmLead {
  id: string;
  source: string;
  stage: string;
  value: number;
  confidence: number;
  updatedAt: string;
}

interface AnalyticsUser {
  entitlements?: {
    marketingLabel: string;
    capabilities: {
      canUseAdvancedAnalytics: boolean;
      upgradeCta: string;
    };
  } | null;
}

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<AnalyticsCampaign[]>([]);
  const [captures, setCaptures] = useState<LeadCapture[]>([]);
  const [crmLeads, setCrmLeads] = useState<CrmLead[]>([]);
  const [user, setUser] = useState<AnalyticsUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const [userResponse, capturesResponse, crmResponse] = await Promise.all([
          fetch('/api/users/me', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
          fetch('/api/business/leads', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
          fetch('/api/crm/leads', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
        ]);

        const userData = await userResponse.json();
        const capturesData = capturesResponse.ok ? await capturesResponse.json() : { captures: [] };
        const crmData = crmResponse.ok ? await crmResponse.json() : { leads: [] };

        setCampaigns(userData.campaigns || []);
        setUser(userData.user);
        setCaptures(capturesData.captures || []);
        setCrmLeads(crmData.leads || []);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const metrics = useMemo(() => {
    const totals = campaigns.reduce(
      (accumulator, campaign) => {
        accumulator.impressions += campaign.analytics?.impressions || 0;
        accumulator.clicks += campaign.analytics?.clicks || 0;
        accumulator.conversions += campaign.analytics?.conversions || 0;
        accumulator.spend += campaign.analytics?.spend || 0;
        accumulator.revenue += campaign.analytics?.revenue || 0;

        const platform = campaign.adAccount?.platform || 'sin plataforma';
        accumulator.platformSpend[platform] =
          (accumulator.platformSpend[platform] || 0) + (campaign.analytics?.spend || 0);

        const status = campaign.status || 'sin estado';
        accumulator.statusCount[status] = (accumulator.statusCount[status] || 0) + 1;

        return accumulator;
      },
      {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
        platformSpend: {} as Record<string, number>,
        statusCount: {} as Record<string, number>,
      }
    );

    const capturedLeads = captures.length;
    const convertedCaptures = captures.filter((capture) => Boolean(capture.convertedToCrmAt)).length;
    const crmQualified = crmLeads.filter((lead) => ['qualified', 'proposal', 'won'].includes(lead.stage)).length;
    const crmWon = crmLeads.filter((lead) => lead.stage === 'won').length;
    const pipelineValue = crmLeads.filter((lead) => lead.stage !== 'won').reduce((sum, lead) => sum + lead.value, 0);
    const forecast = crmLeads.reduce((sum, lead) => sum + lead.value * (lead.confidence / 100), 0);
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const roi = totals.spend > 0 ? ((totals.revenue - totals.spend) / totals.spend) * 100 : 0;
    const leadToCrmRate = capturedLeads > 0 ? (convertedCaptures / capturedLeads) * 100 : 0;
    const costPerLead = capturedLeads > 0 ? totals.spend / capturedLeads : 0;

    return {
      ...totals,
      capturedLeads,
      convertedCaptures,
      crmQualified,
      crmWon,
      pipelineValue,
      forecast,
      ctr,
      roi,
      leadToCrmRate,
      costPerLead,
      platforms: Object.entries(totals.platformSpend).sort((a, b) => b[1] - a[1]),
      statuses: Object.entries(totals.statusCount).sort((a, b) => b[1] - a[1]),
    };
  }, [campaigns, captures, crmLeads]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Preparando analítica...</p>
        </div>
      </div>
    );
  }

  if (!user?.entitlements?.capabilities.canUseAdvancedAnalytics) {
    return (
      <div className="space-y-8">
        <section className="rounded-[30px] border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Analítica avanzada</p>
          <h1 className="mt-3 text-3xl font-semibold text-gray-900">Esta vista se desbloquea desde el plan Growth.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600">
            Tu plan actual puede ver el resumen del dashboard, pero la lectura consolidada entre campañas, captación y pipeline vive en el siguiente nivel.
          </p>
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {user?.entitlements?.capabilities.upgradeCta}
          </div>
          <Link
            href="/dashboard/billing"
            className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Ver upgrade
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Analítica avanzada</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-900">Lectura real de campañas, captación y pipeline.</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Esta vista ya no depende solo de campañas. También usa los leads captados y las oportunidades del CRM para que el panel no se sienta vacío ni desconectado del negocio.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Impresiones" value={metrics.impressions.toLocaleString()} />
        <MetricCard label="Clicks" value={metrics.clicks.toLocaleString()} />
        <MetricCard label="Leads captados" value={metrics.capturedLeads.toLocaleString()} />
        <MetricCard label="Leads a CRM" value={metrics.convertedCaptures.toLocaleString()} />
        <MetricCard label="CTR" value={`${metrics.ctr.toFixed(1)}%`} />
        <MetricCard label="ROI" value={`${metrics.roi.toFixed(0)}%`} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Inversión y retorno</h2>
          <div className="mt-6 space-y-4">
            <PanelStat label="Gasto total" value={`$${metrics.spend.toFixed(0)}`} />
            <PanelStat label="Revenue atribuido" value={`$${metrics.revenue.toFixed(0)}`} />
            <PanelStat label="Costo por lead" value={`$${metrics.costPerLead.toFixed(0)}`} />
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Salud del funnel</h2>
          <div className="mt-6 space-y-4">
            <PanelStat label="Paso a CRM" value={`${metrics.leadToCrmRate.toFixed(0)}%`} />
            <PanelStat label="Leads calificados" value={metrics.crmQualified.toLocaleString()} />
            <PanelStat label="Cierres" value={metrics.crmWon.toLocaleString()} />
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Pipeline comercial</h2>
          <div className="mt-6 space-y-4">
            <PanelStat label="Valor del pipeline" value={`$${Math.round(metrics.pipelineValue).toLocaleString()}`} />
            <PanelStat label="Forecast" value={`$${Math.round(metrics.forecast).toLocaleString()}`} />
            <PanelStat label="Campañas activas" value={String(campaigns.filter((campaign) => campaign.status === 'active').length)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Distribución por plataforma</h2>
          <div className="mt-6 space-y-4">
            {metrics.platforms.length === 0 ? (
              <EmptyPanel text="Todavía no hay gasto asociado a plataformas, pero esta vista ya está lista para mostrarlo en cuanto haya movimiento." />
            ) : (
              metrics.platforms.map(([platform, spend]) => (
                <RowStat key={platform} label={platform} value={`$${spend.toFixed(0)}`} />
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Estado de campañas</h2>
          <div className="mt-6 space-y-4">
            {metrics.statuses.length === 0 ? (
              <EmptyPanel text="Aún no hay campañas suficientes para agrupar por estado." />
            ) : (
              metrics.statuses.map(([status, count]) => (
                <RowStat key={status} label={status} value={String(count)} />
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function PanelStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function RowStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-5 py-4">
      <span className="text-sm font-semibold capitalize text-gray-900">{label}</span>
      <span className="text-sm text-gray-600">{value}</span>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">{text}</div>;
}

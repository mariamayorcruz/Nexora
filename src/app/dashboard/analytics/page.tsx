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
  createdAt: string;
  convertedToCrmAt?: string | null;
  paid?: boolean;
  convertedToPaidAt?: string | null;
}

interface CrmLead {
  id: string;
  stage: string;
  value: number;
  confidence: number;
}

interface AnalyticsUser {
  entitlements?: {
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

        return accumulator;
      },
      {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
        platformSpend: {} as Record<string, number>,
      }
    );

    const capturedLeads = captures.length;
    const convertedCaptures = captures.filter((capture) => Boolean(capture.convertedToCrmAt)).length;
    const paidCaptures = captures.filter((c) => c.paid).length;
    const crmQualified = crmLeads.filter((lead) => ['qualified', 'proposal', 'won'].includes(lead.stage)).length;
    const crmWon = crmLeads.filter((lead) => lead.stage === 'won').length;
    const pipelineValue = crmLeads.filter((lead) => lead.stage !== 'won').reduce((sum, lead) => sum + lead.value, 0);
    const forecast = crmLeads.reduce((sum, lead) => sum + lead.value * (lead.confidence / 100), 0);
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const roi = totals.spend > 0 ? ((totals.revenue - totals.spend) / totals.spend) * 100 : 0;
    const leadToCrmRate = capturedLeads > 0 ? (convertedCaptures / capturedLeads) * 100 : 0;
    const costPerLead = capturedLeads > 0 ? totals.spend / capturedLeads : 0;

    const topPlatforms = Object.entries(totals.platformSpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      ...totals,
      capturedLeads,
      convertedCaptures,
      paidCaptures,
      crmQualified,
      crmWon,
      pipelineValue,
      forecast,
      ctr,
      roi,
      leadToCrmRate,
      costPerLead,
      topPlatforms,
    };
  }, [campaigns, captures, crmLeads]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
      </div>
    );
  }

  if (!user?.entitlements?.capabilities.canUseAdvancedAnalytics) {
    return (
      <section className="rounded-[28px] bg-[#040810] p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Analítica avanzada</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">Desbloquea inteligencia de crecimiento.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Esta vista une campañas, leads y pipeline en una lectura ejecutiva limpia.
        </p>
        <div className="mt-5 rounded-[22px] bg-[#030610] p-4 text-sm text-slate-300">
          {user?.entitlements?.capabilities.upgradeCta}
        </div>
        <Link
          href="/dashboard/billing"
          className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
        >
          Ver upgrade
        </Link>
      </section>
    );
  }

  const actionItems = [
    metrics.leadToCrmRate < 35
      ? 'Subir conversion de captados a CRM con follow-up en menos de 24h.'
      : 'Mantener cadencia de paso a CRM, la base ya responde bien.',
    metrics.roi < 20
      ? 'Ajustar creativos y pausar anuncios de bajo retorno antes de escalar presupuesto.'
      : 'Escalar solo campañas con ROAS estable y costo por lead controlado.',
    metrics.crmWon === 0
      ? 'Priorizar cierre de propuestas activas para generar primeras victorias.'
      : 'Documentar playbook de las oportunidades ganadas y replicarlo.',
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#040810] p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">✦ Control ejecutivo</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
          Reportes
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Gasto, retorno, captación y pipeline en una sola vista.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Gasto" value={`$${Math.round(metrics.spend).toLocaleString()}`} />
        <Kpi label="ROI" value={`${metrics.roi.toFixed(0)}%`} />
        <Kpi label="Captados" value={metrics.capturedLeads.toLocaleString()} />
        <Kpi label="Paso a CRM" value={`${metrics.leadToCrmRate.toFixed(0)}%`} />
        <Kpi label="Forecast" value={`$${Math.round(metrics.forecast).toLocaleString()}`} />
        <Kpi label="Cierres" value={metrics.crmWon.toLocaleString()} />
      </section>

      <section className="rounded-[28px] bg-[#040810] p-5">
        <h2 className="text-lg font-semibold text-white">Embudo de capturas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] bg-[#030610] px-4 py-4">
            <p className="text-3xl font-bold text-white">{metrics.capturedLeads.toLocaleString()}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">Capturas totales</p>
            <p className="mt-2 text-sm text-slate-400">
              {metrics.capturedLeads > 0 ? '100' : '0'}% del total
            </p>
          </div>
          <div className="rounded-[22px] bg-[#030610] px-4 py-4">
            <p className="text-3xl font-bold text-white">{metrics.convertedCaptures.toLocaleString()}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">Pasaron a CRM</p>
            <p className="mt-2 text-sm text-slate-400">
              {metrics.capturedLeads > 0
                ? ((metrics.convertedCaptures / metrics.capturedLeads) * 100).toFixed(0)
                : '0'}
              % del total
            </p>
          </div>
          <div className="rounded-[22px] bg-[#030610] px-4 py-4">
            <p className="text-3xl font-bold text-white">{metrics.paidCaptures.toLocaleString()}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">Pagaron</p>
            <p className="mt-2 text-sm text-slate-400">
              {metrics.capturedLeads > 0
                ? ((metrics.paidCaptures / metrics.capturedLeads) * 100).toFixed(0)
                : '0'}
              % del total
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] bg-[#040810] p-5">
          <h2 className="text-lg font-semibold text-white">Rendimiento clave</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Row label="Impresiones" value={metrics.impressions.toLocaleString()} />
            <Row label="Clicks" value={metrics.clicks.toLocaleString()} />
            <Row label="CTR" value={`${metrics.ctr.toFixed(2)}%`} />
            <Row label="Costo por lead" value={`$${Math.round(metrics.costPerLead).toLocaleString()}`} />
            <Row label="Leads calificados" value={metrics.crmQualified.toLocaleString()} />
            <Row label="Pipeline abierto" value={`$${Math.round(metrics.pipelineValue).toLocaleString()}`} />
          </div>

          <div className="mt-4 rounded-[22px] bg-[#030610] p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Top plataformas por gasto</p>
            <div className="mt-2 space-y-2">
              {metrics.topPlatforms.length === 0 ? (
                <p className="text-sm text-slate-500">Sin gasto registrado todavía.</p>
              ) : (
                metrics.topPlatforms.map(([platform, spend]) => (
                  <div
                    key={platform}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
                  >
                    <span className="text-sm capitalize text-slate-200">{platform}</span>
                    <span className="text-sm font-semibold text-white">
                      ${Math.round(spend).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-[#040810] p-5">
          <h2 className="text-lg font-semibold text-white">Próximas jugadas</h2>
          <div className="mt-4 space-y-2">
            {actionItems.map((item) => (
              <div
                key={item}
                className="rounded-[20px] bg-[#030610] px-4 py-3 text-sm text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2">
            <Link
              href="/dashboard/integraciones"
              className="rounded-xl border border-white/[0.08] px-3 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
            >
              Ir a Integraciones
            </Link>
            <Link
              href="/dashboard/crm"
              className="rounded-xl border border-white/[0.08] px-3 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
            >
              Abrir CRM & Leads
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-[#040810] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-[#030610] px-3 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-base font-semibold text-white">{value}</p>
    </div>
  );
}

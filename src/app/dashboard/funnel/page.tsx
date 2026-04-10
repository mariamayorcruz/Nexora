'use client';

import { useEffect, useMemo, useState } from 'react';

interface FunnelCampaign {
  id: string;
  status: string;
  analytics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue?: number;
  } | null;
  adAccount?: {
    platform: string;
    accountName: string;
  } | null;
}

interface FunnelUser {
  entitlements?: {
    marketingLabel: string;
    capabilities: {
      canUseAdvancedAnalytics: boolean;
      upgradeCta: string;
    };
  } | null;
}

interface LeadCapture {
  id: string;
  email: string;
  source: string;
  resource: string;
  createdAt: string;
  convertedToCrmAt?: string | null;
}

interface FunnelAssumptions {
  averageDeal: number;
  responseRate: number;
  qualificationRate: number;
  proposalRate: number;
  closeRate: number;
}

const DEFAULT_ASSUMPTIONS: FunnelAssumptions = {
  averageDeal: 1200,
  responseRate: 58,
  qualificationRate: 62,
  proposalRate: 48,
  closeRate: 34,
};

export default function FunnelPage() {
  const [campaigns, setCampaigns] = useState<FunnelCampaign[]>([]);
  const [captures, setCaptures] = useState<LeadCapture[]>([]);
  const [user, setUser] = useState<FunnelUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [assumptions, setAssumptions] = useState<FunnelAssumptions>(DEFAULT_ASSUMPTIONS);

  useEffect(() => {
    const savedAssumptions = localStorage.getItem('nexoraFunnelAssumptions');
    if (!savedAssumptions) return;

    try {
      const parsed = JSON.parse(savedAssumptions) as Partial<FunnelAssumptions>;
      setAssumptions((current) => ({
        ...current,
        ...parsed,
      }));
    } catch (error) {
      console.error('Error reading funnel assumptions:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nexoraFunnelAssumptions', JSON.stringify(assumptions));
  }, [assumptions]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const [userResponse, capturesResponse] = await Promise.all([
          fetch('/api/users/me', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
          fetch('/api/business/leads', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
        ]);

        const data = await userResponse.json();
        const capturesData = capturesResponse.ok ? await capturesResponse.json() : { captures: [] };
        setCampaigns(data.campaigns || []);
        setUser(data.user);
        setCaptures(capturesData.captures || []);
      } catch (error) {
        console.error('Error fetching funnel data:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const funnel = useMemo(() => {
    const totals = campaigns.reduce(
      (accumulator, campaign) => {
        accumulator.impressions += campaign.analytics?.impressions || 0;
        accumulator.clicks += campaign.analytics?.clicks || 0;
        accumulator.conversions += campaign.analytics?.conversions || 0;
        accumulator.spend += campaign.analytics?.spend || 0;
        accumulator.revenue += campaign.analytics?.revenue || 0;

        const platform = campaign.adAccount?.platform || 'sin fuente';
        accumulator.byPlatform[platform] = {
          platform,
          accountName: campaign.adAccount?.accountName || 'Cuenta principal',
          clicks: (accumulator.byPlatform[platform]?.clicks || 0) + (campaign.analytics?.clicks || 0),
          conversions: (accumulator.byPlatform[platform]?.conversions || 0) + (campaign.analytics?.conversions || 0),
          spend: (accumulator.byPlatform[platform]?.spend || 0) + (campaign.analytics?.spend || 0),
        };

        return accumulator;
      },
      {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
        byPlatform: {} as Record<
          string,
          { platform: string; accountName: string; clicks: number; conversions: number; spend: number }
        >,
      }
    );

    const capturedLeads = captures.length;
    const conversionDrivenLeads =
      totals.conversions > 0 ? totals.conversions : Math.max(1, Math.round(totals.clicks * 0.08));
    const baseLeads = Math.max(capturedLeads, conversionDrivenLeads);
    const contacted = Math.round(baseLeads * (assumptions.responseRate / 100));
    const qualified = Math.round(contacted * (assumptions.qualificationRate / 100));
    const proposals = Math.round(qualified * (assumptions.proposalRate / 100));
    const wins = Math.max(0, Math.round(proposals * (assumptions.closeRate / 100)));
    const pipelineValue = proposals * assumptions.averageDeal;
    const forecast = wins * assumptions.averageDeal;
    const costPerLead = baseLeads > 0 ? totals.spend / baseLeads : 0;

    const stages = [
      { id: 'leads', label: 'Leads detectados', value: baseLeads },
      { id: 'contacted', label: 'Contactos con respuesta esperada', value: contacted },
      { id: 'qualified', label: 'Oportunidades calificadas', value: qualified },
      { id: 'proposals', label: 'Propuestas o demos con potencial', value: proposals },
      { id: 'wins', label: 'Ventas probables', value: wins },
    ];

    const topStageValue = Math.max(...stages.map((stage) => stage.value), 1);
    const nextBottleneck = stages.find((stage, index) => index > 0 && stage.value < stages[index - 1].value * 0.55);

    const contactSources = Object.values(totals.byPlatform)
      .sort((left, right) => right.conversions - left.conversions || right.clicks - left.clicks)
      .map((source) => {
        const estimatedContacts = source.conversions > 0 ? source.conversions : Math.max(1, Math.round(source.clicks * 0.06));
        const likelyWins = Math.max(0, Math.round(estimatedContacts * (assumptions.closeRate / 100)));
        return {
          ...source,
          estimatedContacts,
          likelyWins,
          estimatedValue: likelyWins * assumptions.averageDeal,
        };
      });

    return {
      totals,
      stages,
      topStageValue,
      capturedLeads,
      baseLeads,
      contacted,
      qualified,
      proposals,
      wins,
      pipelineValue,
      forecast,
      costPerLead,
      nextBottleneck,
      contactSources,
      recentCaptures: captures.slice(0, 6),
    };
  }, [campaigns, assumptions, captures]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Preparando funnel comercial...</p>
        </div>
      </div>
    );
  }

  if (!user?.entitlements?.capabilities.canUseAdvancedAnalytics) {
    return (
      <section className="rounded-[30px] border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Funnel comercial</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-900">Esta vista se desbloquea desde el plan Growth.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600">
          El funnel de oportunidades necesita una lectura más profunda de campañas, captación e interés real para estimar ventas probables.
        </p>
        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          {user?.entitlements?.capabilities.upgradeCta}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[34px] bg-[linear-gradient(135deg,#0f172a_0%,#111827_52%,#1d4ed8_100%)] px-8 py-9 text-white shadow-[0_30px_100px_rgba(15,23,42,0.18)]">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">Funnel comercial</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">Tus contactos, interesados y ventas probables en una sola lectura.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Este panel ya no mira solo campañas: también integra personas que dejaron su email en tus recursos para que el forecast se acerque más al negocio real.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">Forecast estimado</p>
            <p className="mt-3 text-5xl font-semibold">${funnel.forecast.toLocaleString()}</p>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Basado en {funnel.proposals} oportunidades con propuesta y una tasa de cierre configurada del {assumptions.closeRate}%.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Leads detectados</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{funnel.baseLeads}</p>
          <p className="mt-2 text-sm text-gray-500">Combinando campañas y captación real.</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Interesados captados</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{funnel.capturedLeads}</p>
          <p className="mt-2 text-sm text-gray-500">Leads reales desde master class y recursos.</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Ventas probables</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{funnel.wins}</p>
          <p className="mt-2 text-sm text-gray-500">Con el cierre actual de tu operación.</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Valor del pipeline</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">${funnel.pipelineValue.toLocaleString()}</p>
          <p className="mt-2 text-sm text-gray-500">Valor potencial de demos, propuestas y oportunidades.</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Costo por lead</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">${funnel.costPerLead.toFixed(0)}</p>
          <p className="mt-2 text-sm text-gray-500">Lectura rápida para saber cuánto cuesta abrir conversación.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Embudo estimado</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Dónde están tus oportunidades reales</h2>

          <div className="mt-6 space-y-4">
            {funnel.stages.map((stage, index) => {
              const previousValue = index === 0 ? stage.value : funnel.stages[index - 1].value || 1;
              const conversion = index === 0 ? 100 : Math.round((stage.value / previousValue) * 100);
              return (
                <div key={stage.id}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{stage.label}</p>
                      <p className="text-sm text-gray-500">Conversión desde la etapa anterior: {conversion}%</p>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900">{stage.value}</p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#fb923c_0%,#22d3ee_100%)]"
                      style={{ width: `${Math.max(8, (stage.value / funnel.topStageValue) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Supuestos del forecast</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Ajusta el modelo a tu negocio</h2>

          <div className="mt-6 space-y-4">
            {[
              { key: 'averageDeal', label: 'Ticket promedio', suffix: '$' },
              { key: 'responseRate', label: 'Respuesta a contactos', suffix: '%' },
              { key: 'qualificationRate', label: 'Calificación', suffix: '%' },
              { key: 'proposalRate', label: 'Paso a propuesta', suffix: '%' },
              { key: 'closeRate', label: 'Cierre', suffix: '%' },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">{field.label}</span>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={assumptions[field.key as keyof FunnelAssumptions]}
                    onChange={(event) =>
                      setAssumptions((current) => ({
                        ...current,
                        [field.key]: Number(event.target.value || 0),
                      }))
                    }
                    className="input-field pr-12"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    {field.suffix}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Interesados recientes</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Quién ya levantó la mano</h2>

          <div className="mt-6 space-y-4">
            {funnel.recentCaptures.length === 0 ? (
              <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                Aún no hay interesados captados para este funnel.
              </div>
            ) : (
              funnel.recentCaptures.map((capture) => (
                <div key={capture.id} className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{capture.email}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {capture.source} · {capture.resource}
                      </p>
                    </div>
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                      {capture.convertedToCrmAt ? 'Convertido' : 'Nuevo'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">{new Date(capture.createdAt).toLocaleString('es-ES')}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Próximo enfoque</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Qué mover para vender más rápido</h2>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm font-semibold text-gray-900">Cuello de botella principal</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {funnel.nextBottleneck
                  ? `La caída más fuerte aparece en "${funnel.nextBottleneck.label}". Ahí conviene mejorar seguimiento, velocidad de respuesta o claridad de oferta.`
                  : 'Tu embudo está relativamente sano. El siguiente salto vendrá de aumentar el volumen de leads de calidad.'}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm font-semibold text-gray-900">Acción recomendada esta semana</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Prioriza a quienes ya dejaron su email, pásalos al CRM, crea una secuencia corta de seguimiento y ofrece una llamada o propuesta con una sola promesa fuerte.
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm font-semibold text-gray-900">Cómo aprovechar mejor tus contactos</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Usa este funnel como forecast comercial: mezcla interesados captados, oportunidades calificadas y valor probable de cierre para vender con más criterio.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

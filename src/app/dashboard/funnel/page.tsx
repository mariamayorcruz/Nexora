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
  name?: string | null;
  source: string;
  resource: string;
  createdAt: string;
  convertedToCrmAt?: string | null;
  crmLeadId?: string | null;
}

interface CrmLead {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
  source: string;
  stage: string;
  value: number;
  confidence: number;
  nextAction?: string | null;
  updatedAt: string;
}

interface LeadDraft {
  stage: string;
  value: string;
  confidence: string;
  nextAction: string;
}

const STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'contacted', label: 'Contactado' },
  { key: 'qualified', label: 'Calificado' },
  { key: 'proposal', label: 'Propuesta' },
  { key: 'won', label: 'Cerrado' },
] as const;

export default function FunnelPage() {
  const [campaigns, setCampaigns] = useState<FunnelCampaign[]>([]);
  const [captures, setCaptures] = useState<LeadCapture[]>([]);
  const [crmLeads, setCrmLeads] = useState<CrmLead[]>([]);
  const [drafts, setDrafts] = useState<Record<string, LeadDraft>>({});
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [user, setUser] = useState<FunnelUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

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
      setDrafts(
        Object.fromEntries(
          (crmData.leads || []).map((lead: CrmLead) => [
            lead.id,
            {
              stage: lead.stage,
              value: String(lead.value || 0),
              confidence: String(lead.confidence || 0),
              nextAction: lead.nextAction || '',
            },
          ])
        )
      );
    } catch (error) {
      console.error('Error fetching funnel data:', error);
      setMessage('No pudimos cargar el funnel completo en este momento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const funnel = useMemo(() => {
    const campaignTotals = campaigns.reduce(
      (accumulator, campaign) => {
        accumulator.impressions += campaign.analytics?.impressions || 0;
        accumulator.clicks += campaign.analytics?.clicks || 0;
        accumulator.conversions += campaign.analytics?.conversions || 0;
        accumulator.spend += campaign.analytics?.spend || 0;
        return accumulator;
      },
      {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
      }
    );

    const counts = {
      lead: crmLeads.filter((lead) => lead.stage === 'lead').length,
      contacted: crmLeads.filter((lead) => lead.stage === 'contacted').length,
      qualified: crmLeads.filter((lead) => lead.stage === 'qualified').length,
      proposal: crmLeads.filter((lead) => lead.stage === 'proposal').length,
      won: crmLeads.filter((lead) => lead.stage === 'won').length,
    };

    const capturedLeads = captures.length;
    const leadsInSystem = Math.max(
      capturedLeads,
      crmLeads.length,
      campaignTotals.conversions > 0 ? campaignTotals.conversions : Math.round(campaignTotals.clicks * 0.08)
    );

    const contacted = counts.contacted + counts.qualified + counts.proposal + counts.won;
    const qualified = counts.qualified + counts.proposal + counts.won;
    const proposals = counts.proposal + counts.won;
    const wins = counts.won;
    const averageDeal =
      crmLeads.filter((lead) => lead.value > 0).reduce((sum, lead) => sum + lead.value, 0) /
        Math.max(1, crmLeads.filter((lead) => lead.value > 0).length) || 1200;
    const pipelineValue = crmLeads.filter((lead) => lead.stage !== 'won').reduce((sum, lead) => sum + lead.value, 0);
    const forecast = crmLeads.reduce((sum, lead) => sum + lead.value * (lead.confidence / 100), 0);
    const costPerLead = leadsInSystem > 0 ? campaignTotals.spend / leadsInSystem : 0;

    const stages = [
      { id: 'leads', label: 'Leads en sistema', value: leadsInSystem },
      { id: 'contacted', label: 'Contactados', value: contacted },
      { id: 'qualified', label: 'Calificados', value: qualified },
      { id: 'proposals', label: 'Propuestas activas', value: proposals },
      { id: 'wins', label: 'Cierres', value: wins },
    ];

    return {
      campaignTotals,
      leadsInSystem,
      capturedLeads,
      contacted,
      qualified,
      proposals,
      wins,
      averageDeal,
      pipelineValue,
      forecast,
      costPerLead,
      stages,
      topStageValue: Math.max(...stages.map((stage) => stage.value), 1),
      recentCaptures: captures.slice(0, 6),
      activeOpportunities: crmLeads
        .filter((lead) => lead.stage !== 'won')
        .sort((left, right) => right.value - left.value || right.confidence - left.confidence)
        .slice(0, 8),
    };
  }, [campaigns, captures, crmLeads]);

  const saveLead = async (leadId: string) => {
    try {
      setSavingLeadId(leadId);
      const token = localStorage.getItem('token');
      const draft = drafts[leadId];
      const response = await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage: draft.stage,
          value: Number(draft.value || 0),
          confidence: Number(draft.confidence || 0),
          nextAction: draft.nextAction,
          lastContactedAt: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo actualizar la etapa.');
      }

      setMessage('Lead actualizado correctamente.');
      await fetchData();
    } catch (error) {
      console.error('Error updating lead:', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el lead.');
    } finally {
      setSavingLeadId(null);
    }
  };

  const promoteCapture = async (captureId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/business/leads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ captureId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo pasar el lead al CRM.');
      }

      setMessage('Lead captado pasado al CRM correctamente.');
      await fetchData();
    } catch (error) {
      console.error('Error promoting capture:', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo pasar el lead al CRM.');
    }
  };

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
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              Ahora sí: interesados reales, oportunidades activas y etapas que puedes mover.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Esta vista combina captación, CRM y pipeline. Ya no es solo forecast: aquí puedes ver quién se interesó, quién está en CRM y en qué etapa está cada oportunidad.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">Forecast real del pipeline</p>
            <p className="mt-3 text-5xl font-semibold">${Math.round(funnel.forecast).toLocaleString()}</p>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Basado en {crmLeads.length} leads del CRM, confianza individual y valor estimado por oportunidad.
            </p>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div>
      )}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Leads en sistema</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{funnel.leadsInSystem}</p>
          <p className="mt-2 text-sm text-gray-500">Campañas, captación y CRM combinados.</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Interesados captados</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{funnel.capturedLeads}</p>
          <p className="mt-2 text-sm text-gray-500">Personas que dejaron sus datos.</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Propuestas activas</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{funnel.proposals}</p>
          <p className="mt-2 text-sm text-gray-500">Oportunidades en tramo de cierre.</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Valor del pipeline</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">${Math.round(funnel.pipelineValue).toLocaleString()}</p>
          <p className="mt-2 text-sm text-gray-500">Sin contar cierres ya ganados.</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Costo por lead</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">${funnel.costPerLead.toFixed(0)}</p>
          <p className="mt-2 text-sm text-gray-500">Lectura rápida de adquisición.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Embudo operativo</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Dónde está hoy cada tramo del negocio</h2>

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
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Interesados recientes</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Personas que ya levantaron la mano</h2>

          <div className="mt-6 space-y-4">
            {funnel.recentCaptures.length === 0 ? (
              <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                Aún no hay interesados captados para este funnel.
              </div>
            ) : (
              funnel.recentCaptures.map((capture) => (
                <article key={capture.id} className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{capture.name || capture.email}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {capture.email} · {capture.source} · {capture.resource}
                      </p>
                    </div>
                    {capture.convertedToCrmAt ? (
                      <div className="text-right">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          En CRM
                        </span>
                        <p className="mt-2 text-xs text-gray-500">
                          {capture.crmLeadId ? 'Ya tiene lead vinculado' : 'Convertido'}
                        </p>
                      </div>
                    ) : (
                      <button onClick={() => promoteCapture(capture.id)} className="btn-secondary px-4 py-2 text-xs">
                        Pasar a CRM
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-gray-600">{new Date(capture.createdAt).toLocaleString('es-ES')}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Pipeline manipulable</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900">Cambia etapas y sigue tus oportunidades reales</h2>

        <div className="mt-6 space-y-4">
          {funnel.activeOpportunities.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
              Aún no hay oportunidades activas en CRM. Pasa tus interesados al CRM o agrega contactos manualmente para empezar a moverlos por etapa.
            </div>
          ) : (
            funnel.activeOpportunities.map((lead) => (
              <article key={lead.id} className="rounded-2xl border border-gray-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{lead.name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {lead.email || 'Sin email'} · {lead.company || 'Sin empresa'} · {lead.source}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">${lead.value.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Confianza {lead.confidence}%</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="block rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Siguiente accion</span>
                      <input
                        value={drafts[lead.id]?.nextAction || ''}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [lead.id]: { ...current[lead.id], nextAction: event.target.value },
                          }))
                        }
                        className="input-field"
                        placeholder="Escribe el siguiente paso"
                      />
                    </label>
                    <label className="block rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Valor</span>
                      <input
                        type="number"
                        value={drafts[lead.id]?.value || '0'}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [lead.id]: { ...current[lead.id], value: event.target.value },
                          }))
                        }
                        className="input-field"
                        placeholder="0"
                      />
                    </label>
                    <label className="block rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Confianza</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={drafts[lead.id]?.confidence || '0'}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [lead.id]: { ...current[lead.id], confidence: event.target.value },
                          }))
                        }
                        className="input-field"
                        placeholder="0"
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Etapa</span>
                      <select
                        value={drafts[lead.id]?.stage || lead.stage}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [lead.id]: { ...current[lead.id], stage: event.target.value },
                          }))
                        }
                        className="input-field min-w-[220px]"
                      >
                        {STAGES.map((stage) => (
                          <option key={stage.key} value={stage.key}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => void saveLead(lead.id)}
                      disabled={savingLeadId === lead.id}
                      className="btn-primary px-4 py-3 text-sm"
                    >
                      {savingLeadId === lead.id ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

'use client';

import { ChevronRight, MessageCircle, Phone, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import FocusPanel, { type FocusLead } from '@/components/FocusPanel';
import { useAppLanguage } from '@/hooks/use-app-language';

type ViewMode = 'kanban' | 'list';
type FilterMode = 'all' | 'hot' | 'whatsapp' | 'sms' | 'won';
type UiStage = 'new' | 'contacted' | 'proposal' | 'negotiation' | 'won';

type LeadRow = FocusLead;

const UI_STAGES: Array<{ key: UiStage; es: string; en: string; dot: string }> = [
  { key: 'new', es: 'Nuevo', en: 'New', dot: 'bg-cyan-400' },
  { key: 'contacted', es: 'Contactado', en: 'Contacted', dot: 'bg-amber-400' },
  { key: 'proposal', es: 'Propuesta', en: 'Proposal', dot: 'bg-violet-400' },
  { key: 'negotiation', es: 'Negociación', en: 'Negotiation', dot: 'bg-orange-400' },
  { key: 'won', es: 'Ganado', en: 'Won', dot: 'bg-emerald-400' },
];

const CRM_TO_UI: Record<string, UiStage> = {
  lead: 'new',
  contacted: 'contacted',
  qualified: 'proposal',
  proposal: 'negotiation',
  won: 'won',
};

const UI_TO_CRM: Record<UiStage, string> = {
  new: 'lead',
  contacted: 'contacted',
  proposal: 'qualified',
  negotiation: 'proposal',
  won: 'won',
};

function detectChannel(lead: LeadRow) {
  if (lead.phone && !lead.email) return 'sms';
  if (lead.phone) return 'whatsapp';
  return 'email';
}

function leadPriority(lead: LeadRow) {
  if (lead.confidence >= 75 || lead.value >= 3000) return 'hot';
  if (lead.confidence >= 45) return 'warm';
  return 'cold';
}

function timeSince(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.floor(diff / 3600000));
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function DashboardCrmPage() {
  const { language } = useAppLanguage();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);

  const fetchLeads = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch('/api/crm/leads', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await response.json();
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLeads();
  }, []);

  useEffect(() => {
    if (!selectedLeadId && leads.length) {
      setSelectedLeadId(leads[0].id);
    }
  }, [leads, selectedLeadId]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesText =
        !text ||
        lead.name.toLowerCase().includes(text) ||
        String(lead.company || '').toLowerCase().includes(text) ||
        String(lead.email || '').toLowerCase().includes(text);
      const channel = detectChannel(lead);
      const matchesFilter =
        filterMode === 'all' ||
        (filterMode === 'hot' && leadPriority(lead) === 'hot') ||
        (filterMode === 'whatsapp' && channel === 'whatsapp') ||
        (filterMode === 'sms' && channel === 'sms') ||
        (filterMode === 'won' && lead.stage === 'won');
      return matchesText && matchesFilter;
    });
  }, [filterMode, leads, query]);

  const selectedLead = filtered.find((lead) => lead.id === selectedLeadId) || leads.find((lead) => lead.id === selectedLeadId) || null;

  const metrics = useMemo(() => {
    const pipelineTotal = filtered.filter((lead) => lead.stage !== 'won').reduce((sum, lead) => sum + Number(lead.value || 0), 0);
    const won = filtered.filter((lead) => lead.stage === 'won');
    const closeRate = filtered.length ? Math.round((won.length / filtered.length) * 100) : 0;
    const revenue = won.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
    const avgCloseHours = filtered.length
      ? Math.round(
          filtered.reduce((sum, lead) => sum + (Date.now() - new Date(lead.updatedAt).getTime()) / 3600000, 0) /
            filtered.length
        )
      : 0;
    const leadsThisMonth = filtered.filter((lead) => new Date(lead.updatedAt).getMonth() === new Date().getMonth()).length;
    return { pipelineTotal, closeRate, revenue, avgCloseHours, leadsThisMonth };
  }, [filtered]);

  const grouped = useMemo(() => {
    const base: Record<UiStage, LeadRow[]> = {
      new: [],
      contacted: [],
      proposal: [],
      negotiation: [],
      won: [],
    };
    filtered.forEach((lead) => {
      base[CRM_TO_UI[lead.stage] || 'new'].push(lead);
    });
    return base;
  }, [filtered]);

  const moveLead = async (lead: LeadRow, target: UiStage) => {
    setBusyLeadId(lead.id);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage: UI_TO_CRM[target],
          lastContactedAt: new Date().toISOString(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo mover el lead.');
      await fetchLeads();
      setMessage(language === 'en' ? 'Lead updated.' : 'Lead actualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error');
    } finally {
      setBusyLeadId(null);
    }
  };

  const handleSend = async (lead: FocusLead, channel: 'whatsapp' | 'sms' | 'email' | 'nota', text: string) => {
    if (channel === 'nota') {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: text }),
      });
      if (response.ok) {
        await fetchLeads();
        setMessage(language === 'en' ? 'Note saved.' : 'Nota guardada.');
        return;
      }
    }
    setMessage(
      language === 'en'
        ? `Ready to send via ${channel.toUpperCase()}.`
        : `Listo para enviar por ${channel.toUpperCase()}.`
    );
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_296px]">
      <div className="space-y-5">
        <section className="rounded-[28px] bg-[#040810] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">✦ CRM & Leads</p>
              <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px] xl:text-[34px]">
                {language === 'en' ? 'Revenue pipeline in one place' : 'Pipeline comercial en una sola vista'}
              </h1>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
              <div>
                <p className="text-slate-500">{language === 'en' ? 'Pipeline total' : 'Pipeline total'}</p>
                <p className="mt-1 text-white">${metrics.pipelineTotal.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500">Close rate</p>
                <p className="mt-1 text-white">{metrics.closeRate}%</p>
              </div>
              <div>
                <p className="text-slate-500">Revenue</p>
                <p className="mt-1 text-white">${metrics.revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500">{language === 'en' ? 'Avg. closing time' : 'Tiempo prom. cierre'}</p>
                <p className="mt-1 text-white">{metrics.avgCloseHours}h</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-[#040810] px-2 py-2">
          <div className="grid gap-2 md:grid-cols-5">
            {[
              { label: 'Pipeline total', value: `$${metrics.pipelineTotal.toLocaleString()}` },
              { label: 'Close rate', value: `${metrics.closeRate}%` },
              { label: language === 'en' ? 'Avg. time' : 'Tiempo cierre prom.', value: `${metrics.avgCloseHours}h` },
              { label: language === 'en' ? 'Leads this month' : 'Leads este mes', value: metrics.leadsThisMonth },
              { label: language === 'en' ? 'Closed revenue' : 'Revenue cerrado', value: `$${metrics.revenue.toLocaleString()}` },
            ].map((item, index) => (
              <div key={item.label} className={`px-4 py-4 ${index < 4 ? 'md:border-r md:border-white/[0.05]' : ''}`}>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {message ? <div className="rounded-2xl bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">{message}</div> : null}

        <section className="rounded-[28px] bg-[#040810] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full bg-[#030610] p-1">
              {(['kanban', 'list'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-full px-3 py-1.5 text-xs transition-all duration-150 ${
                    viewMode === mode ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {mode === 'kanban' ? 'Kanban' : 'Lista'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="rounded-full bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition-all duration-150 hover:bg-white/[0.05] hover:text-white"
            >
              + {language === 'en' ? 'Edit stages' : 'Editar etapas'}
            </button>
          </div>

          {viewMode === 'list' ? (
            <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={language === 'en' ? 'Search lead or company...' : 'Buscar lead o empresa...'}
                    className="w-full rounded-2xl bg-[#030610] py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-full bg-[#030610] p-1">
                  {([
                    ['all', 'Todos'],
                    ['hot', 'Hot'],
                    ['whatsapp', 'WhatsApp'],
                    ['sms', 'SMS'],
                    ['won', 'Ganados'],
                  ] as Array<[FilterMode, string]>).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilterMode(key)}
                      className={`rounded-full px-3 py-1.5 text-xs transition-all duration-150 ${
                        filterMode === key ? 'bg-white/[0.05] text-white' : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-[22px] bg-[#030610]">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-[72px_minmax(220px,1.9fr)_1fr_0.8fr_0.8fr_0.7fr_40px] gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    <span>Avatar</span>
                    <span>Lead + detalle</span>
                    <span>Estado</span>
                    <span>Fuente</span>
                    <span>Valor</span>
                    <span>Tiempo</span>
                    <span />
                  </div>
                  <div className="divide-y divide-white/[0.05]">
                    {filtered.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`grid w-full grid-cols-[72px_minmax(220px,1.9fr)_1fr_0.8fr_0.8fr_0.7fr_40px] gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-white/[0.02] ${
                          selectedLeadId === lead.id ? 'border-l-2 border-cyan-400 bg-[rgba(6,182,212,0.03)]' : ''
                        }`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-semibold text-cyan-300">
                          {lead.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">{lead.name}</p>
                          <p className="truncate text-xs text-slate-500">{lead.company || lead.email || lead.phone || lead.source}</p>
                        </div>
                        <div className="flex items-center">
                          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-cyan-300">
                            {(language === 'en'
                              ? UI_STAGES.find((item) => item.key === (CRM_TO_UI[lead.stage] || 'new'))?.en
                              : UI_STAGES.find((item) => item.key === (CRM_TO_UI[lead.stage] || 'new'))?.es) || lead.stage}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{detectChannel(lead).toUpperCase()}</p>
                        <p className="text-sm text-white">${lead.value.toLocaleString()}</p>
                        <p className="text-sm text-slate-500">{timeSince(lead.updatedAt)}</p>
                        <ChevronRight className="h-4 w-4 self-center text-slate-600" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[1080px] gap-3 xl:min-w-0 xl:grid-cols-5">
              {UI_STAGES.map((stage) => (
                <div key={stage.key} className="rounded-[24px] bg-[#030610] p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${stage.dot}`} />
                    <p className="text-sm font-medium text-white">{language === 'en' ? stage.en : stage.es}</p>
                    <span className="ml-auto rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-400">
                      {grouped[stage.key].length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grouped[stage.key].map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`w-full rounded-[20px] bg-white/[0.03] p-3 text-left transition-all duration-150 hover:-translate-y-[1px] hover:bg-white/[0.045] ${
                          selectedLeadId === lead.id ? 'border border-cyan-400/25' : 'border border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{lead.name}</p>
                            <p className="truncate text-xs text-slate-500">{lead.company || lead.source}</p>
                          </div>
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${leadPriority(lead) === 'hot' ? 'bg-rose-400' : leadPriority(lead) === 'warm' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300">{detectChannel(lead).toUpperCase()}</span>
                          <span className="text-[11px] text-slate-500">{lead.confidence}%</span>
                          <span className="ml-auto text-xs text-white">${lead.value.toLocaleString()}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {UI_STAGES.filter((item) => item.key !== stage.key)
                            .slice(0, 2)
                            .map((item) => (
                              <button
                                key={item.key}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void moveLead(lead, item.key);
                                }}
                                disabled={busyLeadId === lead.id}
                                className="rounded-full bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                              >
                                {language === 'en' ? item.en : item.es}
                              </button>
                            ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <FocusPanel
        lead={selectedLead}
        messageLabel={
          selectedLead
            ? language === 'en'
              ? `Suggested move: confirm next step with ${selectedLead.name} today.`
              : `Sugerencia IA: confirma el siguiente paso con ${selectedLead.name} hoy.`
            : undefined
        }
        onSend={handleSend}
      />
    </div>
  );
}

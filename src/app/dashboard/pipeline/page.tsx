'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, LayoutGrid, List, Mail, MoreHorizontal, Phone, Plus, Search, Sparkles, TrendingUp, Users, X } from 'lucide-react';
import { getPlaybook } from '@/lib/sales-playbook';

type StageId = 'new' | 'contacted' | 'qualified' | 'proposal' | 'closed';

type SourceId = 'masterclass' | 'ads' | 'referral' | 'web' | 'manual';
type LeadPriority = 'hot' | 'warm' | 'cold';
type QueueFilter = 'all' | 'priority' | 'overdue' | 'today';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  value: number;
  stage: StageId;
  source: SourceId;
  assignedTo: string;
  lastActivity: string;
  nextAction?: string | null;
  tags: string[];
}

interface AgendaItem {
  id: string;
  name: string;
  stage: StageId;
  nextAction: string;
  hoursSince: number;
  probability: number;
}

interface CrmLeadResponse {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: string;
  stage: string;
  value: number;
  nextAction?: string | null;
  updatedAt: string;
}

const STAGES: Array<{ id: StageId; label: string; chipClass: string; icon: string }> = [
  { id: 'new', label: 'Nuevos Entrantes', chipClass: 'bg-slate-700', icon: '●' },
  { id: 'contacted', label: 'Contactados', chipClass: 'bg-blue-600', icon: '📞' },
  { id: 'qualified', label: 'Calificados', chipClass: 'bg-cyan-600', icon: '✓' },
  { id: 'proposal', label: 'Propuesta', chipClass: 'bg-amber-600', icon: '📝' },
  { id: 'closed', label: 'Cerrados', chipClass: 'bg-emerald-600', icon: '✅' },
];

const STAGE_TO_CRM: Record<StageId, string> = {
  new: 'lead',
  contacted: 'contacted',
  qualified: 'qualified',
  proposal: 'proposal',
  closed: 'won',
};

const CRM_TO_STAGE: Record<string, StageId> = {
  lead: 'new',
  contacted: 'contacted',
  qualified: 'qualified',
  proposal: 'proposal',
  won: 'closed',
};

function normalizeSource(source: string): SourceId {
  const value = String(source || '').toLowerCase();
  if (value.includes('masterclass')) return 'masterclass';
  if (value.includes('ad')) return 'ads';
  if (value.includes('ref')) return 'referral';
  if (value.includes('web')) return 'web';
  return 'manual';
}

function buildTags(source: SourceId, company?: string | null) {
  const tags: string[] = [source];
  if (company) {
    tags.push('empresa');
  }
  if (source === 'masterclass' || source === 'referral') {
    tags.push('oportunidad');
  }
  return tags;
}

function mapLead(item: CrmLeadResponse): Lead {
  const stage = CRM_TO_STAGE[item.stage] || 'new';
  return {
    id: item.id,
    name: item.name,
    email: item.email || 'sin-email@nexora.app',
    phone: item.phone,
    company: item.company,
    value: Number(item.value || 0),
    stage,
    source: normalizeSource(item.source),
    assignedTo: 'Sin asignar',
    lastActivity: item.updatedAt,
    nextAction: item.nextAction,
    tags: buildTags(normalizeSource(item.source), item.company),
  };
}

function getStagePlaybook(stage: StageId): string[] {
  const crmStage = STAGE_TO_CRM[stage];
  return getPlaybook(crmStage).checklist;
}

function getHoursSince(lastActivity: string) {
  const delta = Date.now() - new Date(lastActivity).getTime();
  return Math.max(0, Math.floor(delta / (1000 * 60 * 60)));
}

function getLeadPriority(lead: Lead): LeadPriority {
  const hours = getHoursSince(lead.lastActivity);
  if (lead.value >= 3000 || (lead.stage === 'proposal' && hours < 48)) return 'hot';
  if (lead.value >= 800 || hours < 96) return 'warm';
  return 'cold';
}

function getSlaHours(lead: Lead) {
  if (lead.stage === 'proposal') return 24;
  if (lead.stage === 'qualified') return 36;
  return 48;
}

function getCloseProbability(lead: Lead) {
  const stageWeight: Record<StageId, number> = {
    new: 16,
    contacted: 30,
    qualified: 52,
    proposal: 74,
    closed: 95,
  };

  const priority = getLeadPriority(lead);
  const priorityBonus = priority === 'hot' ? 14 : priority === 'warm' ? 7 : 0;
  const valueBonus = lead.value >= 3000 ? 6 : lead.value >= 1000 ? 3 : 0;
  const stalePenalty = Math.min(18, Math.floor(getHoursSince(lead.lastActivity) / 24) * 2);

  const score = stageWeight[lead.stage] + priorityBonus + valueBonus - stalePenalty;
  return Math.max(5, Math.min(99, score));
}

export default function PipelineUnifiedPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [pipelineStats, setPipelineStats] = useState<{ totalPipelineValue: number; wonValue: number } | null>(null);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(true);
  const [modalSaveTriggered, setModalSaveTriggered] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const [leadsResponse, statsResponse] = await Promise.all([
        fetch('/api/crm/leads', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
        fetch('/api/crm/stats', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
      ]);

      const data = (await leadsResponse.json()) as { leads?: CrmLeadResponse[]; error?: string };
      if (!leadsResponse.ok) {
        throw new Error(data.error || 'No se pudieron cargar los leads.');
      }

      const mapped = (data.leads || []).map(mapLead);
      setLeads(mapped);

      if (statsResponse.ok) {
        const stats = await statsResponse.json() as { totalPipelineValue: number; wonValue: number };
        setPipelineStats(stats);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLeads();
  }, []);

  // Auto-close modal when a save triggered from modal completes successfully
  useEffect(() => {
    if (modalSaveTriggered && !saving) {
      setModalSaveTriggered(false);
      if (!message && showNewLeadModal) {
        setShowNewLeadModal(false);
      }
    }
  }, [saving, message, showNewLeadModal, modalSaveTriggered]);

  const searchedLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return leads;
    }

    return leads.filter((lead) => {
      return (
        lead.name.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query) ||
        lead.source.toLowerCase().includes(query) ||
        (lead.company || '').toLowerCase().includes(query)
      );
    });
  }, [leads, searchQuery]);

  const filteredLeads = useMemo(() => {
    if (queueFilter === 'all') return searchedLeads;

    return searchedLeads.filter((lead) => {
      const priority = getLeadPriority(lead);
      const hours = getHoursSince(lead.lastActivity);
      const sla = getSlaHours(lead);
      if (queueFilter === 'priority') return priority === 'hot';
      if (queueFilter === 'overdue') return hours > sla;
      if (queueFilter === 'today') return hours <= 24;
      return true;
    });
  }, [queueFilter, searchedLeads]);

  const queueStats = useMemo(() => {
    const overdue = searchedLeads.filter((lead) => getHoursSince(lead.lastActivity) > getSlaHours(lead)).length;
    const hot = searchedLeads.filter((lead) => getLeadPriority(lead) === 'hot').length;
    const today = searchedLeads.filter((lead) => getHoursSince(lead.lastActivity) <= 24).length;

    return { overdue, hot, today };
  }, [searchedLeads]);

  const todayAgenda = useMemo<AgendaItem[]>(() => {
    const sorted = [...searchedLeads].sort((a, b) => {
      const overdueDelta = (getHoursSince(b.lastActivity) - getSlaHours(b)) - (getHoursSince(a.lastActivity) - getSlaHours(a));
      if (overdueDelta !== 0) return overdueDelta;
      return getCloseProbability(b) - getCloseProbability(a);
    });

    return sorted.slice(0, 6).map((lead) => {
      const stageChecklist = getStagePlaybook(lead.stage);
      return {
        id: lead.id,
        name: lead.name,
        stage: lead.stage,
        nextAction: lead.nextAction || stageChecklist[0] || 'Contactar y registrar siguiente paso.',
        hoursSince: getHoursSince(lead.lastActivity),
        probability: getCloseProbability(lead),
      };
    });
  }, [searchedLeads]);

  const moveLead = async (leadId: string, newStage: StageId) => {
    const current = leads.find((lead) => lead.id === leadId);
    if (!current || current.stage === newStage) {
      return;
    }

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, stage: newStage, lastActivity: new Date().toISOString() } : lead
      )
    );

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage: STAGE_TO_CRM[newStage],
          lastContactedAt: new Date().toISOString(),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo mover el lead de etapa.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo mover el lead.');
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? current : lead)));
    }
  };

  const createLead = async () => {
    const name = newLeadName.trim();
    if (!name) {
      setMessage('Escribe al menos el nombre del lead.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email: newLeadEmail.trim(),
          stage: 'lead',
          source: 'manual',
          value: 0,
          confidence: 25,
        }),
      });

      const data = (await response.json()) as { lead?: CrmLeadResponse; error?: string };
      if (!response.ok || !data.lead) {
        throw new Error(data.error || 'No se pudo crear el lead.');
      }

      setLeads((prev) => [mapLead(data.lead as CrmLeadResponse), ...prev]);
      setNewLeadName('');
      setNewLeadEmail('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear el lead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="-m-6 flex h-[calc(100vh-5.8rem)] bg-slate-950 text-slate-200">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── Header ─────────────────────────────────── */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-5">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-white">Pipeline</h1>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-44 rounded-lg border border-slate-800 bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-600 focus:border-cyan-600 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'kanban' ? 'list' : 'kanban')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-600 hover:text-white"
            >
              {viewMode === 'kanban' ? <List size={13} /> : <LayoutGrid size={13} />}
              {viewMode === 'kanban' ? 'Lista' : 'Kanban'}
            </button>
            <button
              onClick={() => setShowNewLeadModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
            >
              <Plus size={13} />
              Lead
            </button>
          </div>
        </header>

        {/* ── Metrics + Filters ──────────────────────── */}
        <section className="shrink-0 border-b border-slate-800 bg-slate-950 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5">
              <TrendingUp size={16} className="shrink-0 text-emerald-400" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Pipeline</p>
                <p className="text-lg font-bold leading-tight text-white">
                  ${(pipelineStats?.totalPipelineValue ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5">
              <Users size={16} className="shrink-0 text-blue-400" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Activos</p>
                <p className="text-lg font-bold leading-tight text-white">
                  {leads.filter((l) => l.stage !== 'closed').length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5">
              <Flame size={16} className="shrink-0 text-rose-400" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Prioridad alta</p>
                <p className="text-lg font-bold leading-tight text-white">{queueStats.hot}</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
              {(
                [
                  { id: 'all', label: 'Todo', count: undefined },
                  { id: 'priority', label: '🔥 Hot', count: queueStats.hot },
                  { id: 'overdue', label: '⚠ Vencido', count: queueStats.overdue },
                  { id: 'today', label: 'Hoy', count: queueStats.today },
                ] as Array<{ id: QueueFilter; label: string; count: number | undefined }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setQueueFilter(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    queueFilter === tab.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 ? (
                    <span className="rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] leading-none text-slate-200">
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Board + Agenda sidebar ─────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
              <div className="flex h-full min-w-max gap-3 p-5">
                {STAGES.map((stage) => (
                  <PipelineColumn
                    key={stage.id}
                    stage={stage}
                    leads={filteredLeads.filter((lead) => lead.stage === stage.id)}
                    onDropLead={moveLead}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-2">
                {filteredLeads.map((lead) => {
                  const priority = getLeadPriority(lead);
                  const probability = getCloseProbability(lead);
                  const priorityColor =
                    priority === 'hot'
                      ? 'text-rose-400'
                      : priority === 'warm'
                      ? 'text-amber-400'
                      : 'text-slate-500';

                  return (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 hover:border-slate-700"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{lead.name}</p>
                        {lead.nextAction ? (
                          <p className="mt-0.5 truncate text-xs text-slate-500">{lead.nextAction}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className={`text-xs font-medium ${priorityColor}`}>{priority}</span>
                        <span className="text-xs text-slate-500">{probability}%</span>
                        <span className="font-mono text-xs text-emerald-400">${lead.value.toLocaleString()}</span>
                        <select
                          value={lead.stage}
                          onChange={(event) => void moveLead(lead.id, event.target.value as StageId)}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          {STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
                {filteredLeads.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No hay leads que coincidan con el filtro.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {/* Agenda sidebar */}
          <div
            className={`relative shrink-0 border-l border-slate-800 bg-slate-900/30 transition-all duration-200 ${
              agendaOpen ? 'w-60' : 'w-10'
            }`}
          >
            <button
              onClick={() => setAgendaOpen((open) => !open)}
              className="absolute -left-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-500 hover:text-white"
              title={agendaOpen ? 'Cerrar agenda' : 'Ver agenda'}
            >
              {agendaOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
            {agendaOpen ? (
              <div className="flex h-full flex-col overflow-y-auto p-3 pt-4">
                <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">Agenda hoy</p>
                <div className="space-y-2">
                  {todayAgenda.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                      <p className="truncate text-xs font-semibold text-white">{item.name}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{item.stage}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                        {item.nextAction}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-slate-600">Hace {item.hoursSince}h</span>
                        <span className="text-[10px] font-semibold text-cyan-400">{item.probability}%</span>
                      </div>
                    </div>
                  ))}
                  {todayAgenda.length === 0 ? (
                    <p className="text-xs text-slate-600">Sin leads en agenda.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── New lead modal ──────────────────────────── */}
      {showNewLeadModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Nuevo lead</h2>
              <button
                onClick={() => {
                  setShowNewLeadModal(false);
                  setMessage('');
                }}
                className="rounded-lg p-1 text-slate-500 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={newLeadName}
                onChange={(event) => setNewLeadName(event.target.value)}
                placeholder="Nombre del lead"
                autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              <input
                value={newLeadEmail}
                onChange={(event) => setNewLeadEmail(event.target.value)}
                placeholder="Email (opcional)"
                type="email"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            {message ? <p className="mt-3 text-xs text-amber-300">{message}</p> : null}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setModalSaveTriggered(true);
                  void createLead();
                }}
                disabled={saving}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Crear lead'}
              </button>
              <button
                onClick={() => {
                  setShowNewLeadModal(false);
                  setMessage('');
                }}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PipelineColumn({
  stage,
  leads,
  onDropLead,
}: {
  stage: { id: StageId; label: string; chipClass: string; icon: string };
  leads: Lead[];
  onDropLead: (leadId: string, newStage: StageId) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const stagePlaybook = getStagePlaybook(stage.id);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const leadId = event.dataTransfer.getData('text/plain');
        if (leadId) {
          void onDropLead(leadId, stage.id);
        }
      }}
      className={`flex w-[340px] flex-col rounded-2xl border transition-colors ${
        isOver ? 'border-cyan-500/50 bg-slate-800/60' : 'border-slate-800 bg-slate-900/20'
      }`}
    >
      <div className="relative rounded-t-2xl border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-base">{stage.icon}</span>
            <h3 className="text-sm font-medium text-white">{stage.label}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs text-white ${stage.chipClass}`}>{leads.length}</span>
          </div>
          <button
            onClick={() => setShowPlaybook((current) => !current)}
            className="rounded-lg p-1 text-slate-600 hover:bg-slate-800 hover:text-slate-300"
            aria-label={`Acciones clave ${stage.label}`}
          >
            <MoreHorizontal size={15} />
          </button>
        </div>

        {showPlaybook ? (
          <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-800 p-3 shadow-xl">
            <p className="mb-2 text-xs font-semibold text-white">Acciones en {stage.label}</p>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {stagePlaybook.map((action) => (
                <li key={action} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-cyan-500">›</span>
                  {action}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-slate-800 text-xs text-slate-700">
            Arrastra aquí
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const [isDragging, setIsDragging] = useState(false);
  const priority = getLeadPriority(lead);
  const hours = getHoursSince(lead.lastActivity);
  const sla = getSlaHours(lead);
  const isOverdue = hours > sla;
  const probability = getCloseProbability(lead);

  const priorityStyles =
    priority === 'hot'
      ? 'border-rose-400/30 bg-rose-500/10 text-rose-300'
      : priority === 'warm'
      ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
      : 'border-slate-700 bg-slate-800/60 text-slate-400';

  const whatsappHref = lead.phone
    ? `https://wa.me/${lead.phone.replace(/[^\d]/g, '')}`
    : null;

  return (
    <div
      draggable
      onDragStart={(event) => {
        setIsDragging(true);
        event.dataTransfer.setData('text/plain', lead.id);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`group cursor-move rounded-xl border border-slate-700/60 bg-slate-800 p-3.5 transition-all hover:border-slate-600 ${
        isDragging ? 'rotate-1 opacity-50 shadow-lg' : ''
      }`}
    >
      {/* Name + Value */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-white transition-colors group-hover:text-cyan-300">
          {lead.name}
        </p>
        <span className={`shrink-0 font-mono text-xs ${lead.value > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
          ${lead.value.toLocaleString()}
        </span>
      </div>

      {/* Priority + Probability + SLA */}
      <div className="mt-2 flex items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${priorityStyles}`}>
          {priority}
        </span>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
          {probability}%
        </span>
        <span className={`ml-auto text-[10px] ${isOverdue ? 'text-amber-400' : 'text-slate-600'}`}>
          {isOverdue ? `⚠ ${hours - sla}h tarde` : `SLA ${Math.max(0, sla - hours)}h`}
        </span>
      </div>

      {/* Next action */}
      <div className="mt-2.5 flex items-start gap-1.5 border-t border-slate-700/40 pt-2.5">
        <Sparkles size={10} className={`mt-0.5 shrink-0 ${lead.nextAction ? 'text-amber-400/70' : 'text-slate-600'}`} />
        <span className={`line-clamp-2 text-[11px] leading-relaxed ${lead.nextAction ? 'text-amber-400/80' : 'text-slate-600'}`}>
          {lead.nextAction || 'Definir siguiente acción'}
        </span>
      </div>

      {/* Contact actions */}
      <div className="mt-2.5 flex items-center gap-0.5">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-white" title="Llamar">
            <Phone size={13} />
          </a>
        ) : null}
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-1.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-slate-700"
            title="WhatsApp"
          >
            WA
          </a>
        ) : null}
        {lead.email ? (
          <a href={`mailto:${lead.email}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-white" title="Email">
            <Mail size={13} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

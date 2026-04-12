'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock3, Flame, Mail, MoreHorizontal, Phone, Plus, Search, Sparkles } from 'lucide-react';
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

  const fetchLeads = async () => {
    setLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/crm/leads', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const data = (await response.json()) as { leads?: CrmLeadResponse[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudieron cargar los leads.');
      }

      const mapped = (data.leads || []).map(mapLead);
      setLeads(mapped);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLeads();
  }, []);

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
    <div className="-m-6 flex h-[calc(100vh-5.8rem)] flex-col overflow-hidden bg-slate-950 text-slate-200">
      <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-2 text-xs text-slate-300">
        Motor de ventas avanzado disponible en CRM: calendario semanal, enlaces Calendly/Zoom y emails editables.
        {' '}
        <Link href="/dashboard/crm" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Abrir CRM ahora
        </Link>
      </div>
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-white">Motor de Ventas</h1>
          <span className="text-xs text-slate-500">{filteredLeads.length} leads activos</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar lead..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-64 rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-9 pr-3 text-sm text-white focus:border-cyan-500"
            />
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <button
            onClick={() => setViewMode(viewMode === 'kanban' ? 'list' : 'kanban')}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
          >
            {viewMode === 'kanban' ? 'Vista Lista' : 'Vista Kanban'}
          </button>
        </div>
      </header>

      <section className="grid gap-3 border-b border-slate-800 bg-slate-900/30 px-4 py-3 md:grid-cols-3">
        <button
          onClick={() => setQueueFilter('priority')}
          className={`rounded-xl border p-3 text-left transition ${queueFilter === 'priority' ? 'border-rose-400/40 bg-rose-500/10' : 'border-slate-800 bg-slate-900/70'}`}
        >
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <Flame size={12} /> Prioridad alta
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">{queueStats.hot}</p>
          <p className="text-xs text-slate-500">Leads que piden seguimiento ahora</p>
        </button>

        <button
          onClick={() => setQueueFilter('overdue')}
          className={`rounded-xl border p-3 text-left transition ${queueFilter === 'overdue' ? 'border-amber-400/40 bg-amber-500/10' : 'border-slate-800 bg-slate-900/70'}`}
        >
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <AlertTriangle size={12} /> Atrasados
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">{queueStats.overdue}</p>
          <p className="text-xs text-slate-500">Fuera de SLA de seguimiento</p>
        </button>

        <button
          onClick={() => setQueueFilter('today')}
          className={`rounded-xl border p-3 text-left transition ${queueFilter === 'today' ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/70'}`}
        >
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <Clock3 size={12} /> Actividad hoy
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">{queueStats.today}</p>
          <p className="text-xs text-slate-500">Toques recientes en las ultimas 24h</p>
        </button>
      </section>

      <section className="border-b border-slate-800 bg-slate-900/30 px-4 py-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Mi agenda de hoy</p>
            <span className="text-xs text-slate-500">Top {todayAgenda.length} prioridades</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {todayAgenda.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                  <span className="text-[10px] text-cyan-300">{item.probability}%</span>
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">{item.stage}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-300">{item.nextAction}</p>
                <p className="mt-1 text-[11px] text-slate-500">Hace {item.hoursSince}h</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-b border-slate-800 bg-slate-900/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newLeadName}
            onChange={(event) => setNewLeadName(event.target.value)}
            placeholder="Nombre del lead"
            className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white"
          />
          <input
            value={newLeadEmail}
            onChange={(event) => setNewLeadEmail(event.target.value)}
            placeholder="Email"
            className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white"
          />
          <button
            onClick={createLead}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
          >
            <Plus size={16} />
            {saving ? 'Guardando...' : 'Nuevo Lead'}
          </button>
          <button
            onClick={() => setQueueFilter('all')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${queueFilter === 'all' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
          >
            Ver toda la cola
          </button>
          {message ? <span className="text-xs text-amber-300">{message}</span> : null}
        </div>
      </div>

      {loading ? (
        <div className="grid flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-xl border border-slate-800 bg-slate-900/40" />
          ))}
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full min-w-max gap-4 p-4">
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
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredLeads.map((lead) => {
              const priority = getLeadPriority(lead);
              const priorityTone = priority === 'hot' ? 'text-rose-300' : priority === 'warm' ? 'text-amber-300' : 'text-slate-400';
              const probability = getCloseProbability(lead);

              return (
              <div key={lead.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{lead.name}</p>
                    <p className="text-xs text-slate-400">{lead.email}</p>
                    <p className={`mt-1 text-[11px] uppercase tracking-[0.14em] ${priorityTone}`}>Prioridad {priority}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200">
                      Cierre {probability}%
                    </span>
                    <select
                      value={lead.stage}
                      onChange={(event) => void moveLead(lead.id, event.target.value as StageId)}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white"
                    >
                      {STAGES.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs font-mono text-emerald-400">${lead.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
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
      className={`flex w-80 flex-col rounded-xl border transition-colors ${
        isOver ? 'border-cyan-500/50 bg-slate-800/50' : 'border-slate-800 bg-slate-900/30'
      }`}
    >
      <div className="group/header relative rounded-t-xl border-b border-slate-800 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">{stage.icon}</span>
            <h3 className="text-sm font-medium text-white">{stage.label}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs text-white ${stage.chipClass}`}>{leads.length}</span>
          </div>
          <button
            onClick={() => setShowPlaybook((current) => !current)}
            className="text-slate-500 hover:text-white"
            aria-label={`Mostrar acciones clave de ${stage.label}`}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        <div
          className={`absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-slate-700 bg-slate-800 p-3 shadow-xl transition ${
            showPlaybook ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/header:opacity-100'
          }`}
        >
          <p className="mb-1 text-xs font-medium text-white">Acciones clave en {stage.label}:</p>
          <ul className="space-y-1 text-xs text-slate-400">
            {stagePlaybook.map((action) => (
              <li key={action}>• {action}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}

        {leads.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-slate-800 text-xs text-slate-600">
            Arrastra leads aqui
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const [isDragging, setIsDragging] = useState(false);
  const valueColor = lead.value > 0 ? 'text-emerald-400' : 'text-slate-500';
  const priority = getLeadPriority(lead);
  const hours = getHoursSince(lead.lastActivity);
  const sla = getSlaHours(lead);
  const isOverdue = hours > sla;
  const probability = getCloseProbability(lead);
  const whatsappHref = lead.phone
    ? `https://wa.me/${lead.phone.replace(/[^\d]/g, '')}`
    : null;
  const priorityTone =
    priority === 'hot'
      ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
      : priority === 'warm'
      ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
      : 'border-slate-600 bg-slate-700/60 text-slate-300';

  return (
    <div
      draggable
      onDragStart={(event) => {
        setIsDragging(true);
        event.dataTransfer.setData('text/plain', lead.id);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`group cursor-move rounded-lg border border-slate-700 bg-slate-800 p-3 transition-all hover:border-slate-500 ${
        isDragging ? 'rotate-2 opacity-50' : ''
      }`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h4 className="text-sm font-medium text-white transition group-hover:text-cyan-400">{lead.name}</h4>
          <p className="max-w-[180px] truncate text-xs text-slate-400">{lead.email}</p>
        </div>
        <span className={`text-xs font-mono ${valueColor}`}>${lead.value.toLocaleString()}</span>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${priorityTone}`}>
          {priority}
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
            {probability}%
          </span>
          <span className={`text-[10px] ${isOverdue ? 'text-amber-300' : 'text-slate-500'}`}>
            {isOverdue ? `Atrasado ${hours - sla}h` : `SLA ${Math.max(0, sla - hours)}h`}
          </span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {lead.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white" title="Llamar">
            <Phone size={14} />
          </a>
        ) : null}
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1.5 text-emerald-400 hover:bg-slate-700 hover:text-emerald-300"
            title="WhatsApp"
          >
            WA
          </a>
        ) : null}
        {lead.email ? (
          <a href={`mailto:${lead.email}`} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white" title="Email">
            <Mail size={14} />
          </a>
        ) : null}
        <div className="flex-1" />
        <span className="text-[10px] text-slate-500">{lead.assignedTo}</span>
      </div>

      {lead.nextAction ? (
        <div className="mt-2 flex items-center gap-1.5 border-t border-slate-700/50 pt-2 text-[10px] text-amber-400">
          <Sparkles size={10} />
          <span className="truncate">{lead.nextAction}</span>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5 border-t border-slate-700/50 pt-2 text-[10px] text-cyan-300">
          <Sparkles size={10} />
          <span className="truncate">Siguiente paso sugerido: agendar toque comercial en menos de 24h.</span>
        </div>
      )}
    </div>
  );
}

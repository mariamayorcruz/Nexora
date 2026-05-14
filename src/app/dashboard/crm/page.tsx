'use client';

import { ChevronRight, Clock3, Columns3, Flame, Plus, Search, Sparkles } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import CrmAddLeadModal from '@/components/CrmAddLeadModal';
import FocusPanel, { type FocusLead } from '@/components/FocusPanel';
import { useAppLanguage } from '@/hooks/use-app-language';

type ViewMode = 'kanban' | 'list';
type FilterMode = 'all' | 'hot' | 'whatsapp' | 'sms' | 'won';
type UiStage = 'new' | 'contacted' | 'proposal' | 'negotiation' | 'won';
type CommandCenterContext = 'demo' | 'hot' | 'newest' | 'pipeline';

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

function leadRiskLevel(lead: LeadRow): 'critical' | 'warning' | 'ok' {
  const hoursSinceUpdate = (Date.now() - new Date(lead.updatedAt).getTime()) / 3600000;
  if (lead.stage === 'won') return 'ok';
  if (hoursSinceUpdate > 72) return 'critical';
  if (hoursSinceUpdate > 24) return 'warning';
  return 'ok';
}

function leadRiskLabel(lead: LeadRow, language: string): string {
  const hoursSinceUpdate = (Date.now() - new Date(lead.updatedAt).getTime()) / 3600000;
  const days = Math.floor(hoursSinceUpdate / 24);
  const hours = Math.floor(hoursSinceUpdate);
  if (lead.stage === 'won') return '';
  const en = language === 'en';
  if (hoursSinceUpdate > 72) {
    return en
      ? `No contact for ${days} days. This customer may think you forgot about them.`
      : `Sin contacto hace ${days} días. Este cliente puede pensar que lo olvidaste.`;
  }
  if (hoursSinceUpdate > 24) {
    return en
      ? `${hours}h without a reply. A quick message keeps this warm.`
      : `${hours}h sin respuesta. Un mensaje rápido mantiene el interés.`;
  }
  return '';
}

export default function DashboardCrmPage() {
  const { language } = useAppLanguage();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null);
  const [commandCenterSelection, setCommandCenterSelection] = useState<{
    leadId: string | null;
    context: CommandCenterContext;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const pipelineSectionRef = useRef<HTMLElement | null>(null);
  const focusPanelRef = useRef<HTMLDivElement | null>(null);

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
    const leadIdFromUrl = searchParams.get('leadId');
    if (leadIdFromUrl && leads.length > 0) {
      setSelectedLeadId(leadIdFromUrl);
      setHighlightedLeadId(leadIdFromUrl);
      setViewMode('list');
      setTimeout(() => {
        pipelineSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 300);
    }
  }, [searchParams, leads]);

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
  const sampleLead = leads.find((lead) => String(lead.source || '').toLowerCase() === 'launch_assistant') || null;
  const hottestLead = [...leads]
    .filter((lead) => leadPriority(lead) === 'hot')
    .sort((a, b) => {
      const scoreA = (a.value || 0) + (a.confidence || 0) * 30;
      const scoreB = (b.value || 0) + (b.confidence || 0) * 30;
      return scoreB - scoreA;
    })[0] || null;
  const newestLead =
    [...leads].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0] || null;
  const criticalLeads = leads.filter((lead) => leadRiskLevel(lead) === 'critical');
  const warningLeads = leads.filter((lead) => leadRiskLevel(lead) === 'warning');

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
    return { pipelineTotal, closeRate, revenue, avgCloseHours };
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
  const commandCenter = useMemo(() => {
    const en = language === 'en';
    if (loading) return null;

    if (leads.length === 0) {
      return {
        eyebrow: en ? 'CRM Command Center' : 'Centro de comando CRM',
        title: en ? 'Your CRM is ready' : 'Tu CRM está listo',
        detail: en
          ? 'When leads arrive, Nexora helps you prioritize follow-ups and keep the pipeline moving.'
          : 'Cuando lleguen leads, Nexora te ayuda a priorizar seguimientos y mantener el pipeline activo.',
        accent: 'text-cyan-300',
        pipelineEmptyHint: en
          ? 'Your pipeline is ready. Add your first lead to start protecting opportunities.'
          : 'Tu pipeline está listo. Agrega tu primer lead para empezar a proteger oportunidades.',
        bullets: en
          ? ['Prioritize who needs attention first', 'Follow up before interest cools']
          : ['Prioriza quién necesita atención primero', 'Da seguimiento antes de que enfríe el interés'],
      };
    }

    if (sampleLead) {
      return {
        eyebrow: en ? 'CRM Command Center' : 'Centro de comando CRM',
        title: en ? 'Start with your demo lead' : 'Empieza por tu lead demo',
        detail: en
          ? 'Move it through the pipeline and test your first follow-up.'
          : 'Muévelo por el pipeline y prueba tu primer seguimiento.',
        accent: 'text-amber-300',
        ctaLabel: en ? 'Review demo lead' : 'Revisar lead demo',
        ctaLeadId: sampleLead.id,
        ctaViewMode: 'list' as ViewMode,
        ctaContext: 'demo' as CommandCenterContext,
        bullets: en
          ? ['Review context and the next step', 'Send or schedule your reply']
          : ['Revisa el contexto y el siguiente paso', 'Envía o programa tu respuesta'],
      };
    }

    return {
      eyebrow: en ? 'Pipeline Command Center' : 'Centro de comando del pipeline',
      title: en ? 'Focus on leads that matter now' : 'Enfócate en los leads que importan ahora',
      detail: criticalLeads.length > 0
        ? en
          ? `${criticalLeads.length} customer${criticalLeads.length > 1 ? 's' : ''} haven't heard from you in 3+ days. They may think you forgot about them.`
          : `${criticalLeads.length} cliente${criticalLeads.length > 1 ? 's' : ''} no han recibido respuesta en 3+ días. Pueden pensar que los olvidaste.`
        : warningLeads.length > 0
          ? en
            ? `${warningLeads.length} customer${warningLeads.length > 1 ? 's' : ''} are waiting for a reply. A quick message keeps them warm.`
            : `${warningLeads.length} cliente${warningLeads.length > 1 ? 's' : ''} esperan respuesta. Un mensaje rápido mantiene el interés.`
          : en
            ? 'Keep follow-ups moving and guide each opportunity to a clear next step.'
            : 'Mantén los seguimientos en marcha y guía cada oportunidad hacia un siguiente paso claro.',
      accent: criticalLeads.length > 0 ? 'text-rose-300' : warningLeads.length > 0 ? 'text-amber-300' : 'text-cyan-300',
      ctaLabel: hottestLead
        ? en
          ? 'Open hot opportunity'
          : 'Abrir oportunidad caliente'
        : en
          ? 'Review newest lead'
          : 'Revisar lead más reciente',
      ctaLeadId: hottestLead?.id || newestLead?.id || null,
      ctaViewMode: hottestLead ? ('kanban' as ViewMode) : ('list' as ViewMode),
      ctaContext: hottestLead ? ('hot' as CommandCenterContext) : ('newest' as CommandCenterContext),
      bullets: en
        ? ['Start with high-intent opportunities', 'Act where timing matters most']
        : ['Empieza por las oportunidades de alta intención', 'Actúa donde el timing importe más'],
    };
  }, [criticalLeads.length, hottestLead, language, leads.length, loading, newestLead, sampleLead, warningLeads.length]);

  const handleCommandCenterCta = () => {
    if (commandCenter?.ctaViewMode && commandCenter.ctaViewMode !== viewMode) {
      setViewMode(commandCenter.ctaViewMode);
    }

    if (commandCenter?.ctaLeadId) {
      setSelectedLeadId(commandCenter.ctaLeadId);
      setHighlightedLeadId(commandCenter.ctaLeadId);
      setCommandCenterSelection({
        leadId: commandCenter.ctaLeadId,
        context: commandCenter.ctaContext,
      });
    } else {
      setCommandCenterSelection({
        leadId: null,
        context: commandCenter?.ctaContext || 'pipeline',
      });
    }

    pipelineSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  useEffect(() => {
    if (!highlightedLeadId) return;

    const timer = window.setTimeout(() => {
      setHighlightedLeadId((current) => (current === highlightedLeadId ? null : current));
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [highlightedLeadId]);

  useEffect(() => {
    if (!commandCenterSelection) return;

    const timer = window.setTimeout(() => {
      setCommandCenterSelection((current) =>
        current === commandCenterSelection ? null : current
      );
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [commandCenterSelection]);

  useEffect(() => {
    if (!highlightedLeadId || viewMode !== 'kanban') return;

    const timer = window.setTimeout(() => {
      const highlightedCard = document.querySelector<HTMLElement>(`[data-highlighted-lead-id="${highlightedLeadId}"]`);
      if (!highlightedCard) return;

      highlightedCard.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [highlightedLeadId, viewMode]);

  useEffect(() => {
    if (!highlightedLeadId || viewMode !== 'list') return;

    const timer = window.setTimeout(() => {
      focusPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [highlightedLeadId, viewMode]);

  const showCommandCenterLabel =
    viewMode === 'list' &&
    Boolean(commandCenterSelection?.leadId) &&
    commandCenterSelection?.leadId === selectedLead?.id;
  const commandCenterLabelContent = useMemo(() => {
    const en = language === 'en';
    switch (commandCenterSelection?.context) {
      case 'demo':
        return {
          title: en ? 'Demo lead selected' : 'Lead demo seleccionado',
          detail: en ? 'Move this lead through your pipeline.' : 'Mueve este lead por tu pipeline.',
        };
      case 'newest':
        return {
          title: en ? 'Newest lead selected' : 'Lead más reciente seleccionado',
          detail: en ? 'Review latest activity and choose the next step.' : 'Revisa la actividad reciente y elige el siguiente paso.',
        };
      case 'hot':
        return {
          title: en ? 'Hot opportunity selected' : 'Oportunidad caliente seleccionada',
          detail: en ? 'This lead may need action now.' : 'Este lead puede necesitar acción ahora.',
        };
      default:
        return {
          title: en ? 'Pipeline ready' : 'Pipeline listo',
          detail: en ? 'Your workspace is ready.' : 'Tu espacio de trabajo está listo.',
        };
    }
  }, [commandCenterSelection, language]);
  const commandCenterLabelTone = useMemo(() => {
    switch (commandCenterSelection?.context) {
      case 'demo':
        return {
          wrapper: 'border-cyan-400/15 bg-cyan-500/10',
          title: 'text-cyan-300',
          detail: 'text-slate-400',
        };
      case 'newest':
        return {
          wrapper: 'border-violet-400/15 bg-violet-500/10',
          title: 'text-violet-300',
          detail: 'text-slate-400',
        };
      case 'hot':
        return {
          wrapper: 'border-amber-400/15 bg-[rgba(251,191,36,0.10)]',
          title: 'text-amber-300',
          detail: 'text-slate-400',
        };
      default:
        return {
          wrapper: 'border-white/[0.08] bg-white/[0.04]',
          title: 'text-slate-200',
          detail: 'text-slate-400',
        };
    }
  }, [commandCenterSelection]);
  const commandCenterCtaTone = useMemo(() => {
    switch (commandCenter?.ctaContext) {
      case 'demo':
        return 'bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 focus-visible:ring-cyan-300/70';
      case 'newest':
        return 'bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 focus-visible:ring-violet-300/70';
      case 'hot':
        return 'bg-[rgba(251,191,36,0.14)] text-amber-200 hover:bg-[rgba(251,191,36,0.22)] focus-visible:ring-amber-300/70';
      default:
        return 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.10] focus-visible:ring-slate-300/40';
    }
  }, [commandCenter]);
  const commandCenterCtaIcon = useMemo(() => {
    switch (commandCenter?.ctaContext) {
      case 'demo':
        return Sparkles;
      case 'newest':
        return Clock3;
      case 'hot':
        return Flame;
      default:
        return Columns3;
    }
  }, [commandCenter]);

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

  const handleLeadCreated = async () => {
    await fetchLeads();
    setMessage(language === 'en' ? 'Lead added to CRM.' : 'Lead agregado al CRM.');
    setAddLeadOpen(false);
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
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_296px]">
      <div className="space-y-5">
        {commandCenter ? (
          <section className="rounded-[28px] bg-[#040810] p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className={`text-[11px] uppercase tracking-[0.2em] ${commandCenter.accent}`}>{commandCenter.eyebrow}</p>
                <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-white sm:text-[28px]">
                  {commandCenter.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">{commandCenter.detail}</p>
                {'pipelineEmptyHint' in commandCenter && commandCenter.pipelineEmptyHint ? (
                  <>
                    <p className="mt-4 text-sm leading-6 text-slate-500">{commandCenter.pipelineEmptyHint}</p>
                    <button
                      type="button"
                      onClick={() => setAddLeadOpen(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040810]"
                    >
                      <Plus className="h-4 w-4" />
                      {language === 'en' ? 'Add first lead' : 'Agregar primer lead'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleCommandCenterCta}
                    className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040810] ${commandCenterCtaTone}`}
                  >
                    {(() => {
                      const Icon = commandCenterCtaIcon;
                      return <Icon className="h-3.5 w-3.5" />;
                    })()}
                    {commandCenter.ctaLabel}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:max-w-[420px]">
                {commandCenter.bullets.map((item) => (
                  <div key={item} className="rounded-[20px] bg-[#030610] px-4 py-3 text-sm text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

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
                <p className="text-slate-500">{language === 'en' ? 'Close rate' : 'Tasa de cierre'}</p>
                <p className="mt-1 text-white">{metrics.closeRate}%</p>
              </div>
              <div>
                <p className="text-slate-500">{language === 'en' ? 'Revenue' : 'Ingresos'}</p>
                <p className="mt-1 text-white">${metrics.revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500">{language === 'en' ? 'Avg. closing time' : 'Tiempo prom. cierre'}</p>
                <p className="mt-1 text-white">{metrics.avgCloseHours}h</p>
              </div>
            </div>
          </div>
        </section>

        {message ? <div className="rounded-2xl bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">{message}</div> : null}

        <section ref={pipelineSectionRef} className="rounded-[28px] bg-[#040810] p-4">
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
                  {mode === 'kanban' ? 'Kanban' : language === 'en' ? 'List' : 'Lista'}
                </button>
              ))}
            </div>
            {leads.length > 0 ? (
              <button
                type="button"
                onClick={() => setAddLeadOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all duration-150 hover:border-cyan-400/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              >
                <Plus className="h-3.5 w-3.5 text-cyan-300" />
                {language === 'en' ? 'Add lead' : 'Agregar lead'}
              </button>
            ) : null}
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
                    ['all', language === 'en' ? 'All' : 'Todos'],
                    ['hot', 'Hot'],
                    ['whatsapp', 'WhatsApp'],
                    ['sms', 'SMS'],
                    ['won', language === 'en' ? 'Won' : 'Ganados'],
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
                    <span>{language === 'en' ? 'Avatar' : 'Avatar'}</span>
                    <span>{language === 'en' ? 'Lead + detail' : 'Lead + detalle'}</span>
                    <span>{language === 'en' ? 'Status' : 'Estado'}</span>
                    <span>{language === 'en' ? 'Source' : 'Fuente'}</span>
                    <span>{language === 'en' ? 'Value' : 'Valor'}</span>
                    <span>{language === 'en' ? 'Time' : 'Tiempo'}</span>
                    <span />
                  </div>
                  <div className="divide-y divide-white/[0.05]">
                    {filtered.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`grid w-full grid-cols-[72px_minmax(220px,1.9fr)_1fr_0.8fr_0.8fr_0.7fr_40px] gap-3 px-4 py-3 text-left transition-all duration-300 hover:bg-white/[0.02] ${
                          selectedLeadId === lead.id ? 'border-l-2 border-cyan-400 bg-[rgba(6,182,212,0.03)]' : ''
                        } ${
                          highlightedLeadId === lead.id
                            ? 'ring-1 ring-cyan-400/50 ring-inset bg-cyan-500/[0.08]'
                            : ''
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
                        <div className="flex items-center self-center">
                          <ChevronRight className="h-4 w-4 text-slate-600" />
                          {leadRiskLevel(lead) !== 'ok' && (
                            <span
                              className={`ml-1 h-2 w-2 rounded-full ${
                                leadRiskLevel(lead) === 'critical' ? 'bg-rose-400' : 'bg-amber-400'
                              }`}
                            />
                          )}
                        </div>
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
                        data-highlighted-lead-id={highlightedLeadId === lead.id ? lead.id : undefined}
                        className={`w-full rounded-[20px] bg-white/[0.03] p-3 text-left transition-all duration-300 hover:-translate-y-[1px] hover:bg-white/[0.045] ${
                          selectedLeadId === lead.id ? 'border border-cyan-400/25' : 'border border-transparent'
                        } ${
                          highlightedLeadId === lead.id
                            ? 'ring-1 ring-cyan-400/50 bg-cyan-500/[0.08]'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{lead.name}</p>
                            {leadRiskLevel(lead) !== 'ok' && (
                              <span
                                className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  leadRiskLevel(lead) === 'critical'
                                    ? 'bg-rose-500/10 text-rose-300'
                                    : 'bg-amber-500/10 text-amber-300'
                                }`}
                              >
                                {leadRiskLevel(lead) === 'critical' ? '⚠ ' : '• '}
                                {language === 'en'
                                  ? leadRiskLevel(lead) === 'critical' ? 'No contact 3d+' : 'No reply 24h+'
                                  : leadRiskLevel(lead) === 'critical' ? 'Sin contacto 3d+' : 'Sin respuesta 24h+'}
                              </span>
                            )}
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

      <div ref={focusPanelRef} className="space-y-3">
        {showCommandCenterLabel ? (
          <div className={`rounded-[18px] border px-4 py-3 transition-colors duration-300 ${commandCenterLabelTone.wrapper}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${commandCenterLabelTone.title}`}>
              {commandCenterLabelContent.title}
            </p>
            <p className={`mt-1 text-xs ${commandCenterLabelTone.detail}`}>{commandCenterLabelContent.detail}</p>
          </div>
        ) : null}
        <FocusPanel
          lead={selectedLead}
          riskLabel={selectedLead ? leadRiskLabel(selectedLead, language) : undefined}
          messageLabel={
            selectedLead
              ? leadRiskLabel(selectedLead, language) ||
                (language === 'en'
                  ? `Suggested move: confirm next step with ${selectedLead.name} today.`
                  : `Sugerencia IA: confirma el siguiente paso con ${selectedLead.name} hoy.`)
              : undefined
          }
          onSend={handleSend}
        />
      </div>
    </div>
    <CrmAddLeadModal
      open={addLeadOpen}
      onClose={() => setAddLeadOpen(false)}
      language={language}
      onCreated={handleLeadCreated}
    />
    </>
  );
}

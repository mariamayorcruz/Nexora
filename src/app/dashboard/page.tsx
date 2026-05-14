'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, CalendarPlus2, MessageCircleMore, Rocket, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import DailyBriefing from '@/components/DailyBriefing';
import NextBestActionPanel from '@/components/NextBestActionPanel';
import { useAppLanguage } from '@/hooks/use-app-language';
import { computeNextBestActions } from '@/lib/next-best-action';

type DashboardPayload = {
  user?: {
    name?: string | null;
    email?: string;
    onboardingData?: Record<string, unknown> | null;
    entitlements?: {
      marketingLabel?: string;
      capabilities?: { aiCreditsMonthly?: number } | null;
    } | null;
  };
  adAccounts?: Array<{ platform?: string; connected?: boolean; accountName?: string }>;
  overviewFunnel?: { crmLeads?: number; crmWon?: number };
};

type LeadRow = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: string;
  stage: string;
  value: number;
  confidence: number;
  nextAction?: string | null;
  updatedAt: string;
};

type StudioPayload = {
  usage?: {
    creditsRemaining: number;
    creditsTotal: number;
  } | null;
  jobs?: Array<{ id: string; title: string; createdAt: string }>;
};

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h`;
  return `${Math.floor(diffHours / 24)} d`;
}

function leadChannel(lead: LeadRow) {
  if (lead.phone && !lead.email) return 'SMS';
  if (lead.phone) return 'WA';
  return 'Email';
}

export default function DashboardPage() {
  const { language } = useAppLanguage();
  const router = useRouter();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [studio, setStudio] = useState<StudioPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    const load = async () => {
      try {
        const [meRes, leadsRes, studioRes] = await Promise.all([
          fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
          fetch('/api/crm/leads', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
          fetch('/api/ai/studio', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
        ]);

        const meData = await meRes.json();
        const leadsData = await leadsRes.json().catch(() => ({ leads: [] }));
        const studioData = await studioRes.json().catch(() => ({ usage: null, jobs: [] }));

        setPayload(meData);
        setLeads(Array.isArray(leadsData?.leads) ? leadsData.leads : []);
        setStudio(studioData);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const businessName =
    String(payload?.user?.onboardingData?.businessName || '').trim() ||
    payload?.user?.name ||
    payload?.user?.email ||
    'Nexora';
  const firstWinReady = Boolean(payload?.user?.onboardingData?.firstWinReady);
  const greetingName = payload?.user?.name || businessName;
  const todayDate = new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const activeLeads = leads.filter((lead) => lead.stage !== 'won');
  const waitingForReply = activeLeads.filter(
    (lead) => (Date.now() - new Date(lead.updatedAt).getTime()) / 3600000 > 24
  ).length;
  const hotLead = [...activeLeads]
    .filter((lead) => lead.confidence >= 65 || lead.value >= 1000)
    .sort((a, b) => (b.value + b.confidence * 30) - (a.value + a.confidence * 30))[0] || null;
  const aiConversations = leads.filter((lead) =>
    lead.source === 'whatsapp' || lead.source === 'sms'
  ).length;
  const leadStageLeads = activeLeads.filter((lead) => lead.stage === 'lead');
  const staleLeads = activeLeads.filter((lead) => Date.now() - new Date(lead.updatedAt).getTime() > 1000 * 60 * 60 * 24);
  const followUpsPending = activeLeads.filter((lead) => Boolean(lead.nextAction)).length;
  const sampleLeadExists = leads.some((lead) => String(lead.source || '').toLowerCase() === 'launch_assistant');
  const urgentLead = [...activeLeads].sort((a, b) => {
    const scoreA = (a.value || 0) + (a.confidence || 0) * 30;
    const scoreB = (b.value || 0) + (b.confidence || 0) * 30;
    return scoreB - scoreA;
  })[0];

  const recentLeads = [...activeLeads].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 6);
  const conversations = recentLeads.filter((lead) => lead.phone || lead.email).slice(0, 5);

  const revenueClosed = leads
    .filter((lead) => lead.stage === 'won')
    .reduce((sum, lead) => sum + Number(lead.value || 0), 0);

  const connectedMap = useMemo(() => {
    const platforms = Array.isArray(payload?.adAccounts) ? payload?.adAccounts : [];
    return {
      whatsapp: activeLeads.some((lead) => Boolean(lead.phone)),
      sms: activeLeads.some((lead) => Boolean(lead.phone) && !lead.email),
      instagram: platforms.some((item) => String(item.platform || '').includes('instagram')),
      facebook: platforms.some((item) => String(item.platform || '').includes('facebook')),
    };
  }, [activeLeads, payload?.adAccounts]);
  const todayCards = useMemo(() => {
    const en = language === 'en';
    const cards: Array<{
      label: string;
      title: string;
      detail: string;
      tone: string;
      href: string;
      cta: string;
    }> = [];

    if (activeLeads.length === 0) {
      cards.push({
        label: en ? 'Lead protection' : 'Protección de leads',
        title: en ? 'Ready for your first opportunity' : 'Listo para tu primera oportunidad',
        detail: en
          ? 'Start from your sample lead or connect a source so Nexora can protect new inquiries.'
          : 'Empieza con tu lead demo o conecta una fuente para que Nexora cuide nuevas consultas.',
        tone: 'text-cyan-300',
        href: '/dashboard/crm',
        cta: en ? 'Open CRM' : 'Abrir CRM',
      });
    } else if (staleLeads.length > 0) {
      cards.push({
        label: en ? 'Needs attention' : 'Requieren atención',
        title: en
          ? `${staleLeads.length} potential ${staleLeads.length === 1 ? "customer hasn't" : "customers haven't"} heard back yet`
          : `${staleLeads.length} ${staleLeads.length === 1 ? 'cliente potencial sin' : 'clientes potenciales sin'} respuesta reciente`,
        detail: en
          ? 'They may think you forgot about them. A quick message changes that.'
          : 'Puede que crean que los olvidaste. Un mensaje rápido cambia eso.',
        tone: 'text-amber-300',
        href: '/dashboard/crm',
        cta: en ? 'Open CRM' : 'Abrir CRM',
      });
    } else if (leadStageLeads.length > 0) {
      cards.push({
        label: en ? 'Needs attention' : 'Requieren atención',
        title: en
          ? `${leadStageLeads.length} new ${leadStageLeads.length === 1 ? 'customer is' : 'customers are'} waiting to hear from you`
          : `${leadStageLeads.length} ${leadStageLeads.length === 1 ? 'cliente nuevo está esperando' : 'clientes nuevos están esperando'} tu respuesta`,
        detail: en
          ? 'Most customers decide in the first response. Make yours count.'
          : 'La mayoría decide con la primera respuesta. Haz que cuente.',
        tone: 'text-cyan-300',
        href: '/dashboard/crm',
        cta: en ? 'View pipeline' : 'Ver pipeline',
      });
    }

    if (urgentLead) {
      cards.push({
        label: en ? 'Opportunity' : 'Oportunidad',
        title: en ? `${urgentLead.name} is waiting for you to take the next step` : `${urgentLead.name}: espera tu siguiente paso`,
        detail:
          urgentLead.nextAction ||
          (en ? "High interest — don't let this one cool off." : 'Alta intención — no dejes que se enfríe.'),
        tone: 'text-emerald-300',
        href: '/dashboard/crm',
        cta: en ? 'Open in CRM' : 'Abrir en CRM',
      });
    }

    if (urgentLead) {
      cards.push({
        label: en ? 'Next step' : 'Siguiente paso',
        title: en ? `Message ${urgentLead.name}` : `Escribir a ${urgentLead.name}`,
        detail: en
          ? 'Continue in the inbox with full context in one place.'
          : 'Continúa en el inbox con el contexto en un solo lugar.',
        tone: 'text-white',
        href: '/dashboard/conversaciones',
        cta: en ? 'Open inbox' : 'Abrir inbox',
      });
    } else {
      cards.push({
        label: en ? 'Next action' : 'Próxima acción',
        title: sampleLeadExists
          ? en
            ? 'Review your sample lead'
            : 'Revisa tu lead demo'
          : firstWinReady
            ? en
              ? "Scan today's opportunities"
              : 'Repasa las oportunidades de hoy'
            : en
              ? 'Build your first growth system'
              : 'Construye tu primer sistema',
        detail: sampleLeadExists
          ? en
            ? 'See how Nexora runs a full follow-up flow.'
            : 'Mira cómo Nexora gestiona un flujo de seguimiento completo.'
          : firstWinReady
            ? en
              ? 'A quick CRM pass turns setup into momentum.'
              : 'Un repaso al CRM convierte la configuración en momentum.'
            : en
              ? 'Finish activation so Nexora can support you daily.'
              : 'Termina la activación para que Nexora te ayude cada día.',
        tone: 'text-white',
        href: sampleLeadExists || firstWinReady ? '/dashboard/crm' : '/dashboard/studio',
        cta: sampleLeadExists
          ? en
            ? 'Review lead'
            : 'Revisar lead'
          : firstWinReady
            ? en
              ? 'Open CRM'
              : 'Abrir CRM'
            : en
              ? 'Open Studio'
              : 'Abrir Studio',
      });
    }

    return cards.slice(0, 4);
  }, [
    activeLeads.length,
    firstWinReady,
    language,
    leadStageLeads.length,
    sampleLeadExists,
    staleLeads.length,
    urgentLead,
  ]);

  const todaySnapshot = useMemo(() => {
    const en = language === 'en';
    return [
      { label: en ? 'Total leads' : 'Leads totales', value: leads.length, tone: 'text-white' },
      {
        label: en ? 'Customers in conversation' : 'Clientes en conversación',
        value: activeLeads.length,
        tone: 'text-cyan-300',
      },
      {
        label: en ? 'Waiting for your reply' : 'Esperando tu respuesta',
        value: followUpsPending,
        tone: 'text-amber-300',
      },
      {
        label: en ? 'Customers closed' : 'Clientes cerrados',
        value: payload?.overviewFunnel?.crmWon || 0,
        tone: 'text-emerald-300',
      },
    ];
  }, [activeLeads.length, followUpsPending, language, leads.length, payload?.overviewFunnel?.crmWon]);
  const nextBestActions = useMemo(
    () => computeNextBestActions(leads, language),
    [leads, language]
  );

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-b-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DailyBriefing
        userName={greetingName}
        language={language}
        activeLeads={activeLeads.length}
        waitingForReply={waitingForReply}
        hotLeads={hotLead ? 1 : 0}
        hotLeadValue={hotLead?.value || 0}
        hotLeadName={hotLead?.name || ''}
        aiConversations={aiConversations}
        followUpsPending={followUpsPending}
        wonThisMonth={payload?.overviewFunnel?.crmWon || 0}
      />

      <section className="rounded-[28px] bg-[#040810] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">{language === 'en' ? 'Today' : 'Hoy'}</p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-white sm:text-[30px]">
              {language === 'en'
                ? 'A calm view of what matters right now'
                : 'Una vista clara de lo que importa ahora'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              {language === 'en'
                ? 'Follow-ups, opportunities, and the next move that protects revenue.'
                : 'Seguimientos, oportunidades y el siguiente paso que protege ingresos.'}
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-[440px]">
            {todaySnapshot.map((item) => (
              <div key={item.label} className="rounded-[20px] bg-white/[0.03] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                <p className={`mt-2 text-2xl font-semibold tracking-[-0.03em] ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {todayCards.map((card) => (
            <Link
              key={`${card.label}-${card.title}`}
              href={card.href}
              className="group rounded-[22px] bg-[#030610] p-4 transition-all duration-150 hover:-translate-y-[1px] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040810]"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
              <p className={`mt-3 text-[18px] font-semibold tracking-[-0.02em] ${card.tone}`}>{card.title}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{card.detail}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-cyan-300 transition-colors duration-150 group-hover:text-white">
                <span>{card.cta}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="rounded-[28px] bg-[#040810] px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">✦ Nexora · {businessName}</p>
          <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[34px] xl:text-[38px]">
            {language === 'en'
              ? `Hi, ${greetingName}. ${activeLeads.length} customers are waiting to hear from you today.`
              : `Hola, ${greetingName}. ${activeLeads.length} clientes esperan tu respuesta hoy.`}
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            {todayDate} · {language === 'en' ? 'AI Agent is protecting your opportunities right now.' : 'AI Agent cuidando tus oportunidades ahora mismo.'}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              `✦ Plan ${payload?.user?.entitlements?.marketingLabel || 'Scale'}`,
              connectedMap.whatsapp
                ? language === 'en'
                  ? 'WhatsApp active'
                  : 'WhatsApp activo'
                : language === 'en'
                  ? 'WhatsApp pending'
                  : 'WhatsApp pendiente',
              language === 'en' ? 'AI Agent active' : 'AI Agent activo',
              `${studio?.usage?.creditsRemaining || 0} ${language === 'en' ? 'credits' : 'créditos'}`,
            ].map((pill) => (
              <span key={pill} className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] bg-[#030610] p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {language === 'en' ? 'Suggested action' : 'Acción sugerida'}
          </p>
          {urgentLead ? (
            <>
              <div className="mt-4 rounded-[22px] bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">{urgentLead.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {leadChannel(urgentLead)} · {urgentLead.company || urgentLead.source}
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                {urgentLead.nextAction ||
                  (language === 'en'
                    ? "Don't let this opportunity cool off — they're still interested."
                    : 'No dejes que esta oportunidad se enfríe — todavía está interesado.')}
                </p>
              </div>
              <Link
                href="/dashboard/crm"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400"
              >
                {language === 'en' ? 'Open lead now' : 'Abrir lead ahora'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              {language === 'en' ? 'No urgent lead right now.' : 'No hay un lead urgente ahora mismo.'}
            </p>
          )}
        </div>
      </section>

      {firstWinReady ? (
        <section className="rounded-[28px] border border-cyan-500/15 bg-[rgba(6,182,212,0.07)] p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">
                {language === 'en' ? '✦ First win ready' : '✦ Primera victoria lista'}
              </p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">
                {language === 'en'
                  ? 'Nexora is ready to protect your opportunities'
                  : 'Nexora está listo para proteger tus oportunidades'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {language === 'en'
                  ? 'Your follow-up system is live. Nexora will help make sure no opportunity slips through.'
                  : 'Tu sistema de seguimiento está activo. Nexora se asegurará de que ninguna oportunidad se pierda.'}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
              <Link
                href="/dashboard/crm"
                className="rounded-full bg-cyan-500 px-4 py-2 text-center text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400"
              >
                {language === 'en' ? 'Open CRM' : 'Abrir CRM'}
              </Link>
              <Link
                href="/dashboard/conversaciones"
                className="rounded-full border border-white/[0.08] px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
              >
                {language === 'en' ? 'Review follow-up' : 'Revisar seguimiento'}
              </Link>
              <Link
                href="/dashboard/studio"
                className="rounded-full border border-white/[0.08] px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
              >
                {language === 'en' ? 'Open AI Studio' : 'Abrir Studio IA'}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {nextBestActions.length > 0 && (
        <NextBestActionPanel
          actions={nextBestActions}
          language={language}
          onSelectLead={(leadId) => {
            router.push(`/dashboard/crm?leadId=${leadId}`);
          }}
        />
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: language === 'en' ? 'Active leads' : 'Leads activos',
            value: activeLeads.length,
            tone: 'text-cyan-300',
            sub: language === 'en' ? 'Customers you can still win' : 'Clientes que aún puedes cerrar',
          },
          {
            label: language === 'en' ? 'Conversations today' : 'Conversaciones hoy',
            value: conversations.length,
            tone: 'text-white',
            sub: language === 'en' ? 'Customers needing a reply' : 'Clientes esperando respuesta',
          },
          {
            label: language === 'en' ? 'Closed this month' : 'Cierres este mes',
            value: `${payload?.overviewFunnel?.crmWon || 0} · $${revenueClosed.toLocaleString()}`,
            tone: 'text-emerald-300',
            sub: language === 'en' ? 'Revenue protected' : 'Ingresos protegidos',
          },
          {
            label: language === 'en' ? 'Studio assets' : 'Assets Studio',
            value: `${studio?.jobs?.length || 0} · ${studio?.usage?.creditsRemaining || 0}`,
            tone: 'text-violet-300',
            sub: language === 'en' ? 'Campaigns created + credits left' : 'Campañas creadas + créditos restantes',
          },
        ].map((item) => (
          <div key={item.label} className="rounded-[24px] bg-[#040810] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className={`mt-3 break-words text-[24px] font-semibold tracking-[-0.03em] sm:text-[28px] ${item.tone}`}>{item.value}</p>
            <p className="mt-2 text-xs text-slate-500">{item.sub}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[28px] bg-[#040810] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {language === 'en' ? 'Recent leads' : 'Leads recientes'}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
                {language === 'en' ? 'Pipeline feed' : 'Feed del pipeline'}
              </h2>
            </div>
            <Link href="/dashboard/crm" className="text-xs text-cyan-300 transition hover:text-white">
              {language === 'en' ? 'View all' : 'Ver todo'}
            </Link>
          </div>
          <div className="space-y-2">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="flex flex-wrap items-center gap-3 rounded-[20px] bg-white/[0.03] px-4 py-3 transition-all duration-150 hover:bg-white/[0.045] sm:flex-nowrap">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-semibold text-cyan-300">
                  {lead.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{lead.name}</p>
                  <p className="truncate text-xs text-slate-500">{lead.company || lead.source}</p>
                </div>
                <div className="ml-auto flex items-center gap-2 sm:ml-0">
                  <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-300">{leadChannel(lead)}</span>
                  <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] text-cyan-300">{lead.stage}</span>
                  <span className="text-[11px] text-slate-500">{timeAgo(lead.updatedAt)}</span>
                </div>
              </div>
            ))}
            {recentLeads.length === 0 ? (
              <div className="rounded-[20px] bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-500">
                {language === 'en' ? 'No recent leads yet.' : 'Todavía no hay leads recientes.'}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] bg-[#040810] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {language === 'en' ? 'Active conversations' : 'Conversaciones activas'}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
                {language === 'en' ? 'Live inbox' : 'Inbox activo'}
              </h2>
            </div>
            <Link href="/dashboard/conversaciones" className="text-xs text-cyan-300 transition hover:text-white">
              {language === 'en' ? 'Open inbox' : 'Abrir inbox'}
            </Link>
          </div>
          <div className="space-y-2">
            {conversations.map((lead) => (
              <div key={lead.id} className="rounded-[20px] bg-white/[0.03] px-4 py-3 transition-all duration-150 hover:bg-white/[0.045]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{lead.name}</p>
                    <p className="truncate text-xs text-slate-500">{leadChannel(lead)} · {timeAgo(lead.updatedAt)}</p>
                  </div>
                  <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] text-rose-300">
                    {language === 'en' ? 'Hot' : 'Caliente'}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">
                  {lead.nextAction ||
                    (language === 'en'
                      ? 'This customer may think you forgot about them.'
                      : 'Este cliente puede pensar que lo olvidaste.')}
                </p>
              </div>
            ))}
            {conversations.length === 0 ? (
              <div className="rounded-[20px] bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-500">
                {language === 'en' ? 'No active conversations yet.' : 'Todavía no hay conversaciones activas.'}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-[28px] bg-[#040810] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {language === 'en' ? 'Quick actions' : 'Acciones rápidas'}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { href: '/dashboard/studio', label: language === 'en' ? 'Generate copy' : 'Generar copy', icon: Sparkles },
              { href: '/dashboard/calendario', label: language === 'en' ? 'Schedule meeting' : 'Agendar cita', icon: CalendarPlus2 },
              { href: '/dashboard/conversaciones', label: language === 'en' ? 'Send message' : 'Enviar mensaje', icon: MessageCircleMore },
              { href: '/dashboard/crm', label: language === 'en' ? 'View pipeline' : 'Ver pipeline', icon: Rocket },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-[20px] bg-white/[0.03] px-4 py-4 text-sm text-white transition-all duration-150 hover:-translate-y-[1px] hover:bg-white/[0.05]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] bg-[#040810] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {language === 'en' ? 'Recent activity' : 'Actividad reciente'}
          </p>
          <div className="mt-4 space-y-3">
            {[
              language === 'en'
                ? `${activeLeads.length} customers waiting to hear from you.`
                : `${activeLeads.length} clientes esperando tu respuesta.`,
              language === 'en'
                ? `${conversations.length} customers need a reply today.`
                : `${conversations.length} clientes esperan tu respuesta hoy.`,
              language === 'en'
                ? `${studio?.jobs?.length || 0} assets generated in Nexora Studio.`
                : `${studio?.jobs?.length || 0} assets generados en Nexora Studio.`,
            ].map((event, index) => (
              <div key={event} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 rounded-full ${index === 0 ? 'bg-cyan-400' : index === 1 ? 'bg-amber-400' : 'bg-violet-400'}`} />
                <div>
                  <p className="text-sm text-slate-200">{event}</p>
                  <p className="text-[11px] text-slate-500">
                    {index === 0
                      ? language === 'en'
                        ? 'Now'
                        : 'Ahora'
                      : index === 1
                        ? language === 'en'
                          ? '18 min ago'
                          : 'Hace 18 min'
                        : language === 'en'
                          ? '1 h ago'
                          : 'Hace 1 h'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] bg-[#040810] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {language === 'en' ? 'Connected channels' : 'Canales conectados'}
          </p>
          <div className="mt-4 space-y-3">
            {[
              { label: 'WhatsApp', active: connectedMap.whatsapp, tone: 'text-cyan-300' },
              { label: 'SMS', active: connectedMap.sms, tone: 'text-emerald-300' },
              { label: 'Instagram', active: connectedMap.instagram, tone: 'text-violet-300' },
              { label: 'Facebook', active: connectedMap.facebook, tone: 'text-sky-300' },
            ].map((channel) => (
              <div key={channel.label} className="flex items-center justify-between rounded-[18px] bg-white/[0.03] px-4 py-3">
                <p className="text-sm text-white">{channel.label}</p>
                <span className={`text-xs ${channel.active ? channel.tone : 'text-slate-500'}`}>
                  {channel.active ? (language === 'en' ? 'Connected' : 'Conectado') : language === 'en' ? 'Pending' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>{language === 'en' ? 'Credits' : 'Créditos'}</span>
              <span>
                {studio?.usage?.creditsRemaining || 0}/{studio?.usage?.creditsTotal || 0}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.04]">
              <div
                className="h-2 rounded-full bg-cyan-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((studio?.usage?.creditsRemaining || 0) / Math.max(1, studio?.usage?.creditsTotal || 1)) * 100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

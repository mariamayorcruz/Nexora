'use client';

import Link from 'next/link';
import { ArrowRight, Bot, CalendarPlus2, MessageCircleMore, Rocket, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppLanguage } from '@/hooks/use-app-language';

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
  const greetingName = payload?.user?.name || businessName;
  const todayDate = new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const activeLeads = leads.filter((lead) => lead.stage !== 'won');
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

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-b-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="rounded-[28px] bg-[#040810] px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">✦ Nexora · {businessName}</p>
          <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[34px] xl:text-[38px]">
            {language === 'en'
              ? `Hi, ${greetingName}. ${activeLeads.length} new leads are waiting today.`
              : `Hola, ${greetingName}. ${activeLeads.length} leads nuevos esperan hoy.`}
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            {todayDate} · {language === 'en' ? 'AI Agent online and monitoring responses.' : 'AI Agent online y monitoreando respuestas.'}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              `✦ Plan ${payload?.user?.entitlements?.marketingLabel || 'Scale'}`,
              connectedMap.whatsapp ? 'WhatsApp activo' : 'WhatsApp pendiente',
              'AI Agent activo',
              `${studio?.usage?.creditsRemaining || 0} créditos`,
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
                  {urgentLead.nextAction || 'Retómalo hoy. Tiene intención alta y todavía está caliente.'}
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: language === 'en' ? 'Active leads' : 'Leads activos',
            value: activeLeads.length,
            tone: 'text-cyan-300',
            sub: language === 'en' ? 'Open opportunities' : 'Oportunidades abiertas',
          },
          {
            label: language === 'en' ? 'Conversations today' : 'Conversaciones hoy',
            value: conversations.length,
            tone: 'text-white',
            sub: language === 'en' ? 'Inbox needing replies' : 'Inbox con movimiento',
          },
          {
            label: language === 'en' ? 'Closed this month' : 'Cierres este mes',
            value: `${payload?.overviewFunnel?.crmWon || 0} · $${revenueClosed.toLocaleString()}`,
            tone: 'text-emerald-300',
            sub: language === 'en' ? 'Revenue captured' : 'Revenue capturado',
          },
          {
            label: language === 'en' ? 'Studio assets' : 'Assets Studio',
            value: `${studio?.jobs?.length || 0} · ${studio?.usage?.creditsRemaining || 0}`,
            tone: 'text-violet-300',
            sub: language === 'en' ? 'Generated + remaining credits' : 'Generados + créditos restantes',
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
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">Pipeline feed</h2>
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
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">Live inbox</h2>
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
                  <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] text-rose-300">Hot</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">
                  {lead.nextAction || 'Pendiente de respuesta. El AI Agent recomienda retomar con una propuesta concreta y CTA suave.'}
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
              `${activeLeads.length} leads abiertos en seguimiento activo.`,
              `${conversations.length} conversaciones piden respuesta hoy.`,
              `${studio?.jobs?.length || 0} assets generados en Nexora Studio.`,
            ].map((event, index) => (
              <div key={event} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 rounded-full ${index === 0 ? 'bg-cyan-400' : index === 1 ? 'bg-amber-400' : 'bg-violet-400'}`} />
                <div>
                  <p className="text-sm text-slate-200">{event}</p>
                  <p className="text-[11px] text-slate-500">{index === 0 ? 'Ahora' : index === 1 ? 'Hace 18 min' : 'Hace 1 h'}</p>
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

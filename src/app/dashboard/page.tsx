'use client';

import Link from 'next/link';
import {
  BarChart3,
  Bot,
  CreditCard,
  Lightbulb,
  PlugZap,
  Settings2,
  Sparkles,
  Target,
  Users2,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppLanguage } from '@/hooks/use-app-language';

interface DashboardUser {
  id: string;
  name?: string | null;
  email: string;
  founderAccess?: boolean;
  entitlements?: {
    marketingLabel: string;
    usage: {
      adAccounts: number;
      activeCampaigns: number;
      adAccountsLimit: number;
      activeCampaignsLimit: number;
      adAccountsRemaining: number;
      activeCampaignsRemaining: number;
    };
    capabilities: {
      aiCreditsMonthly: number;
      canUseRadar: boolean;
      canUseAdvancedAnalytics: boolean;
      canUseAutomationSuggestions: boolean;
      canUsePrioritySupport: boolean;
      canUseAiStudio: boolean;
      canUseVideoEditing: boolean;
      workspaceLimit: number;
      upgradeCta: string;
    };
  } | null;
  subscription?: {
    plan?: string | null;
    status?: string | null;
  } | null;
}

interface OverviewFunnel {
  crmLeads: number;
  leadCapturesOpen: number;
  crmWon: number;
}

export default function DashboardPage() {
  const { language } = useAppLanguage();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [overviewFunnel, setOverviewFunnel] = useState<OverviewFunnel>({
    crmLeads: 0,
    leadCapturesOpen: 0,
    crmWon: 0,
  });
  const [loading, setLoading] = useState(true);
  const [compactView, setCompactView] = useState(true);

  // Autopilot AI state
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [autopilotResult, setAutopilotResult] = useState<{
    title: string;
    message: string;
    nextSteps: string[];
    campaignDraft?: {
      name: string;
      objective: string;
      channel: string;
      budget: number;
      status: 'draft';
      launchWindow: string;
      hook: string;
      promise: string;
      cta: string;
      angle: string;
      checklist: string[];
    };
  } | null>(null);
  const [autopilotDraftSaved, setAutopilotDraftSaved] = useState(false);
  const [autopilotSavingDraft, setAutopilotSavingDraft] = useState(false);
  const [autopilotProvider, setAutopilotProvider] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }

        const data = await response.json();
        setUser(data.user);
        setAdAccounts(data.adAccounts || []);
        setCampaigns(data.campaigns || []);
        const of = data.overviewFunnel as OverviewFunnel | undefined;
        if (
          of &&
          typeof of.crmLeads === 'number' &&
          typeof of.leadCapturesOpen === 'number' &&
          typeof of.crmWon === 'number'
        ) {
          setOverviewFunnel(of);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        window.location.href = '/auth/login';
      } finally {
        setLoading(false);
      }
    };

    void fetchUserData();
  }, []);

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active');
  const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.analytics?.spend || 0), 0);
  const totalRevenue = campaigns.reduce((sum, campaign) => sum + (campaign.analytics?.revenue || 0), 0);
  const roi = totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 100) : 0;
  const leadsInFunnel = overviewFunnel.crmLeads + overviewFunnel.leadCapturesOpen;
  const closedWon = overviewFunnel.crmWon;
  const entitlements = user?.entitlements;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Cargando panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#080e1a]">
      <section className="overflow-hidden rounded-2xl border border-white/6 bg-gradient-to-br from-slate-900 to-[#080e1a] px-8 py-10 text-white shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">
              {language === 'en' ? 'Overview' : 'Resumen'}
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
              {language === 'en'
                ? `Welcome, ${user?.name || user?.email}. Let’s turn clarity into real growth.`
                : `Bienvenida, ${user?.name || user?.email}. Vamos a convertir claridad en crecimiento real.`}
            </h1>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-white/6 bg-slate-800/50 px-4 py-2 text-sm text-slate-200">
                {language === 'en' ? 'Plan' : 'Plan'}{' '}
                {entitlements?.marketingLabel || user?.subscription?.plan || 'starter'}
              </span>
              <span className="rounded-full border border-white/6 bg-slate-800/50 px-4 py-2 text-sm text-slate-200">
                {entitlements?.capabilities.aiCreditsMonthly || 0}{' '}
                {language === 'en' ? 'AI credits / month' : 'créditos IA/mes'}
              </span>
              {user?.founderAccess && (
                <span className="rounded-full border border-white/6 bg-slate-800/50 px-4 py-2 text-sm text-slate-200">
                  {language === 'en' ? 'Founder mode active' : 'Modo fundadora activo'}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">
              {language === 'en' ? 'Next best action' : 'Siguiente mejor acción'}
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {entitlements?.capabilities?.canUseAdvancedAnalytics
                ? language === 'en'
                  ? 'Open funnel and sales flow to prioritize the contacts with the highest probable value.'
                  : 'Abrir funnel y flujo de ventas para priorizar los contactos con más valor probable.'
                : language === 'en'
                  ? 'Connect your first account and unlock the next level of the platform.'
                  : 'Conectar tu primera cuenta y desbloquear el siguiente nivel del panel.'}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {entitlements?.capabilities?.canUseAdvancedAnalytics
                ? language === 'en'
                  ? 'If the funnel is already generating attention, the next leap comes from working opportunities, follow-up and creativity with a better rhythm.'
                  : 'Si el embudo ya genera atención, el siguiente salto viene de trabajar oportunidades, seguimiento y creatividad con mejor ritmo.'
                : entitlements?.capabilities?.upgradeCta}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={
                  entitlements?.capabilities?.canUseAdvancedAnalytics
                    ? '/dashboard/clientes/pipeline'
                    : '/dashboard/billing'
                }
                className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                {entitlements?.capabilities?.canUseAdvancedAnalytics
                  ? language === 'en'
                    ? 'Open revenue flow'
                    : 'Abrir motor de ventas'
                  : language === 'en'
                    ? 'View plan options'
                    : 'Ver opciones de plan'}
              </Link>
              <Link
                href="/dashboard/studio"
                className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Abrir Nexora Studio
              </Link>
              <button
                type="button"
                onClick={() => setCompactView((current) => !current)}
                className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {compactView ? 'Ver panel completo' : 'Ver panel compacto'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/6 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            {language === 'en' ? 'Connected accounts' : 'Cuentas conectadas'}
          </p>
          <p className="mt-3 text-3xl font-bold text-white">{adAccounts.length}</p>
          <p className="mt-2 text-xs text-slate-500">
            de {entitlements?.usage.adAccountsLimit || 1} disponibles
          </p>
        </div>
        <div className="rounded-2xl border border-white/6 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            {language === 'en' ? 'Active campaigns' : 'Campañas activas'}
          </p>
          <p className="mt-3 text-3xl font-bold text-white">{activeCampaigns.length}</p>
          <p className="mt-2 text-xs text-slate-500">
            de {entitlements?.usage.activeCampaignsLimit || 3} disponibles
          </p>
        </div>
        <div className="rounded-2xl border border-white/6 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            {language === 'en' ? 'Leads in funnel' : 'Leads en embudo'}
          </p>
          <p className="mt-3 text-3xl font-bold text-white">{leadsInFunnel}</p>
          <p className="mt-2 text-xs text-slate-500">
            {language === 'en' ? 'CRM + active captures' : 'CRM + capturas activas'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/6 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            {language === 'en' ? 'Estimated ROI' : 'ROI estimado'}
          </p>
          <p className="mt-3 text-3xl font-bold text-white">{roi}%</p>
          <p className="mt-2 text-xs text-slate-500">
            {language === 'en' ? 'Based on current performance' : 'Basado en el rendimiento actual'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/6 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            {language === 'en' ? 'Closed won' : 'Cierres ganados'}
          </p>
          <p className="mt-3 text-3xl font-bold text-white">{closedWon}</p>
          <p className="mt-2 text-xs text-slate-500">Lectura rápida del embudo</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Link href="/dashboard/clientes/pipeline" className="group block xl:col-span-1">
          <div className="h-full rounded-2xl border border-white/6 bg-slate-900 p-8 transition group-hover:border-cyan-400/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
              <Target className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-white">Motor de ventas</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Ve todos los leads y oportunidades en una sola vista Kanban, desde entrada hasta cierre.
            </p>
          </div>
        </Link>

        <Link href="/dashboard/clientes/pipeline" className="group block xl:col-span-1">
          <div className="h-full rounded-2xl border border-white/6 bg-slate-900 p-8 transition group-hover:border-cyan-400/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
              <Users2 className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-white">
              Seguimiento comercial inteligente
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Prioriza contactos, mueve oportunidades por etapa y ejecuta seguimiento con foco en cierre.
            </p>
          </div>
        </Link>

        <Link href="/dashboard/studio" className="group block xl:col-span-1">
          <div className="h-full rounded-2xl border border-white/6 bg-slate-900 p-8 transition group-hover:border-cyan-400/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
              <WandSparkles className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-white">
              Nexora Studio para contenido y performance
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Genera hooks, briefs, guiones UGC, repurpose multicanal y estructuras de edición con créditos renovables.
            </p>
          </div>
        </Link>
      </section>

      {!compactView && (
        <section className="grid gap-5 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/6 bg-slate-900 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Workspaces</p>
            <p className="mt-3 text-3xl font-bold text-white">
              {entitlements?.capabilities.workspaceLimit || 1}
            </p>
          </div>
          <div className="rounded-2xl border border-white/6 bg-slate-900 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Analítica avanzada
            </p>
            <p className="mt-3 text-3xl font-bold text-white">
              {entitlements?.capabilities.canUseAdvancedAnalytics ? 'Activa' : 'Bloqueada'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/6 bg-slate-900 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Automatizaciones
            </p>
            <p className="mt-3 text-3xl font-bold text-white">
              {entitlements?.capabilities.canUseAutomationSuggestions ? 'Activas' : 'Upgrade'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/6 bg-slate-900 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Soporte</p>
            <p className="mt-3 text-3xl font-bold text-white">
              {entitlements?.capabilities.canUsePrioritySupport ? 'Prioritario' : 'Email'}
            </p>
          </div>
        </section>
      )}

      <section className="grid gap-5 md:grid-cols-5">
        <Link
          href="/dashboard/connect"
          className="rounded-2xl border border-white/6 bg-slate-900 p-6 transition hover:border-cyan-400/30"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <PlugZap className="h-5 w-5" />
          </div>
          <p className="mt-4 text-lg font-semibold text-white">Command Center</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Gestiona canales, campañas e inteligencia activa desde una sola pantalla.
          </p>
        </Link>
        <Link
          href="/dashboard/campaigns"
          className="rounded-2xl border border-white/6 bg-slate-900 p-6 transition hover:border-cyan-400/30"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <BarChart3 className="h-5 w-5" />
          </div>
          <p className="mt-4 text-lg font-semibold text-white">Campañas</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Revisa ejecución, presupuesto y resultados desde un solo lugar.
          </p>
        </Link>
        <Link
          href="/dashboard/studio"
          className="rounded-2xl border border-white/6 bg-slate-900 p-6 transition hover:border-cyan-400/30"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="mt-4 text-lg font-semibold text-white">Nexora Studio</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Crea piezas, guiones y estructura de edición con créditos mensuales.
          </p>
        </Link>
        <Link
          href="/dashboard/billing"
          className="rounded-2xl border border-white/6 bg-slate-900 p-6 transition hover:border-cyan-400/30"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <CreditCard className="h-5 w-5" />
          </div>
          <p className="mt-4 text-lg font-semibold text-white">Facturación</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Mantén control sobre plan, pagos y expansión de la operación.
          </p>
        </Link>
        <Link
          href="/dashboard/settings"
          className="rounded-2xl border border-white/6 bg-slate-900 p-6 transition hover:border-cyan-400/30"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <Settings2 className="h-5 w-5" />
          </div>
          <p className="mt-4 text-lg font-semibold text-white">Configuración</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Ajusta integraciones, preferencias y estructura de la cuenta.
          </p>
        </Link>
      </section>

      {!compactView && (
        <section className="rounded-2xl border border-white/6 bg-slate-900 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Lectura rápida del sistema</h2>
              <p className="text-sm text-slate-400">Una vista útil para saber qué empujar primero.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/6 bg-[#080e1a] p-4">
              <p className="text-sm font-semibold text-white">Si tienes pocas cuentas conectadas</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Prioriza conectar las plataformas que ya generan demanda para que el Command Center y el pipeline lean mejor tus oportunidades.
              </p>
            </div>
            <div className="rounded-2xl border border-white/6 bg-[#080e1a] p-4">
              <p className="text-sm font-semibold text-white">Si el ROI todavía es bajo</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Ajusta el mensaje antes que aumentar presupuesto. Nexora Studio e Inteligencia Activa te ayudan a trabajar el ángulo correcto.
              </p>
            </div>
            <div className="rounded-2xl border border-white/6 bg-[#080e1a] p-4">
              <p className="text-sm font-semibold text-white">Si quieres vender más rápido</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Abre el pipeline, identifica las oportunidades con más valor y activa seguimiento comercial con una narrativa consistente.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { BarChart3, CreditCard, Lightbulb, PlugZap, Settings2, Sparkles, Target, Users2, WandSparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

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

export default function DashboardPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  const totalClicks = campaigns.reduce((sum, campaign) => sum + (campaign.analytics?.clicks || 0), 0);
  const totalConversions = campaigns.reduce((sum, campaign) => sum + (campaign.analytics?.conversions || 0), 0);
  const roi = totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 100) : 0;
  const estimatedLeads = totalConversions > 0 ? totalConversions : Math.max(1, Math.round(totalClicks * 0.08));
  const estimatedWins = Math.max(0, Math.round(estimatedLeads * 0.18));
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
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#0f172a_0%,#111827_54%,#0c4a6e_100%)] px-8 py-10 text-white shadow-[0_35px_120px_rgba(15,23,42,0.22)]">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">Panel de control</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              Bienvenida, {user?.name || user?.email}. Vamos a convertir claridad en crecimiento real.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Nexora reúne campañas, funnel, CRM, facturación y una capa creativa con IA para que puedas decidir más
              rápido, ejecutar mejor y cerrar con más control.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm">
                Plan {entitlements?.marketingLabel || user?.subscription?.plan || 'starter'}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm">
                {entitlements?.capabilities.aiCreditsMonthly || 0} créditos IA/mes
              </span>
              {user?.founderAccess && (
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                  Modo fundadora activo
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-sm text-slate-300">Siguiente mejor acción</p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {entitlements?.capabilities?.canUseAdvancedAnalytics
                ? 'Abrir funnel y CRM para priorizar los contactos con más valor probable.'
                : 'Conectar tu primera cuenta y desbloquear el siguiente nivel del panel.'}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {entitlements?.capabilities?.canUseAdvancedAnalytics
                ? 'Si el embudo ya genera atención, el siguiente salto viene de trabajar oportunidades, seguimiento y creatividad con mejor ritmo.'
                : entitlements?.capabilities?.upgradeCta}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={entitlements?.capabilities?.canUseAdvancedAnalytics ? '/dashboard/funnel' : '/dashboard/billing'}
                className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                {entitlements?.capabilities?.canUseAdvancedAnalytics ? 'Abrir funnel comercial' : 'Ver opciones de plan'}
              </Link>
              <Link href="/dashboard/studio" className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                Abrir AI Studio
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Cuentas conectadas</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{adAccounts.length}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">
            de {entitlements?.usage.adAccountsLimit || 1} disponibles
          </p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Campañas activas</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{activeCampaigns.length}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">
            de {entitlements?.usage.activeCampaignsLimit || 3} disponibles
          </p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Leads estimados</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{estimatedLeads}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">Basados en clics y conversiones</p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">ROI estimado</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{roi}%</p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Ventas probables</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{estimatedWins}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">Lectura rápida del embudo</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Link href="/dashboard/funnel" className="group block xl:col-span-1">
          <div className="h-full rounded-[32px] border border-indigo-200 bg-[linear-gradient(180deg,#eef2ff_0%,#ffffff_58%,#f8fafc_100%)] p-8 shadow-[0_18px_60px_rgba(79,70,229,0.08)] transition group-hover:-translate-y-1 group-hover:shadow-[0_26px_70px_rgba(79,70,229,0.12)]">
            <Target className="h-12 w-12 text-indigo-600" />
            <h2 className="mt-6 text-2xl font-semibold text-slate-900">Funnel comercial</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Mira cuántas ventas probables puedes cerrar con tus contactos actuales y dónde se está cayendo el proceso.
            </p>
          </div>
        </Link>

        <Link href="/dashboard/crm" className="group block xl:col-span-1">
          <div className="h-full rounded-[32px] border border-violet-200 bg-[linear-gradient(180deg,#f5f3ff_0%,#ffffff_60%,#f8fafc_100%)] p-8 shadow-[0_18px_60px_rgba(124,58,237,0.08)] transition group-hover:-translate-y-1 group-hover:shadow-[0_26px_70px_rgba(124,58,237,0.12)]">
            <Users2 className="h-12 w-12 text-violet-600" />
            <h2 className="mt-6 text-2xl font-semibold text-slate-900">CRM para seguimiento y cierre</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Organiza contactos, mueve oportunidades por etapa y trabaja seguimiento comercial desde una sola interfaz.
            </p>
          </div>
        </Link>

        <Link href="/dashboard/studio" className="group block xl:col-span-1">
          <div className="h-full rounded-[32px] border border-amber-200 bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_60%,#f8fafc_100%)] p-8 shadow-[0_18px_60px_rgba(251,146,60,0.1)] transition group-hover:-translate-y-1 group-hover:shadow-[0_26px_70px_rgba(251,146,60,0.14)]">
            <WandSparkles className="h-12 w-12 text-amber-600" />
            <h2 className="mt-6 text-2xl font-semibold text-slate-900">AI Studio para contenido y video</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Genera hooks, briefs, guiones UGC, repurpose multicanal y estructuras de edición con créditos renovables.
            </p>
          </div>
        </Link>
      </section>

      <section className="grid gap-5 xl:grid-cols-4">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Workspaces</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{entitlements?.capabilities.workspaceLimit || 1}</p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Analítica avanzada</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {entitlements?.capabilities.canUseAdvancedAnalytics ? 'Activa' : 'Bloqueada'}
          </p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Automatizaciones</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {entitlements?.capabilities.canUseAutomationSuggestions ? 'Activas' : 'Upgrade'}
          </p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Soporte</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {entitlements?.capabilities.canUsePrioritySupport ? 'Prioritario' : 'Email'}
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-5">
        <Link
          href="/dashboard/connect"
          className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.1)]"
        >
          <PlugZap className="h-10 w-10 text-orange-500" />
          <p className="mt-4 text-lg font-semibold text-slate-900">Conectar redes</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Suma Instagram, Facebook, Google o TikTok para leer mejor tus oportunidades.</p>
        </Link>
        <Link
          href="/dashboard/campaigns"
          className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.1)]"
        >
          <BarChart3 className="h-10 w-10 text-cyan-600" />
          <p className="mt-4 text-lg font-semibold text-slate-900">Campañas</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Revisa ejecución, presupuesto y resultados desde un solo lugar.</p>
        </Link>
        <Link
          href="/dashboard/studio"
          className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.1)]"
        >
          <Sparkles className="h-10 w-10 text-amber-500" />
          <p className="mt-4 text-lg font-semibold text-slate-900">AI Studio</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Crea piezas, guiones y estructura de edición con créditos mensuales.</p>
        </Link>
        <Link
          href="/dashboard/billing"
          className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.1)]"
        >
          <CreditCard className="h-10 w-10 text-slate-800" />
          <p className="mt-4 text-lg font-semibold text-slate-900">Facturación</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Mantén control sobre plan, pagos y expansión de la operación.</p>
        </Link>
        <Link
          href="/dashboard/settings"
          className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.1)]"
        >
          <Settings2 className="h-10 w-10 text-slate-800" />
          <p className="mt-4 text-lg font-semibold text-slate-900">Configuración</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Ajusta integraciones, preferencias y estructura de la cuenta.</p>
        </Link>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-8 w-8 text-amber-500" />
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Lectura rápida del sistema</h2>
            <p className="text-sm text-slate-500">Una vista útil para saber qué empujar primero.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Si tienes pocas cuentas conectadas</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Prioriza conectar las plataformas que ya generan demanda para que el radar, el funnel y el CRM lean mejor tus oportunidades.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Si el ROI todavía es bajo</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ajusta el mensaje antes que aumentar presupuesto. AI Studio y el radar creativo te ayudan a trabajar el ángulo correcto.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Si quieres vender más rápido</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Abre el funnel, identifica las oportunidades con más valor y activa seguimiento desde CRM con una narrativa consistente.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { BarChart3, CreditCard, Lightbulb, PlugZap, Settings2, Sparkles, Target, Users2 } from 'lucide-react';
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
      canUseRadar: boolean;
      canUseAdvancedAnalytics: boolean;
      canUseAutomationSuggestions: boolean;
      canUsePrioritySupport: boolean;
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
              Bienvenida, {user?.name || user?.email}. Vamos a convertir creatividad en crecimiento real.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Nexora concentra tus cuentas, campañas y una lectura estratégica del mercado para que puedas decidir más rápido y vender mejor.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm">
                Plan {entitlements?.marketingLabel || user?.subscription?.plan || 'starter'}
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
                ? 'Abrir el funnel y priorizar los contactos con más valor probable.'
                : 'Conectar tu primera cuenta y desbloquear el siguiente nivel del panel.'}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {entitlements?.capabilities?.canUseAdvancedAnalytics
                ? 'El funnel comercial traduce tráfico, leads y conversiones en oportunidades, forecast y siguientes acciones de cierre.'
                : entitlements?.capabilities?.upgradeCta}
            </p>
            <Link
              href={entitlements?.capabilities?.canUseAdvancedAnalytics ? '/dashboard/funnel' : '/dashboard/billing'}
              className="mt-6 inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              {entitlements?.capabilities?.canUseAdvancedAnalytics ? 'Abrir funnel comercial' : 'Ver opciones de plan'}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">Basados en clicks y conversiones</p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">ROI estimado</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{roi}%</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Link href="/dashboard/funnel" className="group block lg:col-span-2">
          <div className="h-full rounded-[32px] border border-indigo-200 bg-[linear-gradient(180deg,#eef2ff_0%,#ffffff_58%,#f8fafc_100%)] p-8 shadow-[0_18px_60px_rgba(79,70,229,0.08)] transition group-hover:-translate-y-1 group-hover:shadow-[0_26px_70px_rgba(79,70,229,0.12)]">
            <Target className="h-12 w-12 text-indigo-600" />
            <h2 className="mt-6 text-2xl font-semibold text-slate-900">Funnel comercial y forecast</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Mira cuántas ventas probables puedes cerrar con tus contactos actuales, dónde se cae el embudo y qué fuentes traen las oportunidades más valiosas.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-sm text-slate-500">Leads con potencial</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{estimatedLeads}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-sm text-slate-500">Ventas probables</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{estimatedWins}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-sm text-slate-500">Revenue observado</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">${totalRevenue.toFixed(0)}</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href={entitlements?.capabilities?.canUseRadar ? '/dashboard/radar' : '/dashboard/billing'} className="group block">
          <div className="h-full rounded-[32px] border border-cyan-200 bg-[linear-gradient(180deg,#f0fdfa_0%,#ffffff_58%,#eff6ff_100%)] p-8 shadow-[0_18px_60px_rgba(34,211,238,0.08)] transition group-hover:-translate-y-1 group-hover:shadow-[0_26px_70px_rgba(34,211,238,0.12)]">
            <Sparkles className="h-12 w-12 text-cyan-600" />
            <h2 className="mt-6 text-2xl font-semibold text-slate-900">
              {entitlements?.capabilities?.canUseRadar ? 'Radar creativo autoactualizable' : 'Desbloquea el radar creativo'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {entitlements?.capabilities?.canUseRadar
                ? 'Lee el momento comercial y devuelve hooks, formatos y campañas listas para lanzar con más claridad.'
                : 'Growth y Scale activan insights, hooks y sugerencias accionables para acelerar decisiones.'}
            </p>
          </div>
        </Link>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Link href="/dashboard/crm" className="group block">
          <div className="h-full rounded-[32px] border border-violet-200 bg-[linear-gradient(180deg,#f5f3ff_0%,#ffffff_60%,#f8fafc_100%)] p-8 shadow-[0_18px_60px_rgba(124,58,237,0.08)] transition group-hover:-translate-y-1 group-hover:shadow-[0_26px_70px_rgba(124,58,237,0.12)]">
            <Users2 className="h-12 w-12 text-violet-600" />
            <h2 className="mt-6 text-2xl font-semibold text-slate-900">CRM para seguimiento y cierre</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Guarda contactos, muévelos por etapa, asigna valor y sigue oportunidades desde un pipeline comercial pensado para vender cualquier servicio.
            </p>
          </div>
        </Link>

        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Sistema comercial</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">Conecta campañas, funnel y CRM en una sola operación</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            El objetivo es que tus clientes no solo atraigan leads, sino que además los trabajen, los conviertan en propuestas y los cierren sin salir de Nexora.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/crm" className="btn-primary">
              Abrir CRM
            </Link>
            <Link href="/dashboard/funnel" className="btn-secondary">
              Ver forecast
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-4">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Workspace</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{entitlements?.capabilities.workspaceLimit || 1} incluidos</p>
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

      <section className="grid gap-5 md:grid-cols-4">
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
              Prioriza conectar las plataformas que ya te generan interacción o demanda para que el radar y el funnel lean mejor tus oportunidades.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Si el ROI todavía es bajo</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ajusta el mensaje antes que aumentar presupuesto. Nexora ya te sugiere hooks y ángulos para eso en el radar.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Si quieres vender más rápido</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Abre el funnel comercial, identifica las oportunidades con más valor y crea seguimiento directo para cerrar antes.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

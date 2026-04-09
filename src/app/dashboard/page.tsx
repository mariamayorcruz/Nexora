'use client';

import Link from 'next/link';
import { BarChart3, CreditCard, Lightbulb, PlugZap, Settings2, Sparkles } from 'lucide-react';
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

    fetchUserData();
  }, []);

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active');
  const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.analytics?.spend || 0), 0);
  const totalRevenue = campaigns.reduce((sum, campaign) => sum + (campaign.analytics?.revenue || 0), 0);
  const roi = totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 100) : 0;
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
      <section className="rounded-[32px] bg-slate-950 px-8 py-10 text-white shadow-2xl shadow-slate-950/20">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">Panel de control</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              Bienvenida, {user?.name || user?.email}. Vamos a convertir creatividad en crecimiento real.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Nexora concentra tus cuentas, campanas y una lectura estrategica del mercado para que puedas decidir
              mas rapido y vender mejor.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm">
                Plan {entitlements?.marketingLabel || user?.subscription?.plan || 'starter'}
              </span>
              {user?.founderAccess && (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                  Modo fundadora activo
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-sm text-slate-300">Siguiente mejor accion</p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {entitlements?.capabilities?.canUseRadar
                ? 'Activar el radar creativo y bajar una campana nueva.'
                : 'Conectar tu primera cuenta y desbloquear el siguiente nivel del panel.'}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {entitlements?.capabilities?.canUseRadar
                ? 'El radar traduce cuentas, rendimiento y contexto comercial en hooks, angulos y rutas de ejecucion para que no dependas de intuiciones aisladas.'
                : entitlements?.capabilities?.upgradeCta}
            </p>
            <Link
              href={entitlements?.capabilities?.canUseRadar ? '/dashboard/radar' : '/dashboard/billing'}
              className="mt-6 inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              {entitlements?.capabilities?.canUseRadar ? 'Abrir radar creativo' : 'Ver opciones de plan'}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Cuentas conectadas</p>
          <p className="mt-3 text-4xl font-semibold text-gray-900">{adAccounts.length}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-gray-400">
            de {entitlements?.usage.adAccountsLimit || 1} disponibles
          </p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Campanas activas</p>
          <p className="mt-3 text-4xl font-semibold text-gray-900">{activeCampaigns.length}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-gray-400">
            de {entitlements?.usage.activeCampaignsLimit || 3} disponibles
          </p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Gasto registrado</p>
          <p className="mt-3 text-4xl font-semibold text-gray-900">${totalSpend.toFixed(0)}</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">ROI estimado</p>
          <p className="mt-3 text-4xl font-semibold text-gray-900">{roi}%</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Link href={entitlements?.capabilities?.canUseRadar ? '/dashboard/radar' : '/dashboard/billing'} className="group block">
          <div className="h-full rounded-[30px] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-8 transition group-hover:-translate-y-1 group-hover:shadow-xl">
            <Sparkles className="h-12 w-12 text-cyan-600" />
            <h2 className="mt-6 text-2xl font-semibold text-gray-900">
              {entitlements?.capabilities?.canUseRadar ? 'Radar creativo auto-actualizable' : 'Desbloquea el radar creativo'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {entitlements?.capabilities?.canUseRadar
                ? 'Lee el momento comercial y devuelve hooks, formatos y campanas listas para lanzar con mas claridad.'
                : 'Growth y Scale activan insights, hooks y sugerencias accionables para acelerar decisiones.'}
            </p>
          </div>
        </Link>

        <Link href="/dashboard/connect" className="group block">
          <div className="h-full rounded-[30px] border border-gray-200 bg-white p-8 transition group-hover:-translate-y-1 group-hover:shadow-xl">
            <PlugZap className="h-12 w-12 text-orange-500" />
            <h2 className="mt-6 text-2xl font-semibold text-gray-900">Conectar nuevas cuentas</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Suma Instagram, Facebook, Google o TikTok para que Nexora lea mejor donde conviene invertir energia.
            </p>
          </div>
        </Link>
      </section>

      <section className="grid gap-5 xl:grid-cols-4">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Workspace</p>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {entitlements?.capabilities.workspaceLimit || 1} incluidos
          </p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Analitica avanzada</p>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {entitlements?.capabilities.canUseAdvancedAnalytics ? 'Activa' : 'Bloqueada'}
          </p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Automatizaciones</p>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {entitlements?.capabilities.canUseAutomationSuggestions ? 'Activas' : 'Upgrade'}
          </p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Soporte</p>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {entitlements?.capabilities.canUsePrioritySupport ? 'Prioritario' : 'Email'}
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <Link href="/dashboard/campaigns" className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <BarChart3 className="h-10 w-10 text-cyan-600" />
          <p className="mt-4 text-lg font-semibold text-gray-900">Campanas</p>
          <p className="mt-2 text-sm leading-6 text-gray-600">Revisa ejecucion, presupuesto y resultados desde un solo lugar.</p>
        </Link>
        <Link href="/dashboard/billing" className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <CreditCard className="h-10 w-10 text-gray-800" />
          <p className="mt-4 text-lg font-semibold text-gray-900">Facturacion</p>
          <p className="mt-2 text-sm leading-6 text-gray-600">Mantiene control sobre plan, pagos y expansion de la operacion.</p>
        </Link>
        <Link href="/dashboard/settings" className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <Settings2 className="h-10 w-10 text-gray-800" />
          <p className="mt-4 text-lg font-semibold text-gray-900">Configuracion</p>
          <p className="mt-2 text-sm leading-6 text-gray-600">Ajusta integraciones, preferencias y estructura de la cuenta.</p>
        </Link>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-8 w-8 text-amber-500" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Lectura rapida del sistema</h2>
            <p className="text-sm text-gray-500">Una vista util para saber que empujar primero.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">Si tienes pocas cuentas conectadas</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Prioriza conectar las plataformas que ya te generan interaccion o demanda para que el radar lea mejor tus oportunidades.
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">Si el ROI todavia es bajo</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Ajusta el mensaje antes que aumentar presupuesto. Nexora ya te sugiere hooks y angulos para eso en el radar.
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">Si quieres vender mas rapido</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Lanza una campana corta con una sola promesa fuerte, prueba visible y un CTA directo hacia demo o contacto.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

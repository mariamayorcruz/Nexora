'use client';

import Link from 'next/link';
import { AlertCircle, Command, Plus, Rocket, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type AdminAlert = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  actionLabel?: string;
  actionHref?: string;
};

type AdminStats = {
  totalRevenue: number;
  monthlyRevenue: number;
  mrr: number;
  alerts: AdminAlert[];
  recentUsers: Array<{ id: string; email: string; name?: string | null; createdAt: string }>;
};

type Campaign = {
  id: string;
  name: string;
  platform: string;
  status: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  user: {
    name: string;
    email: string;
  };
};

function leadStatus(createdAt: string) {
  const diffHours = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
  if (diffHours <= 24) return 'nuevo';
  if (diffHours <= 72) return 'contactado';
  return 'propuesta';
}

export default function AdminOperacionPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const [statsResponse, campaignsResponse] = await Promise.all([
          fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
          fetch('/api/admin/campaigns', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
        ]);

        const statsData = await statsResponse.json();
        const campaignsData = await campaignsResponse.json();
        setStats(statsData.stats || null);
        setCampaigns(campaignsData.campaigns || []);
      } catch (error) {
        console.error('Error loading admin operation center:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const activeCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.status === 'active').slice(0, 4), [campaigns]);
  const recentLeads = useMemo(() => (stats?.recentUsers || []).slice(0, 6), [stats?.recentUsers]);
  const urgentAlerts = useMemo(() => (stats?.alerts || []).slice(0, 3), [stats?.alerts]);
  const newLeads = recentLeads.filter((lead) => leadStatus(lead.createdAt) === 'nuevo').length;

  if (loading) {
    return <div className="py-12 text-center text-slate-500">Cargando centro de operaciones...</div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Centro de Operaciones</h1>
          <p className="text-sm text-slate-400">Todo el negocio en tiempo real</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/connect" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500">
            + Crear Campaña
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 rounded-xl border border-slate-800 bg-gradient-to-br from-cyan-600 to-blue-700 p-5 text-white xl:col-span-3">
          <p className="text-sm opacity-80">MRR Mensual</p>
          <p className="mt-1 text-3xl font-bold">${stats?.mrr.toLocaleString() || 0}</p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <TrendingUp size={16} />
            <span>${stats?.monthlyRevenue.toLocaleString() || 0} cobrados este mes</span>
          </div>
        </section>

        <section className="col-span-12 rounded-xl border border-slate-800 bg-slate-900 p-5 xl:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <Command size={18} className="text-cyan-400" />
              Pipeline Activo
            </h2>
            <span className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-400">{newLeads} nuevos</span>
          </div>

          <div className="space-y-2">
            {recentLeads.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">No hay leads recientes. El siguiente paso es activar captación y automatizaciones.</div>
            ) : (
              recentLeads.map((lead) => {
                const status = leadStatus(lead.createdAt);
                const dot = status === 'nuevo' ? 'bg-emerald-400' : status === 'contactado' ? 'bg-blue-400' : 'bg-amber-400';
                const elapsed = Math.max(1, Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60)));
                return (
                  <div key={lead.id} className="group flex cursor-pointer items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/50 p-3 transition hover:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${dot}`} />
                      <div>
                        <p className="text-sm font-medium text-white transition group-hover:text-cyan-400">{lead.name || lead.email}</p>
                        <p className="text-xs text-slate-500">Signup • {elapsed}h</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-slate-300">$0</p>
                      <p className="text-[10px] uppercase text-slate-500">{status}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Link href="/admin/clientes" className="mt-4 block rounded-lg border border-dashed border-slate-700 py-2 text-center text-sm text-cyan-400 transition hover:border-cyan-500/50 hover:text-cyan-300">
            Ver clientes completo →
          </Link>
        </section>

        <section className="col-span-12 rounded-xl border border-slate-800 bg-slate-900 p-5 xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <Rocket size={18} className="text-purple-400" />
              Campañas en Vivo
            </h2>
          </div>

          <div className="space-y-3">
            {activeCampaigns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">No hay campañas activas. Usa Command Center para lanzar la primera.</div>
            ) : (
              activeCampaigns.map((campaign) => {
                const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(1) : '0.0';
                return (
                  <div key={campaign.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{campaign.name}</p>
                        <p className="text-xs text-slate-500">{campaign.platform} • Presupuesto: ${campaign.budget}/día</p>
                      </div>
                      <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400">Activa</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-700/50 pt-3">
                      <div>
                        <p className="text-lg font-bold text-white">{campaign.impressions.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500">Impresiones</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{campaign.clicks}</p>
                        <p className="text-[10px] text-slate-500">Clics</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-400">{ctr}%</p>
                        <p className="text-[10px] text-slate-500">CTR</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="col-span-12 rounded-xl border border-slate-800 bg-slate-900 p-5 xl:col-span-3">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
            <AlertCircle size={16} className="text-amber-400" />
            Atención Requerida
          </h3>
          <div className="space-y-3">
            {urgentAlerts.length === 0 ? (
              <div className="rounded-lg bg-slate-800 p-3 text-sm text-slate-500">Sin alertas críticas ahora mismo.</div>
            ) : (
              urgentAlerts.map((alert) => (
                <div key={alert.id} className={`rounded-lg border p-3 ${alert.severity === 'high' ? 'border-amber-500/20 bg-amber-500/10' : 'border-slate-700 bg-slate-800'}`}>
                  <p className={`text-sm ${alert.severity === 'high' ? 'text-amber-200' : 'text-slate-300'}`}>{alert.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{alert.detail}</p>
                  {alert.actionHref ? <Link href={alert.actionHref} className="mt-1 inline-block text-xs text-cyan-400 hover:underline">{alert.actionLabel || 'Resolver ahora'}</Link> : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

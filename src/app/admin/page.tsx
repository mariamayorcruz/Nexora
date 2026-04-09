'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AdminAlert {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  actionLabel?: string;
  actionHref?: string;
}

interface AutomationPlay {
  id: string;
  title: string;
  summary: string;
  trigger: string;
  action: string;
  cadence: string;
  priority: 'high' | 'medium' | 'low';
}

interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalCampaigns: number;
  activeCampaigns: number;
  recentUsers: Array<{ id: string; email: string; name?: string | null; createdAt: string }>;
  recentPayments: Array<{ id: string; amount: number; createdAt: string; userId: string }>;
  mrr: number;
  healthScore: number;
  alerts: AdminAlert[];
  automationPlays: AutomationPlay[];
  paymentReadiness: {
    stripe: boolean;
    webhookStored: boolean;
  };
  emailReadiness: {
    smtpReady: boolean;
    senderReady: boolean;
    supportEmailReady: boolean;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const readinessItems: Array<{ label: string; value: boolean }> = stats
    ? [
        { label: 'Stripe', value: stats.paymentReadiness.stripe },
        { label: 'Webhook guardado', value: stats.paymentReadiness.webhookStored },
        { label: 'SMTP', value: stats.emailReadiness.smtpReady },
        { label: 'Sender email', value: stats.emailReadiness.senderReady },
        { label: 'Support email', value: stats.emailReadiness.supportEmailReady },
      ]
    : [];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setStats(data.stats);
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!stats) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">No pudimos cargar el panel admin.</div>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">Admin control center</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">La operación de Nexora en una sola lectura.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Aquí puedes ver salud de negocio, monetización, funnel, automatizaciones y lifecycle sin saltar entre módulos.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/admin/funnel" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
                Ver funnel
              </Link>
              <Link href="/admin/automation" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white">
                Ver automatización
              </Link>
              <Link href="/admin/emails" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white">
                Ver email center
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">Health score</p>
            <p className="mt-3 text-5xl font-semibold text-white">{stats.healthScore}</p>
            <p className="mt-4 text-sm text-slate-300">
              MRR estimado: ${stats.mrr.toLocaleString()} y {stats.alerts.length} alertas activas para revisar.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['Usuarios', stats.totalUsers],
          ['Suscripciones activas', stats.activeSubscriptions],
          ['MRR', `$${stats.mrr}`],
          ['Revenue total', `$${stats.totalRevenue}`],
          ['Campañas activas', stats.activeCampaigns],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Alertas</p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">Lo que requiere atención</h2>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {stats.alerts.length} activas
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {stats.alerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{alert.detail}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                      alert.severity === 'high'
                        ? 'bg-red-50 text-red-600'
                        : alert.severity === 'medium'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
                {alert.actionHref && alert.actionLabel && (
                  <Link href={alert.actionHref} className="mt-4 inline-flex text-sm font-semibold text-primary">
                    {alert.actionLabel}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Readiness</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Piezas críticas de la operación</h2>

          <div className="mt-6 space-y-4">
            {readinessItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-4">
                <span className="font-medium text-gray-800">{item.label}</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    item.value ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {item.value ? 'listo' : 'pendiente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Automatización</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">Playbooks inteligentes listos para operar</h2>
          </div>
          <Link href="/admin/automation" className="text-sm font-semibold text-primary">
            Abrir centro
          </Link>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {stats.automationPlays.map((play) => (
            <article key={play.id} className="rounded-2xl bg-gray-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-900">{play.title}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    play.priority === 'high'
                      ? 'bg-red-50 text-red-600'
                      : play.priority === 'medium'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {play.priority}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600">{play.summary}</p>
              <p className="mt-4 text-sm text-gray-500">Trigger: {play.trigger}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type AdminStatsPayload = {
  stats?: {
    mrr?: number;
    activeSubscriptions?: number;
    totalUsers?: number;
    monthlyRevenue?: number;
    totalRevenue?: number;
    funnel?: {
      captured?: number;
      won?: number;
      conversions?: Array<{ email: string; plan?: string | null; revenue?: number }>;
      recent?: Array<{ email: string; source?: string; plan?: string | null; revenue?: number; subscriptionStatus?: string | null }>;
    };
    business?: {
      conversionRate?: number;
    };
    alerts?: Array<{ title?: string; detail?: string }>;
    automationPlays?: Array<{ title?: string; summary?: string }>;
  };
};

export default function AdminRootPage() {
  const [payload, setPayload] = useState<AdminStatsPayload>({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    void fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => setPayload(data))
      .catch(() => setPayload({}));
  }, []);

  const stats = payload.stats;
  const churnRate = useMemo(() => {
    const total = Number(stats?.totalUsers || 0);
    const active = Number(stats?.activeSubscriptions || 0);
    if (!total) return 0;
    return Math.max(0, Math.round(((total - active) / total) * 100));
  }, [stats?.activeSubscriptions, stats?.totalUsers]);

  const trialToPaid = Math.round(Number(stats?.business?.conversionRate || 0) * 100);

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] bg-rose-500/10 px-5 py-3 text-sm font-medium text-rose-200">
        ADMIN · Nexora Internal
      </section>

      <section className="rounded-[28px] bg-[#040810] p-5">
        <div className="flex flex-wrap gap-2">
          {[
            { href: '/admin', label: 'Overview' },
            { href: '/admin/clientes', label: 'Clientes' },
            { href: '/admin/revenue', label: 'Revenue' },
            { href: '/admin/studio', label: 'Uso IA' },
            { href: '/admin/users', label: 'Usuarios' },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-3 py-1.5 text-xs transition-all duration-150 ${
                tab.href === '/admin' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-white/[0.03] text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'MRR', value: `$${Number(stats?.mrr || 0).toLocaleString()}`, tone: 'text-emerald-300' },
          { label: 'Clientes activos', value: Number(stats?.activeSubscriptions || 0), tone: 'text-white' },
          { label: 'Churn rate', value: `${churnRate}%`, tone: 'text-rose-300' },
          { label: 'AI calls/mes', value: Number(stats?.funnel?.captured || 0), tone: 'text-cyan-300' },
          { label: 'Trial → Paid', value: `${trialToPaid}%`, tone: 'text-amber-300' },
        ].map((item) => (
          <div key={item.label} className="rounded-[24px] bg-[#040810] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className={`mt-3 text-[28px] font-semibold tracking-[-0.03em] ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[28px] bg-[#040810] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Clientes</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">Tabla rápida</h2>
            </div>
            <Link href="/admin/clientes" className="text-xs text-cyan-300 transition hover:text-white">
              Abrir
            </Link>
          </div>
          <div className="overflow-x-auto rounded-[22px] bg-[#030610]">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr] gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <span>Nombre</span>
                <span>Plan</span>
                <span>MRR</span>
                <span>Estado</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {(stats?.funnel?.conversions || []).slice(0, 6).map((row) => (
                  <div key={row.email} className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr] gap-3 px-4 py-3 text-sm">
                    <span className="truncate text-white">{row.email}</span>
                    <span className="text-slate-300">{row.plan || 'starter'}</span>
                    <span className="text-emerald-300">${Number(row.revenue || 0).toLocaleString()}</span>
                    <span className="text-cyan-300">active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] bg-[#040810] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Uso IA</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Groq calls', value: Number(stats?.funnel?.captured || 0) },
                { label: 'fal.ai status', value: 'live' },
                { label: 'n8n runs', value: (stats?.automationPlays || []).length },
                { label: 'Twilio status', value: 'pending' },
              ].map((item) => (
                <div key={item.label} className="rounded-[20px] bg-[#030610] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] bg-[#040810] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Actividad reciente</p>
            <div className="mt-4 space-y-3">
              {[...(stats?.alerts || []), ...(stats?.automationPlays || [])].slice(0, 6).map((item, index) => {
                const description = 'detail' in item ? item.detail : 'summary' in item ? item.summary : undefined;
                return (
                  <div key={`${item.title}-${index}`} className="rounded-[20px] bg-[#030610] px-4 py-3">
                    <div className="flex gap-3">
                      <span className={`mt-1.5 h-2 w-2 rounded-full ${index % 2 === 0 ? 'bg-cyan-400' : 'bg-amber-400'}`} />
                      <div>
                        <p className="text-sm text-slate-200">{item.title || 'Evento del sistema'}</p>
                        <p className="text-[11px] text-slate-500">{description || 'Sin detalle adicional.'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

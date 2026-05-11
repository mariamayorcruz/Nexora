'use client';

import { useEffect, useState } from 'react';

interface RevenueData {
  mrr: number;
  arr: number;
  totalRevenue: number;
  activeSubscriptions: number;
  churnRate: number;
  trialToPaid: number;
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    void fetch('/api/admin/revenue', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => setData(json.revenue || null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-b-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-rose-300">✦ Admin · Revenue</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white">
          Revenue & Suscripciones
        </h1>
        <p className="mt-1 text-sm text-slate-500">MRR, ARR, churn y conversión de trials.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: 'MRR', value: `$${(data?.mrr || 0).toLocaleString()}`, color: 'text-emerald-400' },
          { label: 'ARR', value: `$${(data?.arr || 0).toLocaleString()}`, color: 'text-emerald-400' },
          { label: 'Revenue total', value: `$${(data?.totalRevenue || 0).toLocaleString()}`, color: 'text-white' },
          { label: 'Suscripciones activas', value: data?.activeSubscriptions || 0, color: 'text-cyan-400' },
          { label: 'Churn rate', value: `${data?.churnRate || 0}%`, color: 'text-amber-400' },
          { label: 'Trial → Paid', value: `${data?.trialToPaid || 0}%`, color: 'text-cyan-400' },
        ].map((item) => (
          <div key={item.label} className="rounded-[20px] bg-[#040810] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className={`mt-3 text-3xl font-bold tracking-[-0.03em] ${item.color}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-[20px] bg-[#040810] p-5">
        <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">Nota</p>
        <p className="text-sm text-slate-400">
          Los datos de revenue se calculan desde Stripe.
          Conecta el webhook de Stripe para ver métricas en tiempo real.
        </p>
      </div>
    </div>
  );
}

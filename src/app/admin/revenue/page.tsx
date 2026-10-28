'use client';

import { useEffect, useState } from 'react';
import { formatMoneyLines } from '@/lib/billing/money';

type MoneyLine = {
  currency: string;
  amountMinor: string;
  exponent: number | null;
  count: number;
};

type Exclusions = {
  legacyUnverified: number;
  trialing: number;
  nonActive: number;
  incompletePrice: number;
  unsupportedInterval: number;
};

interface RevenueData {
  mrrByCurrency: MoneyLine[];
  arrByCurrency: MoneyLine[];
  collectedByCurrency: MoneyLine[];
  activeSubscriptionCount: number;
  trialingSubscriptionCount: number;
  excludedFromMrr: Exclusions;
  pendingInvoiceCount: number;
  legacyInvoiceCount: number;
  churnRate: null;
  trialToPaid: null;
}

function exclusionTotal(excluded: Exclusions | undefined) {
  if (!excluded) return 0;
  return (
    excluded.legacyUnverified +
    excluded.trialing +
    excluded.nonActive +
    excluded.incompletePrice +
    excluded.unsupportedInterval
  );
}

function recurringLabel(lines: MoneyLine[] | undefined, excluded: number) {
  if (lines && lines.length > 0) return formatMoneyLines(lines, '0');
  if (excluded > 0) return 'Sin precio Stripe verificable';
  return '0';
}

function collectedLabel(lines: MoneyLine[] | undefined, legacyCount: number) {
  if (lines && lines.length > 0) return formatMoneyLines(lines, '0');
  if (legacyCount > 0) return 'No calculado';
  return '0';
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
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

  const excluded = exclusionTotal(data?.excludedFromMrr);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-rose-300">✦ Admin · Revenue</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white">
          Revenue & Suscripciones
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          MRR desde la proyección local de suscripciones Stripe. Los cobros salen de facturas pagadas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: 'MRR', value: recurringLabel(data?.mrrByCurrency, excluded), color: 'text-emerald-400' },
          { label: 'ARR', value: recurringLabel(data?.arrByCurrency, excluded), color: 'text-emerald-400' },
          {
            label: 'Cobrado en facturas',
            value: collectedLabel(data?.collectedByCurrency, data?.legacyInvoiceCount ?? 0),
            color: 'text-white',
          },
          { label: 'Active en Stripe', value: data?.activeSubscriptionCount ?? 0, color: 'text-cyan-400' },
          { label: 'Trials excluidos', value: data?.trialingSubscriptionCount ?? 0, color: 'text-cyan-400' },
          { label: 'Churn rate', value: 'No calculado', color: 'text-amber-400' },
          { label: 'Trial → Paid', value: 'No calculado', color: 'text-cyan-400' },
          { label: 'Fuera de MRR', value: excluded, color: 'text-slate-300' },
        ].map((item) => (
          <div key={item.label} className="rounded-[20px] bg-[#040810] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className={`mt-3 text-3xl font-bold tracking-[-0.03em] ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[20px] bg-[#040810] p-5">
        <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">Proyección</p>
        <p className="text-sm text-slate-400">
          Las cifras salen de la proyección local que escribe el webhook de Stripe. No son una consulta en vivo a
          Stripe. Una suscripción sin importe, ciclo y moneda verificados no entra como cero ni con el precio de
          catálogo. Las monedas no se suman entre sí. Churn y trial a pago no están calculados en esta fase.
          Facturas pagadas anteriores a esta proyección: {data?.legacyInvoiceCount ?? 0}. Facturas en espera de
          suscripción: {data?.pendingInvoiceCount ?? 0}.
        </p>
      </div>
    </div>
  );
}

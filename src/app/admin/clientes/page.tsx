'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { isSubscriptionMrrEligible } from '@/lib/admin-ops';

type UserRecord = {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  subscription?: { plan: string; status: string; currentPeriodEnd: string };
  campaigns: Array<unknown>;
};

type SubscriptionRecord = {
  id: string;
  plan: string;
  status: string;
  user: { email: string; name?: string };
};

type SupportData = {
  queueSummary: { openTickets: number; aiResolvedRate: number; averageFirstResponse: string };
};

type PaymentSettings = {
  stripeWebhookSecret?: string;
  paypalEmail?: string;
  commissionRate: number;
  minimumPayout: number;
};

export default function AdminClientesPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [support, setSupport] = useState<SupportData | null>(null);
  const [payments, setPayments] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const [usersResponse, subscriptionsResponse, supportResponse, paymentsResponse] = await Promise.all([
          fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
          fetch('/api/admin/subscriptions', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
          fetch('/api/admin/support', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
          fetch('/api/admin/payment-settings', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
        ]);

        const usersData = await usersResponse.json();
        const subscriptionsData = await subscriptionsResponse.json();
        const supportData = await supportResponse.json();
        const paymentsData = await paymentsResponse.json();

        setUsers(usersData.users || []);
        setSubscriptions(subscriptionsData.subscriptions || []);
        setSupport(supportData.support || null);
        setPayments(paymentsData.settings || null);
      } catch (error) {
        console.error('Error loading clients admin view:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((item) => isSubscriptionMrrEligible(item.status)).length,
    [subscriptions]
  );
  const openTickets = support?.queueSummary.openTickets || 0;
  const recentUsers = users.slice(0, 8);

  if (loading) {
    return <div className="py-12 text-center text-slate-500">Cargando clientes e ingresos...</div>;
  }

  return (
    <div className="space-y-6 text-slate-200">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-rose-300">✦ Admin · Clientes</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
          Clientes & Ingresos
        </h1>
        <p className="mt-1 text-sm text-slate-500">Usuarios, planes, pagos y soporte en una sola vista.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { icon: '👥', label: 'Clientes totales', value: users.length, color: 'text-white' },
          { icon: '💳', label: 'Suscripciones activas', value: activeSubscriptions, color: 'text-emerald-400' },
          { icon: '🎧', label: 'Tickets abiertos', value: openTickets, color: 'text-amber-400' },
          { icon: '💰', label: 'Stack de pagos', value: payments?.paypalEmail ? 'Ready' : 'Draft', color: 'text-violet-400' },
        ].map((item) => (
          <div key={item.label} className="rounded-[20px] bg-[#040810] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className={`mt-3 text-3xl font-bold tracking-[-0.03em] ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[24px] bg-[#040810] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-white">Clientes recientes</h2>
            <Link href="/admin/users" className="text-xs text-cyan-300 transition hover:text-white">Ver histórico →</Link>
          </div>
          <div className="overflow-x-auto rounded-[20px] bg-[#030610]">
            <div className="min-w-[560px]">
              <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.6fr] gap-3 px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-slate-600">
                <span>Cliente</span>
                <span>Plan</span>
                <span>Estado</span>
                <span>Campañas</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {recentUsers.map((user) => (
                  <div key={user.id} className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.6fr] gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{user.name || 'Sin nombre'}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                    <p className="self-center text-sm text-slate-300">{user.subscription?.plan || 'Sin plan'}</p>
                    <p className="self-center text-sm text-slate-300">{user.subscription?.status || 'Pendiente'}</p>
                    <p className="self-center text-sm text-slate-300">{user.campaigns.length}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] bg-[#040810] p-5">
            <h2 className="mb-4 text-[16px] font-semibold tracking-[-0.02em] text-white">Ingresos & pagos</h2>
            <div className="space-y-2">
              {[
                { label: 'PayPal', value: payments?.paypalEmail || 'No configurado' },
                { label: 'Webhook Stripe', value: payments?.stripeWebhookSecret ? 'Guardado' : 'Pendiente' },
                { label: 'Comisión', value: `${payments?.commissionRate ?? 0}%` },
                { label: 'Payout mínimo', value: `$${payments?.minimumPayout ?? 0}` },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-[16px] bg-[#030610] px-4 py-3">
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <span className="text-sm font-medium text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] bg-[#040810] p-5">
            <h2 className="mb-4 text-[16px] font-semibold tracking-[-0.02em] text-white">Soporte</h2>
            <div className="space-y-2">
              {[
                { label: 'Tickets abiertos', value: support?.queueSummary.openTickets || 0 },
                { label: 'Resolución IA', value: `${support?.queueSummary.aiResolvedRate || 0}%` },
                { label: 'Primera respuesta', value: support?.queueSummary.averageFirstResponse || 'N/D' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-[16px] bg-[#030610] px-4 py-3">
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <span className="text-sm font-medium text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

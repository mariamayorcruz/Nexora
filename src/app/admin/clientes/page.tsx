'use client';

import Link from 'next/link';
import { CreditCard, LifeBuoy, Receipt, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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

  const activeSubscriptions = useMemo(() => subscriptions.filter((item) => item.status === 'active').length, [subscriptions]);
  const openTickets = support?.queueSummary.openTickets || 0;
  const recentUsers = users.slice(0, 8);

  if (loading) {
    return <div className="py-12 text-center text-slate-500">Cargando clientes e ingresos...</div>;
  }

  return (
    <div className="space-y-6 text-slate-200">
      <header>
        <h1 className="text-2xl font-bold text-white">Clientes & Ingresos</h1>
        <p className="mt-1 text-sm text-slate-400">Usuarios, planes, pagos y soporte en una sola vista.</p>
      </header>

      <section className="grid gap-5 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <Users className="h-5 w-5 text-cyan-400" />
          <p className="mt-3 text-3xl font-bold text-white">{users.length}</p>
          <p className="text-sm text-slate-500">Clientes totales</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <CreditCard className="h-5 w-5 text-emerald-400" />
          <p className="mt-3 text-3xl font-bold text-white">{activeSubscriptions}</p>
          <p className="text-sm text-slate-500">Suscripciones activas</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <LifeBuoy className="h-5 w-5 text-amber-400" />
          <p className="mt-3 text-3xl font-bold text-white">{openTickets}</p>
          <p className="text-sm text-slate-500">Tickets abiertos</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <Receipt className="h-5 w-5 text-violet-400" />
          <p className="mt-3 text-3xl font-bold text-white">{payments?.paypalEmail ? 'Ready' : 'Draft'}</p>
          <p className="text-sm text-slate-500">Stack de pagos</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Clientes recientes</h2>
            <Link href="/admin/users" className="text-xs text-cyan-400 hover:text-cyan-300">Ver histórico</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="py-3 font-medium">Cliente</th>
                  <th className="py-3 font-medium">Plan</th>
                  <th className="py-3 font-medium">Estado</th>
                  <th className="py-3 font-medium">Campañas</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-800/50 text-slate-300">
                    <td className="py-3">
                      <div>
                        <p className="font-medium text-white">{user.name || 'Sin nombre'}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-3">{user.subscription?.plan || 'Sin plan'}</td>
                    <td className="py-3">{user.subscription?.status || 'Pendiente'}</td>
                    <td className="py-3">{user.campaigns.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold text-white">Ingresos & pagos</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-3">
                <span>PayPal</span>
                <span>{payments?.paypalEmail || 'No configurado'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-3">
                <span>Webhook Stripe</span>
                <span>{payments?.stripeWebhookSecret ? 'Guardado' : 'Pendiente'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-3">
                <span>Comisión</span>
                <span>{payments?.commissionRate ?? 0}%</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-3">
                <span>Payout mínimo</span>
                <span>${payments?.minimumPayout ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold text-white">Soporte</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-3">
                <span>Tickets abiertos</span>
                <span>{support?.queueSummary.openTickets || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-3">
                <span>Resolución IA</span>
                <span>{support?.queueSummary.aiResolvedRate || 0}%</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-3">
                <span>Primera respuesta</span>
                <span>{support?.queueSummary.averageFirstResponse || 'N/D'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

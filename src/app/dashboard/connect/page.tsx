'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface AdAccount {
  id: string;
  platform: string;
  accountName: string;
  connected: boolean;
}

interface ConnectUser {
  entitlements?: {
    marketingLabel: string;
    usage: {
      adAccounts: number;
      adAccountsLimit: number;
      adAccountsRemaining: number;
    };
    capabilities: {
      upgradeCta: string;
    };
  } | null;
}

const platforms = [
  {
    key: 'instagram',
    name: 'Instagram Ads',
    icon: 'IG',
    description: 'Sincroniza creatividad, audiencias y campañas de Meta con foco visual.',
    color: 'from-fuchsia-500 to-orange-400',
  },
  {
    key: 'facebook',
    name: 'Facebook Ads',
    icon: 'FB',
    description: 'Centraliza campañas de captacion y remarketing para venta directa.',
    color: 'from-blue-700 to-cyan-500',
  },
  {
    key: 'google',
    name: 'Google Ads',
    icon: 'GO',
    description: 'Conecta demanda activa y mide mejor el rendimiento de tus intenciones de compra.',
    color: 'from-emerald-500 to-lime-400',
  },
  {
    key: 'tiktok',
    name: 'TikTok Ads',
    icon: 'TT',
    description: 'Activa alcance creativo y lectura de hooks para campañas de respuesta rapida.',
    color: 'from-slate-900 to-slate-700',
  },
];

export default function ConnectPage() {
  const [user, setUser] = useState<ConnectUser | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('No se pudo cargar el estado de conexiones.');
        }

        const data = await response.json();
        setUser(data.user);
        setAdAccounts(data.adAccounts || []);
      } catch (error) {
        console.error('Error fetching ad account state:', error);
        setMessage('No pudimos cargar tus conexiones. Intenta actualizar la pagina.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const adAccountUsage = user?.entitlements?.usage;
  const adAccountLimitReached = !!adAccountUsage && adAccountUsage.adAccounts >= adAccountUsage.adAccountsLimit;

  const helperText = useMemo(() => {
    if (!adAccountUsage) return '';
    if (adAccountLimitReached) {
      return user?.entitlements?.capabilities.upgradeCta || 'Sube de plan para conectar mas cuentas.';
    }
    return `Te quedan ${adAccountUsage.adAccountsRemaining} conexiones disponibles en tu plan ${user?.entitlements?.marketingLabel}.`;
  }, [adAccountLimitReached, adAccountUsage, user?.entitlements?.capabilities.upgradeCta, user?.entitlements?.marketingLabel]);

  const handleConnect = (platform: string) => {
    if (adAccountLimitReached) {
      setMessage(user?.entitlements?.capabilities.upgradeCta || 'Tu plan actual ya alcanzo el limite de conexiones.');
      return;
    }

    setMessage(`La integracion OAuth de ${platform} sera el siguiente bloque tecnico. La estructura del plan ya esta lista para soportarla.`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Cargando conexiones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Conexiones del plan</p>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900">Conecta tus redes publicitarias sin perder control.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Cada plan define cuantas cuentas puedes centralizar en Nexora. Asi el cliente entiende capacidad real, no solo promesas de marketing.
            </p>
          </div>
          <div className="rounded-[24px] bg-slate-950 px-6 py-5 text-white">
            <p className="text-sm text-slate-300">Uso actual</p>
            <p className="mt-2 text-4xl font-semibold">
              {adAccountUsage?.adAccounts || 0}/{adAccountUsage?.adAccountsLimit || 1}
            </p>
            <p className="mt-2 text-sm text-slate-300">cuentas conectadas</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">{helperText}</div>
        {message && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{message}</div>}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {platforms.map((platform) => (
          <article key={platform.key} className="rounded-[28px] border border-gray-200 bg-white p-7 shadow-sm">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r ${platform.color} text-sm font-semibold text-white`}>
              {platform.icon}
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-gray-900">{platform.name}</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">{platform.description}</p>
            <button
              onClick={() => handleConnect(platform.name)}
              className="mt-6 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={adAccountLimitReached}
            >
              {adAccountLimitReached ? 'Limite alcanzado' : `Conectar ${platform.name}`}
            </button>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Cuentas ya conectadas</h2>
            <p className="text-sm text-gray-500">Tu estructura actual dentro del plan.</p>
          </div>
          <Link href="/dashboard/billing" className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Gestionar plan
          </Link>
        </div>

        {adAccounts.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-gray-50 p-6 text-sm text-gray-600">
            Aun no tienes cuentas conectadas. Tu siguiente paso mas importante es activar al menos una fuente de datos real.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {adAccounts.map((account) => (
              <div key={account.id} className="rounded-2xl bg-gray-50 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-400">{account.platform}</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{account.accountName}</p>
                <p className="mt-2 text-sm text-gray-600">{account.connected ? 'Conectada y disponible para lectura.' : 'Pendiente de reconexion.'}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

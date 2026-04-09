'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, CreditCard, PlugZap, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DashboardUser {
  id: string;
  name?: string;
  email: string;
  subscription?: {
    plan: string;
    status: string;
  };
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
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
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary" />
            <span className="text-xl font-bold text-gray-900">Nexora</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Bienvenido, {user?.name || user?.email}</h1>
          <p className="text-gray-600">
            Plan actual: <span className="font-semibold uppercase">{user?.subscription?.plan}</span>
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <div className="card">
            <p className="text-sm text-gray-600">Cuentas conectadas</p>
            <p className="text-3xl font-bold text-gray-900">{adAccounts.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Campañas activas</p>
            <p className="text-3xl font-bold text-gray-900">{campaigns.filter((campaign: any) => campaign.status === 'active').length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Gasto total del mes</p>
            <p className="text-3xl font-bold text-gray-900">$0</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">ROI promedio</p>
            <p className="text-3xl font-bold text-gray-900">0%</p>
          </div>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-2">
          <Link href="/dashboard/connect" className="block">
            <div className="card cursor-pointer py-12 text-center transition hover:shadow-xl">
              <PlugZap className="mx-auto mb-4 h-12 w-12 text-orange-500" />
              <h3 className="mb-2 text-xl font-bold">Conectar red publicitaria</h3>
              <p className="text-gray-600">Agrega tus cuentas de Instagram, Facebook, Google o TikTok.</p>
            </div>
          </Link>
          <Link href="/dashboard/campaigns" className="block">
            <div className="card cursor-pointer py-12 text-center transition hover:shadow-xl">
              <BarChart3 className="mx-auto mb-4 h-12 w-12 text-cyan-500" />
              <h3 className="mb-2 text-xl font-bold">Crear campaña</h3>
              <p className="text-gray-600">Configura y revisa tus campañas desde un flujo más ordenado.</p>
            </div>
          </Link>
        </div>

        {adAccounts.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-6 text-2xl font-bold">Tus cuentas conectadas</h2>
            <div className="grid gap-6">
              {adAccounts.map((account) => (
                <div key={account.id} className="card flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{account.accountName}</h3>
                    <p className="text-sm capitalize text-gray-600">
                      {account.platform} • {account.accountId}
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      account.connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {account.connected ? 'Conectada' : 'Desconectada'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <Link href="/dashboard/settings" className="card cursor-pointer text-center transition hover:shadow-lg">
            <Settings2 className="mx-auto mb-2 h-10 w-10 text-gray-700" />
            <p className="font-semibold text-gray-900">Configuración</p>
          </Link>
          <Link href="/dashboard/billing" className="card cursor-pointer text-center transition hover:shadow-lg">
            <CreditCard className="mx-auto mb-2 h-10 w-10 text-gray-700" />
            <p className="font-semibold text-gray-900">Facturación</p>
          </Link>
          <Link href="/dashboard/analytics" className="card cursor-pointer text-center transition hover:shadow-lg">
            <BarChart3 className="mx-auto mb-2 h-10 w-10 text-gray-700" />
            <p className="font-semibold text-gray-900">Analítica</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

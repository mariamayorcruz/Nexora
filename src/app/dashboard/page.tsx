'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
      router.push('/login');
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
        router.push('/login');
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg"></div>
            <span className="font-bold text-xl text-gray-900">Nexora</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido, {user?.name || user?.email}</h1>
          <p className="text-gray-600">Plan: <span className="font-semibold uppercase">{user?.subscription?.plan}</span></p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="card">
            <p className="text-gray-600 text-sm">Cuentas Conectadas</p>
            <p className="text-3xl font-bold text-gray-900">{adAccounts.length}</p>
          </div>
          <div className="card">
            <p className="text-gray-600 text-sm">Campañas Activas</p>
            <p className="text-3xl font-bold text-gray-900">{campaigns.filter((c: any) => c.status === 'active').length}</p>
          </div>
          <div className="card">
            <p className="text-gray-600 text-sm">Gasto Total (Mes)</p>
            <p className="text-3xl font-bold text-gray-900">$0</p>
          </div>
          <div className="card">
            <p className="text-gray-600 text-sm">ROI Promedio</p>
            <p className="text-3xl font-bold text-gray-900">0%</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Link href="/dashboard/connect" className="block">
            <div className="card cursor-pointer hover:shadow-xl transition text-center py-12">
              <div className="text-5xl mb-4">🔗</div>
              <h3 className="text-xl font-bold mb-2">Conectar Red Publicitaria</h3>
              <p className="text-gray-600">Agrega tus cuentas de Instagram, Facebook, Google o TikTok</p>
            </div>
          </Link>
          <Link href="/dashboard/campaigns" className="block">
            <div className="card cursor-pointer hover:shadow-xl transition text-center py-12">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-2">Crear Campaña</h3>
              <p className="text-gray-600">Configura y lanza una nueva campaña publicitaria</p>
            </div>
          </Link>
        </div>

        {/* Ad Accounts Section */}
        {adAccounts.length > 0 && (
          <div className=" mb-12">
            <h2 className="text-2xl font-bold mb-6">Tus Cuentas Conectadas</h2>
            <div className="grid gap-6">
              {adAccounts.map((account) => (
                <div key={account.id} className="card flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{account.accountName}</h3>
                    <p className="text-sm text-gray-600 capitalize">{account.platform} • {account.accountId}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold ${account.connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {account.connected ? '✓ Conectada' : '✗ Desconectada'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/dashboard/settings" className="card text-center hover:shadow-lg transition cursor-pointer">
            <p className="text-3xl mb-2">⚙️</p>
            <p className="font-semibold text-gray-900">Configuración</p>
          </Link>
          <Link href="/dashboard/billing" className="card text-center hover:shadow-lg transition cursor-pointer">
            <p className="text-3xl mb-2">💳</p>
            <p className="font-semibold text-gray-900">Facturación</p>
          </Link>
          <Link href="/dashboard/support" className="card text-center hover:shadow-lg transition cursor-pointer">
            <p className="text-3xl mb-2">🆘</p>
            <p className="font-semibold text-gray-900">Soporte</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

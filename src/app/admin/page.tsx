'use client';

import { useState, useEffect } from 'react';

interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalCampaigns: number;
  activeCampaigns: number;
  recentUsers: any[];
  recentPayments: any[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalCampaigns: 0,
    activeCampaigns: 0,
    recentUsers: [],
    recentPayments: [],
  });
  const [loading, setLoading] = useState(true);

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
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Dashboard Administrador</h2>
      <p className="text-gray-600 mb-8">Vista general de tu plataforma Nexora</p>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6 mb-12">
        <div className="card">
          <p className="text-gray-600 text-sm">Total Usuarios</p>
          <p className="text-4xl font-bold text-primary">{stats.totalUsers}</p>
          <p className="text-xs text-gray-500 mt-2">↑ 12% vs. mes anterior</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Suscripciones Activas</p>
          <p className="text-4xl font-bold text-green-600">{stats.activeSubscriptions}</p>
          <p className="text-xs text-gray-500 mt-2">↑ 8% vs. mes anterior</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Ingresos Totales</p>
          <p className="text-4xl font-bold text-blue-600">${stats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">↑ 15% vs. mes anterior</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Ingresos Mensuales</p>
          <p className="text-4xl font-bold text-purple-600">${stats.monthlyRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">↑ 22% vs. mes anterior</p>
        </div>
      </div>

      {/* Campaigns Stats */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="card">
          <h3 className="text-lg font-bold mb-6">Campañas</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total de Campañas</span>
              <span className="text-2xl font-bold text-primary">{stats.totalCampaigns}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Campañas Activas</span>
              <span className="text-2xl font-bold text-green-600">{stats.activeCampaigns}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Campañas Pausadas</span>
              <span className="text-2xl font-bold text-yellow-600">{stats.totalCampaigns - stats.activeCampaigns}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-bold mb-6">Distribución por Plataforma</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">📷 Instagram</span>
              <span className="text-sm text-gray-600">45%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">f Facebook</span>
              <span className="text-sm text-gray-600">32%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">🔍 Google</span>
              <span className="text-sm text-gray-600">18%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">♪ TikTok</span>
              <span className="text-sm text-gray-600">5%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-bold mb-6">Usuarios Recientes</h3>
          <div className="space-y-4">
            {stats.recentUsers.slice(0, 5).map((user: any) => (
              <div key={user.id} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{user.name || user.email}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString('es-ES')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-bold mb-6">Pagos Recientes</h3>
          <div className="space-y-4">
            {stats.recentPayments.slice(0, 5).map((payment: any) => (
              <div key={payment.id} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">${payment.amount}</p>
                  <p className="text-sm text-gray-500">{payment.user?.email}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(payment.createdAt).toLocaleDateString('es-ES')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-12 grid md:grid-cols-4 gap-6">
        <div className="card text-center hover:shadow-lg transition cursor-pointer">
          <p className="text-3xl mb-2">👥</p>
          <p className="font-semibold text-gray-900">Gestionar Usuarios</p>
        </div>
        <div className="card text-center hover:shadow-lg transition cursor-pointer">
          <p className="text-3xl mb-2">💳</p>
          <p className="font-semibold text-gray-900">Ver Suscripciones</p>
        </div>
        <div className="card text-center hover:shadow-lg transition cursor-pointer">
          <p className="text-3xl mb-2">💰</p>
          <p className="font-semibold text-gray-900">Configurar Pagos</p>
        </div>
        <div className="card text-center hover:shadow-lg transition cursor-pointer">
          <p className="text-3xl mb-2">📊</p>
          <p className="font-semibold text-gray-900">Ver Reportes</p>
        </div>
      </div>
    </div>
  );
}

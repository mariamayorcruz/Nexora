'use client';

import { useState, useEffect } from 'react';

interface Subscription {
  id: string;
  userId: string;
  user: {
    email: string;
    name?: string;
  };
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeCustomerId?: string;
  stripeSubId?: string;
  createdAt: string;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/subscriptions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setSubscriptions(data.subscriptions);
      } catch (error) {
        console.error('Error fetching subscriptions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, []);

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesStatus = filterStatus === 'all' || sub.status === filterStatus;
    const matchesPlan = filterPlan === 'all' || sub.plan === filterPlan;
    return matchesStatus && matchesPlan;
  });

  const handleSubscriptionAction = async (subscriptionId: string, action: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        // Refresh subscriptions list
        const updatedResponse = await fetch('/api/admin/subscriptions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await updatedResponse.json();
        setSubscriptions(data.subscriptions);
      }
    } catch (error) {
      console.error('Error performing subscription action:', error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Gestión de Suscripciones</h2>
      <p className="text-gray-600 mb-8">Administra todas las suscripciones de tu plataforma</p>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="cancelled">Cancelado</option>
              <option value="paused">Pausado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Plan</label>
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">Todos los planes</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterPlan('all');
              }}
              className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stripe ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSubscriptions.map((subscription) => (
                <tr key={subscription.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {subscription.user.name || 'Sin nombre'}
                      </div>
                      <div className="text-sm text-gray-500">{subscription.user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {subscription.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      subscription.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : subscription.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {subscription.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(subscription.currentPeriodStart).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {subscription.stripeSubId ? subscription.stripeSubId.substring(0, 20) + '...' : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {subscription.status === 'active' && (
                        <button
                          onClick={() => handleSubscriptionAction(subscription.id, 'pause')}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Pausar
                        </button>
                      )}
                      {subscription.status === 'paused' && (
                        <button
                          onClick={() => handleSubscriptionAction(subscription.id, 'resume')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Reanudar
                        </button>
                      )}
                      <button
                        onClick={() => handleSubscriptionAction(subscription.id, 'cancel')}
                        className="text-red-600 hover:text-red-900"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSubscriptions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No se encontraron suscripciones con los filtros aplicados</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid md:grid-cols-4 gap-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary">{subscriptions.length}</p>
          <p className="text-sm text-gray-600">Total Suscripciones</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">
            {subscriptions.filter(s => s.status === 'active').length}
          </p>
          <p className="text-sm text-gray-600">Activas</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-600">
            {subscriptions.filter(s => s.status === 'cancelled').length}
          </p>
          <p className="text-sm text-gray-600">Canceladas</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-blue-600">
            ${subscriptions
              .filter(s => s.status === 'active')
              .reduce((acc, s) => {
                const planPrices = { starter: 30, professional: 79, enterprise: 199 };
                return acc + (planPrices[s.plan as keyof typeof planPrices] || 0);
              }, 0)}
          </p>
          <p className="text-sm text-gray-600">MRR Estimado</p>
        </div>
      </div>
    </div>
  );
}

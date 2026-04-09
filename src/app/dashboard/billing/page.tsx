'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setSubscription(data.user.subscription);
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  const handlePlanChange = async (plan: string, cycle: 'monthly' | 'yearly') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, billingCycle: cycle }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error upgrading plan:', error);
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
      <h2 className="text-3xl font-bold mb-8">Facturación y Suscripción</h2>

      <div className="bg-white rounded-xl shadow-lg p-8 mb-12">
        <h3 className="text-xl font-bold mb-6">Tu Plan Actual</h3>
        {subscription && (
          <div>
            <p className="mb-2">
              <span className="text-gray-600">Plan:</span> 
              <span className="ml-2 font-bold uppercase">{subscription.plan}</span>
            </p>
            <p className="mb-2">
              <span className="text-gray-600">Estado:</span> 
              <span className="ml-2 font-bold">{subscription.status === 'active' ? '✓ Activo' : '✗ Inactivo'}</span>
            </p>
            <p className="text-gray-600">
              Próxima facturación: {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
            </p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {[
          { name: 'Starter', monthlyPrice: 30, yearlyPrice: 300 },
          { name: 'Professional', monthlyPrice: 79, yearlyPrice: 790 },
          { name: 'Enterprise', monthlyPrice: 199, yearlyPrice: 1990 },
        ].map((plan) => (
          <div key={plan.name} className={`card ${subscription?.plan.toLowerCase() === plan.name.toLowerCase() ? 'ring-2 ring-primary' : ''}`}>
            <h4 className="text-lg font-bold mb-4">{plan.name}</h4>
            <div className="mb-6">
              <p className="text-3xl font-bold text-primary">${plan.monthlyPrice}</p>
              <p className="text-gray-500 text-sm">/mes</p>
            </div>
            {subscription?.plan.toLowerCase() === plan.name.toLowerCase() ? (
              <button className="w-full btn-primary disabled">Plan Actual</button>
            ) : (
              <button 
                onClick={() => handlePlanChange(plan.name.toLowerCase(), 'monthly')}
                className="w-full btn-outline"
              >
                Cambiar a este plan
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <p className="text-blue-900">
          <span className="font-bold">💡 Tip:</span> Puedes cambiar de plan en cualquier momento. Los cambios se aplicarán en tu próximo ciclo de facturación.
        </p>
      </div>
    </div>
  );
}

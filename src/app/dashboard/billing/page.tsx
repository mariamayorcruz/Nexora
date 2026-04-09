'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BILLING_PLANS, BillingCycle, BillingPlan, getBillingPlanLabel } from '@/lib/billing';

interface SubscriptionState {
  plan: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
}

interface CheckoutState {
  type: 'success' | 'cancelled' | 'error';
  message: string;
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState | null>(null);

  const sessionId = searchParams.get('session_id');
  const checkoutStatus = searchParams.get('checkout');

  const currentPlanLabel = useMemo(
    () => getBillingPlanLabel(subscription?.plan),
    [subscription?.plan]
  );

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
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

  useEffect(() => {
    const verifyCheckout = async () => {
      const token = localStorage.getItem('token');

      if (checkoutStatus === 'cancelled') {
        setCheckoutState({
          type: 'cancelled',
          message: 'El checkout fue cancelado. Tu suscripcion actual no cambio.',
        });
        return;
      }

      if (!sessionId || !token) {
        return;
      }

      try {
        const response = await fetch(`/api/stripe/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Session validation failed');
        }

        const plan = data.session?.plan || 'tu nuevo plan';
        setCheckoutState({
          type: 'success',
          message: `Pago confirmado para ${plan}. Stripe termino correctamente el checkout y Nexora esta sincronizando tu suscripcion.`,
        });
      } catch (error) {
        console.error('Error validating checkout session:', error);
        setCheckoutState({
          type: 'error',
          message: 'Stripe completo el flujo, pero no pudimos validar la sesion desde el dashboard. Revisa de nuevo en unos segundos.',
        });
      }
    };

    verifyCheckout();
  }, [checkoutStatus, sessionId]);

  const handlePlanChange = async (plan: BillingPlan, cycle: BillingCycle) => {
    setProcessingPlan(`${plan}-${cycle}`);
    setCheckoutState(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, billingCycle: cycle }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error upgrading plan:', error);
      setCheckoutState({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo iniciar el checkout con Stripe.',
      });
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-2 text-3xl font-bold text-gray-900">Facturacion y suscripcion</h2>
        <p className="text-gray-600">Gestiona tu plan, ejecuta upgrades y valida el estado real de Stripe.</p>
      </div>

      {checkoutState && (
        <div
          className={`rounded-2xl border p-5 text-sm ${
            checkoutState.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : checkoutState.type === 'cancelled'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {checkoutState.message}
        </div>
      )}

      <div className="rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-900">Tu plan actual</h3>
        {subscription ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Plan</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{currentPlanLabel}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Estado</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{subscription.status}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Proximo corte</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-gray-600">Todavia no encontramos una suscripcion asociada.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {(Object.keys(BILLING_PLANS) as BillingPlan[]).map((planKey) => {
          const plan = BILLING_PLANS[planKey];
          const isCurrentPlan = subscription?.plan === plan.key;
          const isProcessing = processingPlan === `${plan.key}-monthly`;

          return (
            <article
              key={plan.key}
              className={`rounded-[28px] border p-8 shadow-sm ${
                isCurrentPlan ? 'border-primary bg-orange-50' : 'border-gray-200 bg-white'
              }`}
            >
              <p className="text-sm uppercase tracking-[0.24em] text-gray-400">{plan.label}</p>
              <h3 className="mt-3 text-2xl font-semibold text-gray-900">{plan.marketingLabel}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">{plan.description}</p>

              <div className="mt-6">
                <p className="text-4xl font-semibold text-gray-900">${plan.monthlyPrice}</p>
                <p className="text-sm text-gray-500">por mes</p>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                {plan.key === 'starter' && 'Incluye 1 cuenta publicitaria, hasta 3 campanas activas y dashboard base.'}
                {plan.key === 'professional' && 'Incluye radar creativo, analitica avanzada, 3 cuentas y 12 campanas activas.'}
                {plan.key === 'enterprise' && 'Incluye mas capacidad, automatizacion sugerida y soporte prioritario.'}
              </div>

              <button
                onClick={() => handlePlanChange(plan.key, 'monthly')}
                disabled={isCurrentPlan || !!processingPlan}
                className={`mt-8 w-full ${
                  isCurrentPlan ? 'btn-secondary cursor-default opacity-80' : 'btn-primary'
                } disabled:opacity-60`}
              >
                {isCurrentPlan ? 'Plan actual' : isProcessing ? 'Abriendo Stripe...' : `Cambiar a ${plan.marketingLabel}`}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

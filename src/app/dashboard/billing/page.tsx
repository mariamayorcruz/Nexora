'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BILLING_PLANS, BillingCycle, BillingPlan, getBillingPlanLabel } from '@/lib/billing';

interface SubscriptionState {
  plan: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
  stripeSubId?: string | null;
}

interface BillingInvoiceRow {
  id: string;
  createdAt: string;
  paidAt: string | null;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}

interface CheckoutState {
  type: 'success' | 'cancelled' | 'error';
  message: string;
}

type BillingQueryState = {
  sessionId: string | null;
  checkoutStatus: string | null;
  requestedPlanFromUrl: BillingPlan | null;
  requestedBillingFromUrl: BillingCycle | null;
  shouldAutostart: boolean;
};

function readBillingQueryState(): BillingQueryState {
  if (typeof window === 'undefined') {
    return {
      sessionId: null,
      checkoutStatus: null,
      requestedPlanFromUrl: null,
      requestedBillingFromUrl: null,
      shouldAutostart: false,
    };
  }

  const searchParams = new URLSearchParams(window.location.search);

  return {
    sessionId: searchParams.get('session_id'),
    checkoutStatus: searchParams.get('checkout'),
    requestedPlanFromUrl: searchParams.get('plan') as BillingPlan | null,
    requestedBillingFromUrl: (searchParams.get('billing') as BillingCycle | null) || null,
    shouldAutostart: searchParams.get('autostart') === '1',
  };
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState | null>(null);
  const [fallbackSelection, setFallbackSelection] = useState<{ plan: BillingPlan; billing: BillingCycle } | null>(null);
  const [queryState, setQueryState] = useState<BillingQueryState>(() => readBillingQueryState());
  const autoCheckoutStarted = useRef(false);

  const { sessionId, checkoutStatus, requestedPlanFromUrl, requestedBillingFromUrl, shouldAutostart } = queryState;
  const requestedPlan = requestedPlanFromUrl || fallbackSelection?.plan || null;
  const requestedBilling = requestedBillingFromUrl || fallbackSelection?.billing || 'monthly';
  const requestedPlanConfig = useMemo(
    () => (requestedPlan ? BILLING_PLANS[requestedPlan] : null),
    [requestedPlan]
  );
  const checkoutFocusMode = Boolean(shouldAutostart && requestedPlanConfig);

  const currentPlanLabel = useMemo(() => getBillingPlanLabel(subscription?.plan), [subscription?.plan]);

  const fetchSubscription = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await response.json();
      setSubscription(data.user.subscription);

      const invResponse = await fetch('/api/billing/invoices', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (invResponse.ok) {
        const invData = (await invResponse.json()) as { invoices?: BillingInvoiceRow[] };
        setInvoices(Array.isArray(invData.invoices) ? invData.invoices : []);
      } else {
        setInvoices([]);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setQueryState(readBillingQueryState());
  }, []);

  useEffect(() => {
    void fetchSubscription();
  }, []);

  useEffect(() => {
    if (requestedPlanFromUrl) {
      return;
    }

    try {
      const rawSelection = localStorage.getItem('nexoraSelectedPlan');
      if (!rawSelection) {
        return;
      }

      const parsed = JSON.parse(rawSelection) as {
        plan?: BillingPlan;
        billing?: BillingCycle;
        savedAt?: number;
      };

      if (!parsed.plan || !Object.prototype.hasOwnProperty.call(BILLING_PLANS, parsed.plan)) {
        return;
      }

      const isFresh = typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt < 30 * 60 * 1000;
      if (!isFresh) {
        localStorage.removeItem('nexoraSelectedPlan');
        return;
      }

      setFallbackSelection({
        plan: parsed.plan,
        billing: parsed.billing === 'yearly' ? 'yearly' : 'monthly',
      });
    } catch (selectionError) {
      console.error('Error reading selected billing plan:', selectionError);
    }
  }, [requestedPlanFromUrl]);

  useEffect(() => {
    const verifyCheckout = async () => {
      const token = localStorage.getItem('token');

      if (checkoutStatus === 'cancelled') {
        setCheckoutState({
          type: 'cancelled',
          message: 'El checkout fue cancelado. Tu suscripción actual no cambió.',
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
          message: `Pago confirmado para ${plan}. Stripe terminó correctamente el checkout y Nexora ya está sincronizando tu suscripción.`,
        });

        await fetchSubscription();
      } catch (error) {
        console.error('Error validating checkout session:', error);
        setCheckoutState({
          type: 'error',
          message: 'Stripe completó el flujo, pero no pudimos validar la sesión desde el dashboard. Revisa de nuevo en unos segundos.',
        });
      }
    };

    void verifyCheckout();
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
        localStorage.removeItem('nexoraSelectedPlan');
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

  useEffect(() => {
    if (loading || !shouldAutostart || !requestedPlan || autoCheckoutStarted.current) {
      return;
    }

    const planExists = Object.prototype.hasOwnProperty.call(BILLING_PLANS, requestedPlan);
    if (!planExists) {
      return;
    }

    const alreadySubscribedToRequestedPlan =
      subscription?.plan === requestedPlan &&
      ['active', 'trialing'].includes((subscription?.status || '').toLowerCase());

    if (alreadySubscribedToRequestedPlan) {
      return;
    }

    autoCheckoutStarted.current = true;
    void handlePlanChange(requestedPlan, requestedBilling);
  }, [loading, requestedPlan, requestedBilling, shouldAutostart, subscription]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const renderCheckoutError = () => (
    <div className="rounded-[32px] border border-red-200 bg-white p-8 text-center shadow-sm sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">Pago</p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">No pudimos iniciar el pago</h1>
      <p className="mt-4 text-base leading-7 text-slate-600">Intenta nuevamente.</p>
      <button
        onClick={() => requestedPlanConfig && handlePlanChange(requestedPlanConfig.key, requestedBilling)}
        disabled={!!processingPlan || !requestedPlanConfig}
        className="btn-primary mt-8 w-full disabled:opacity-60 sm:w-auto"
      >
        {processingPlan ? 'Abriendo Stripe...' : 'Reintentar pago'}
      </button>
    </div>
  );

  if (checkoutFocusMode && checkoutState?.type === 'error') {
    return renderCheckoutError();
  }

  if (checkoutFocusMode && requestedPlanConfig) {
    const price = requestedBilling === 'yearly' ? requestedPlanConfig.yearlyPrice : requestedPlanConfig.monthlyPrice;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Activación</p>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Estás a un paso de activar tu acceso</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Completa el pago para entrar con tu plan seleccionado y empezar de inmediato.
          </p>
        </div>

        {checkoutState && (
          <div
            className={`rounded-2xl border p-5 text-sm ${
              checkoutState.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {checkoutState.message}
          </div>
        )}

        <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Plan seleccionado</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{requestedPlanConfig.marketingLabel}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">{requestedPlanConfig.description}</p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-semibold text-white">${price}</span>
              <span className="pb-2 text-sm text-slate-400">/ mes</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              {requestedBilling === 'yearly' ? 'Facturación anual con mejor margen' : 'Facturación mensual flexible'}
            </p>
          </div>

          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {requestedPlanConfig.features.slice(0, 4).map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>

          <button
            onClick={() => handlePlanChange(requestedPlanConfig.key, requestedBilling)}
            disabled={!!processingPlan}
            className="btn-primary mt-10 w-full disabled:opacity-60"
          >
            {processingPlan ? 'Abriendo Stripe...' : 'Completar pago'}
          </button>

          <div className="mt-4 space-y-1 text-center text-sm text-slate-400">
            <p>Pago seguro con Stripe</p>
            <p>Acceso inmediato después del pago</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-3xl font-bold text-gray-900">Facturación y suscripción</h2>
        <p className="text-gray-600">Gestiona tu plan, lanza upgrades y valida el estado real de Stripe.</p>
      </div>

      {shouldAutostart && requestedPlan && !checkoutState && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900">
          Estamos preparando tu checkout para el plan {BILLING_PLANS[requestedPlan]?.marketingLabel || requestedPlan}.
        </div>
      )}

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
              <p className="mt-2 text-2xl font-semibold capitalize text-gray-900">{subscription.status}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Próximo corte</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-gray-600">Todavía no encontramos una suscripción asociada.</p>
        )}
      </div>

      <div className="rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-900">Historial de facturas</h3>
        {invoices.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Aún no hay facturas registradas para tu cuenta.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Fecha</th>
                  <th className="pb-3 pr-4 font-medium">Monto</th>
                  <th className="pb-3 pr-4 font-medium">Estado</th>
                  <th className="pb-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const dateSrc = inv.paidAt || inv.createdAt;
                  const dateLabel = dateSrc ? new Date(dateSrc).toLocaleDateString('es-ES') : '—';
                  const amountLabel = new Intl.NumberFormat('es-ES', {
                    style: 'currency',
                    currency: inv.currency || 'USD',
                  }).format(inv.amount);
                  return (
                    <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 pr-4 text-gray-900">{dateLabel}</td>
                      <td className="py-3 pr-4 font-medium text-gray-900">{amountLabel}</td>
                      <td className="py-3 pr-4 capitalize text-gray-700">{inv.status}</td>
                      <td className="py-3 text-right">
                        {inv.hostedInvoiceUrl ? (
                          <a
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                          >
                            Ver factura
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {(Object.keys(BILLING_PLANS) as BillingPlan[]).map((planKey) => {
          const plan = BILLING_PLANS[planKey];
          const isCurrentPlan =
            subscription?.plan === plan.key &&
            ['active', 'trialing'].includes((subscription?.status || '').toLowerCase());
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
                {plan.key === 'starter' && 'Incluye 1 cuenta publicitaria, hasta 3 campañas activas y una bolsa inicial de IA.'}
                {plan.key === 'professional' && 'Incluye radar creativo, analítica avanzada, video, 3 cuentas y una bolsa robusta de IA.'}
                {plan.key === 'enterprise' && 'Incluye máxima capacidad, automatización sugerida, soporte prioritario y créditos amplios para operar todo el mes.'}
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

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
      const response = await fetch('/api/users/me?allowIncomplete=1', {
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

  const handlePlanChange = async (plan: BillingPlan, cycle: BillingCycle, withTrial = false) => {
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
        body: JSON.stringify({ plan, billingCycle: cycle, withTrial }),
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
    <div className="rounded-2xl border border-white/[0.05] bg-[#040810] p-8 text-center sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">Pago</p>
      <h1 className="mt-4 text-3xl font-bold text-white">No pudimos iniciar el pago</h1>
      <p className="mt-4 text-base leading-7 text-slate-400">Intenta nuevamente.</p>
      <button
        onClick={() => requestedPlanConfig && handlePlanChange(requestedPlanConfig.key, requestedBilling, true)}
        disabled={!!processingPlan || !requestedPlanConfig}
        className="mt-8 w-full rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white disabled:opacity-60 sm:w-auto"
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
      <div className="space-y-6 bg-[#05080f]">
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
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
            }`}
          >
            {checkoutState.message}
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.05] bg-[#040810] p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Plan seleccionado</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{requestedPlanConfig.marketingLabel}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">{requestedPlanConfig.description}</p>

          <div className="mt-8 rounded-2xl border border-white/[0.05] bg-[#05080f] p-5">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold text-white">${price}</span>
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
            onClick={() => handlePlanChange(requestedPlanConfig.key, requestedBilling, true)}
            disabled={!!processingPlan}
            className="mt-10 w-full rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white disabled:opacity-60"
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
    <div className="space-y-6 bg-[#05080f]">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">✦ Facturación</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
          Facturación y suscripción
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestiona tu plan, lanza upgrades y valida el estado real de Stripe.
        </p>
      </div>

      {shouldAutostart && requestedPlan && !checkoutState && (
        <div className="rounded-2xl border border-white/[0.05] bg-[#040810] p-5 text-sm text-slate-300">
          Estamos preparando tu checkout para el plan {BILLING_PLANS[requestedPlan]?.marketingLabel || requestedPlan}.
        </div>
      )}

      {checkoutState && (
        <div
          className={`rounded-2xl border p-5 text-sm ${
            checkoutState.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              : checkoutState.type === 'cancelled'
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
          }`}
        >
          {checkoutState.message}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.05] bg-[#040810] p-8">
        <h3 className="text-xl font-semibold text-white">Tu plan actual</h3>
        {subscription ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { label: 'Plan', value: currentPlanLabel },
              { label: 'Estado', value: subscription.status },
              { label: 'Próximo corte', value: new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES') },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] bg-[#05080f] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-white capitalize">{item.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-slate-400">Todavía no encontramos una suscripción asociada.</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.05] bg-[#040810] p-8">
        <h3 className="text-xl font-semibold text-white">Historial de facturas</h3>
        {invoices.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Aún no hay facturas registradas para tu cuenta.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.05] text-slate-400">
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
                    <tr key={inv.id} className="border-b border-white/[0.05] last:border-0">
                      <td className="py-3 pr-4 text-white">{dateLabel}</td>
                      <td className="py-3 pr-4 font-medium text-white">{amountLabel}</td>
                      <td className="py-3 pr-4 capitalize text-slate-300">{inv.status}</td>
                      <td className="py-3 text-right">
                        {inv.hostedInvoiceUrl ? (
                          <a
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
                          >
                            Ver factura
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
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
                isCurrentPlan ? 'rounded-2xl border border-cyan-500/25 bg-[#040810]' : 'rounded-2xl border border-white/[0.05] bg-[#040810]'
              }`}
            >
              <p className="text-xs uppercase tracking-wider text-slate-400">{plan.label}</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{plan.marketingLabel}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{plan.description}</p>

              <div className="mt-6">
                <p className="text-4xl font-bold text-white">${plan.monthlyPrice}</p>
                <p className="text-sm text-slate-400">por mes</p>
                <p className="mt-1 text-xs text-cyan-300">✦ 7 días por $1 · Sin compromiso</p>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <div className="mt-6 rounded-2xl border border-white/[0.05] bg-[#05080f] p-4 text-xs text-slate-500">
                {plan.key === 'starter' && 'Incluye 1 cuenta publicitaria, hasta 3 campañas activas y una bolsa inicial de IA.'}
                {plan.key === 'professional' && 'Incluye radar creativo, analítica avanzada, video, 3 cuentas y una bolsa robusta de IA.'}
                {plan.key === 'enterprise' && 'Incluye máxima capacidad, automatización sugerida, soporte prioritario y créditos amplios para operar todo el mes.'}
              </div>

              <button
                onClick={() => handlePlanChange(plan.key, 'monthly', true)}
                disabled={isCurrentPlan || !!processingPlan}
                className={`mt-8 w-full rounded-[18px] px-4 py-3 text-sm font-semibold transition-all duration-150 disabled:opacity-50 ${
                  isCurrentPlan
                    ? 'cursor-default border border-cyan-500/25 text-cyan-300'
                    : 'bg-cyan-500 text-[#041018] hover:-translate-y-[1px] hover:bg-cyan-400'
                }`}
              >
                {isCurrentPlan ? 'Plan actual' : isProcessing ? 'Abriendo Stripe...' : `Activar ${plan.marketingLabel}`}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

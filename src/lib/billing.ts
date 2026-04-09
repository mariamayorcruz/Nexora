export type BillingPlan = 'starter' | 'professional' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';

export interface BillingPlanConfig {
  key: BillingPlan;
  label: string;
  marketingLabel: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

export const BILLING_PLANS: Record<BillingPlan, BillingPlanConfig> = {
  starter: {
    key: 'starter',
    label: 'Starter',
    marketingLabel: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 24,
    description: 'Para negocios que quieren ordenar su operación publicitaria sin crecer costos fijos.',
    features: ['1 workspace', 'Dashboard principal', 'Centro de campañas', 'Auth y pagos base', 'Soporte por email'],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
  },
  professional: {
    key: 'professional',
    label: 'Professional',
    marketingLabel: 'Growth',
    monthlyPrice: 79,
    yearlyPrice: 64,
    description: 'La mejor relación entre control, administración y escalado para una operación activa.',
    features: ['3 workspaces', 'Analítica avanzada', 'Panel admin', 'Gestión de usuarios y suscripciones', 'Prioridad de soporte'],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY,
  },
  enterprise: {
    key: 'enterprise',
    label: 'Enterprise',
    marketingLabel: 'Scale',
    monthlyPrice: 149,
    yearlyPrice: 124,
    description: 'Para equipos que necesitan más control, más cuentas y una base lista para seguir construyendo.',
    features: ['Workspaces ampliados', 'Configuración administrativa extendida', 'Soporte prioritario', 'Base para personalizaciones', 'Acompañamiento de implementación'],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
  },
};

export function getBillingPlan(plan?: string | null) {
  if (!plan) return null;
  const normalizedPlan = plan.trim().toLowerCase();
  return BILLING_PLANS[normalizedPlan as BillingPlan] || null;
}

export function getBillingPlanLabel(plan?: string | null) {
  return getBillingPlan(plan)?.marketingLabel || plan || 'Starter';
}

export function getStripePriceId(plan: BillingPlan, billingCycle: BillingCycle) {
  const config = BILLING_PLANS[plan];
  return billingCycle === 'monthly' ? config.stripePriceIdMonthly : config.stripePriceIdYearly;
}

export function resolvePlanFromStripePriceId(priceId?: string | null): BillingPlan | null {
  if (!priceId) return null;

  const entries = Object.values(BILLING_PLANS);
  const match = entries.find(
    (plan) => plan.stripePriceIdMonthly === priceId || plan.stripePriceIdYearly === priceId
  );

  return match?.key || null;
}

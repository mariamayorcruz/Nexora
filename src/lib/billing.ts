export type BillingPlan = 'starter' | 'professional' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';

export interface BillingPlanConfig {
  key: BillingPlan;
  label: string;
  marketingLabel: string;
  monthlyPrice: number;
  yearlyPrice: number;
  aiCreditsMonthly: number;
  description: string;
  features: string[];
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

const STRIPE_PRICE_DEFAULTS = {
  starter: {
    monthly: 'price_1TKGzfPclnyOiA5fPRKRYTRk',
    yearly: 'price_1TKH1vPclnyOiA5fk52c786H',
  },
  professional: {
    monthly: 'price_1TKH34PclnyOiA5fewR0cliB',
    yearly: 'price_1TKH3jPclnyOiA5fmuScGdEV',
  },
  enterprise: {
    monthly: 'price_1TKH4CPclnyOiA5fVVJzm108',
    yearly: 'price_1TKH4oPclnyOiA5fN0nEp6KH',
  },
} as const;

export const BILLING_PLANS: Record<BillingPlan, BillingPlanConfig> = {
  starter: {
    key: 'starter',
    label: 'Starter',
    marketingLabel: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 24,
    aiCreditsMonthly: 250,
    description: 'Para negocios que quieren ordenar su operación publicitaria sin subir estructura fija.',
    features: [
      '1 workspace',
      'Dashboard principal',
      'Centro de campañas',
      'CRM comercial base',
      '250 créditos de IA al mes',
    ],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || STRIPE_PRICE_DEFAULTS.starter.monthly,
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || STRIPE_PRICE_DEFAULTS.starter.yearly,
  },
  professional: {
    key: 'professional',
    label: 'Professional',
    marketingLabel: 'Growth',
    monthlyPrice: 79,
    yearlyPrice: 64,
    aiCreditsMonthly: 1800,
    description: 'La mejor combinación entre control, analítica, IA y capacidad operativa para crecer.',
    features: [
      '3 workspaces',
      'Analítica avanzada',
      'Radar creativo',
      'Automatizaciones sugeridas',
      '1,800 créditos de IA al mes',
    ],
    stripePriceIdMonthly:
      process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || STRIPE_PRICE_DEFAULTS.professional.monthly,
    stripePriceIdYearly:
      process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY || STRIPE_PRICE_DEFAULTS.professional.yearly,
  },
  enterprise: {
    key: 'enterprise',
    label: 'Enterprise',
    marketingLabel: 'Scale',
    monthlyPrice: 149,
    yearlyPrice: 124,
    aiCreditsMonthly: 6500,
    description: 'Para equipos que quieren operar marketing, contenido y seguimiento con amplitud real.',
    features: [
      'Capacidad ampliada',
      'Soporte prioritario',
      'Video y repurpose avanzado',
      'Base para personalizaciones',
      '6,500 créditos de IA al mes',
    ],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || STRIPE_PRICE_DEFAULTS.enterprise.monthly,
    stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || STRIPE_PRICE_DEFAULTS.enterprise.yearly,
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
  if (!priceId) {
    return null;
  }

  const entries = Object.values(BILLING_PLANS);
  const match = entries.find(
    (plan) => plan.stripePriceIdMonthly === priceId || plan.stripePriceIdYearly === priceId
  );

  return match?.key || null;
}

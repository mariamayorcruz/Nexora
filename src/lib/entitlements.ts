import { BillingPlan, BILLING_PLANS, getBillingPlan } from '@/lib/billing';

export interface PlanCapabilities {
  key: BillingPlan;
  marketingLabel: string;
  workspaceLimit: number;
  maxAdAccounts: number;
  maxActiveCampaigns: number;
  aiCreditsMonthly: number;
  canUseRadar: boolean;
  canUseAdvancedAnalytics: boolean;
  canUseAutomationSuggestions: boolean;
  canUsePrioritySupport: boolean;
  canUseAiStudio: boolean;
  canUseVideoEditing: boolean;
  refreshAfterMinutes: number;
  upgradeCta: string;
}

export interface UsageSnapshot {
  adAccounts: number;
  activeCampaigns: number;
}

export interface EntitlementSummary {
  effectivePlan: BillingPlan;
  marketingLabel: string;
  capabilities: PlanCapabilities;
  usage: {
    adAccounts: number;
    activeCampaigns: number;
    adAccountsLimit: number;
    activeCampaignsLimit: number;
    adAccountsRemaining: number;
    activeCampaignsRemaining: number;
  };
}

const PLAN_CAPABILITIES: Record<BillingPlan, Omit<PlanCapabilities, 'marketingLabel' | 'key'>> = {
  starter: {
    workspaceLimit: 1,
    maxAdAccounts: 1,
    maxActiveCampaigns: 3,
    aiCreditsMonthly: 250,
    canUseRadar: false,
    canUseAdvancedAnalytics: false,
    canUseAutomationSuggestions: false,
    canUsePrioritySupport: false,
    canUseAiStudio: true,
    canUseVideoEditing: false,
    refreshAfterMinutes: 240,
    upgradeCta: 'Sube a Growth para desbloquear radar, analítica avanzada, edición y más capacidad.',
  },
  professional: {
    workspaceLimit: 3,
    maxAdAccounts: 3,
    maxActiveCampaigns: 12,
    aiCreditsMonthly: 1800,
    canUseRadar: true,
    canUseAdvancedAnalytics: true,
    canUseAutomationSuggestions: true,
    canUsePrioritySupport: false,
    canUseAiStudio: true,
    canUseVideoEditing: true,
    refreshAfterMinutes: 90,
    upgradeCta: 'Sube a Scale para ampliar capacidad, automatización y soporte prioritario.',
  },
  enterprise: {
    workspaceLimit: 10,
    maxAdAccounts: 10,
    maxActiveCampaigns: 40,
    aiCreditsMonthly: 6500,
    canUseRadar: true,
    canUseAdvancedAnalytics: true,
    canUseAutomationSuggestions: true,
    canUsePrioritySupport: true,
    canUseAiStudio: true,
    canUseVideoEditing: true,
    refreshAfterMinutes: 45,
    upgradeCta: 'Tu plan actual ya tiene la capacidad más completa de Nexora.',
  },
};

function normalizePlan(plan?: string | null): BillingPlan {
  const resolvedPlan = getBillingPlan(plan)?.key;
  return resolvedPlan || 'starter';
}

export function getPlanCapabilities(plan?: string | null): PlanCapabilities {
  const effectivePlan = normalizePlan(plan);
  const config = BILLING_PLANS[effectivePlan];
  const capabilities = PLAN_CAPABILITIES[effectivePlan];

  return {
    key: effectivePlan,
    marketingLabel: config.marketingLabel,
    ...capabilities,
  };
}

export function buildEntitlementSummary(plan: string | null | undefined, usage: UsageSnapshot): EntitlementSummary {
  const capabilities = getPlanCapabilities(plan);

  return {
    effectivePlan: capabilities.key,
    marketingLabel: capabilities.marketingLabel,
    capabilities,
    usage: {
      adAccounts: usage.adAccounts,
      activeCampaigns: usage.activeCampaigns,
      adAccountsLimit: capabilities.maxAdAccounts,
      activeCampaignsLimit: capabilities.maxActiveCampaigns,
      adAccountsRemaining: Math.max(0, capabilities.maxAdAccounts - usage.adAccounts),
      activeCampaignsRemaining: Math.max(0, capabilities.maxActiveCampaigns - usage.activeCampaigns),
    },
  };
}

export function canAccessRadar(plan?: string | null) {
  return getPlanCapabilities(plan).canUseRadar;
}

export function canAccessAdvancedAnalytics(plan?: string | null) {
  return getPlanCapabilities(plan).canUseAdvancedAnalytics;
}

export function canCreateAdAccount(plan: string | null | undefined, usage: UsageSnapshot) {
  return usage.adAccounts < getPlanCapabilities(plan).maxAdAccounts;
}

export function canCreateActiveCampaign(plan: string | null | undefined, usage: UsageSnapshot) {
  return usage.activeCampaigns < getPlanCapabilities(plan).maxActiveCampaigns;
}

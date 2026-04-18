import { Campaign, Invoice, Subscription, User } from '@prisma/client';
import { BILLING_PLANS, type BillingPlan } from '@/lib/billing';
import { buildLifecycleTemplates } from '@/lib/customer-success';

type CampaignWithAnalytics = Campaign & {
  analytics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue: number;
  } | null;
};

type UserSummary = Pick<User, 'id' | 'email' | 'name' | 'createdAt'>;
type SubscriptionSummary = Pick<
  Subscription,
  'id' | 'plan' | 'status' | 'currentPeriodEnd' | 'cancelAtPeriodEnd' | 'createdAt'
> & {
  userId: string;
};

type InvoiceSummary = Pick<Invoice, 'id' | 'amount' | 'status' | 'createdAt'> & {
  userId: string;
};

export interface AdminAlert {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface AutomationPlay {
  id: string;
  title: string;
  summary: string;
  trigger: string;
  action: string;
  cadence: string;
  priority: 'high' | 'medium' | 'low';
}

export interface EmailTemplateCard {
  id: string;
  name: string;
  audience: string;
  trigger: string;
  subject: string;
  preview: string;
  cta?: string;
  replyTo?: string;
}

export interface EmailCenterSummary {
  smtpReady: boolean;
  senderReady: boolean;
  supportEmailReady: boolean;
  templates: EmailTemplateCard[];
  checklist: string[];
}

/** Alineado con funnel admin / Stripe: suscripción que aporta MRR. */
export function isSubscriptionMrrEligible(status: string) {
  return status === 'active' || status === 'trialing';
}

export function calculateMrr(subscriptions: SubscriptionSummary[]) {
  return subscriptions
    .filter((s) => isSubscriptionMrrEligible(s.status))
    .reduce((sum, s) => {
      const key = String(s.plan || '')
        .trim()
        .toLowerCase() as BillingPlan;
      const cfg = BILLING_PLANS[key];
      return sum + (cfg?.monthlyPrice ?? 0);
    }, 0);
}

export function buildAdminAlerts(params: {
  subscriptions: SubscriptionSummary[];
  campaigns: CampaignWithAnalytics[];
  invoices: InvoiceSummary[];
  paymentReady: boolean;
  smtpReady: boolean;
}) {
  const { subscriptions, campaigns, invoices, paymentReady, smtpReady } = params;
  const alerts: AdminAlert[] = [];

  const paymentFailures = invoices.filter((invoice) => invoice.status === 'open' || invoice.status === 'uncollectible');
  if (paymentFailures.length > 0) {
    alerts.push({
      id: 'payment-recovery',
      severity: 'high',
      title: 'Hay pagos que necesitan recuperación',
      detail: `${paymentFailures.length} pagos quedaron abiertos o sin cobrar. Conviene activar seguimiento y revisar Stripe.`,
      actionLabel: 'Ir a pagos',
      actionHref: '/admin/payments',
    });
  }

  const expiringSubscriptions = subscriptions.filter((subscription) => {
    const daysLeft = Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / 86400000);
    return daysLeft >= 0 && daysLeft <= 7 && !subscription.cancelAtPeriodEnd;
  });
  if (expiringSubscriptions.length > 0) {
    alerts.push({
      id: 'expiring-subscriptions',
      severity: 'medium',
      title: 'Hay suscripciones por renovar esta semana',
      detail: `${expiringSubscriptions.length} cuentas llegan a corte pronto. Buen momento para lifecycle y upsell.`,
      actionLabel: 'Ver suscripciones',
      actionHref: '/admin/subscriptions',
    });
  }

  const lowSignalCampaigns = campaigns.filter((campaign) => {
    const spend = campaign.analytics?.spend || 0;
    const conversions = campaign.analytics?.conversions || 0;
    return campaign.status === 'active' && spend >= 50 && conversions === 0;
  });
  if (lowSignalCampaigns.length > 0) {
    alerts.push({
      id: 'campaign-inefficiency',
      severity: 'medium',
      title: 'Hay campañas activas con gasto y sin conversión',
      detail: `${lowSignalCampaigns.length} campañas necesitan ajuste creativo o redistribución de presupuesto.`,
      actionLabel: 'Ver campañas',
      actionHref: '/admin/campaigns',
    });
  }

  if (!paymentReady) {
    alerts.push({
      id: 'stripe-not-ready',
      severity: 'high',
      title: 'Stripe aún no está listo al 100%',
      detail: 'Faltan variables o webhook para cerrar la monetización real de la plataforma.',
      actionLabel: 'Configurar pagos',
      actionHref: '/admin/payments',
    });
  }

  if (!smtpReady) {
    alerts.push({
      id: 'smtp-not-ready',
      severity: 'medium',
      title: 'Lifecycle emails aún no pueden salir solos',
      detail: 'La base de templates existe, pero falta terminar la configuración SMTP para enviarlos.',
      actionLabel: 'Ver email center',
      actionHref: '/admin/emails',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'system-healthy',
      severity: 'low',
      title: 'La operación se ve saludable',
      detail: 'No encontramos bloqueos urgentes. Puedes usar este tiempo para empujar crecimiento y automatizaciones.',
    });
  }

  return alerts;
}

export function buildAutomationPlays(params: { campaigns: CampaignWithAnalytics[]; subscriptions: SubscriptionSummary[] }) {
  const { campaigns, subscriptions } = params;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active');
  const weakCampaigns = activeCampaigns.filter((campaign) => (campaign.analytics?.spend || 0) >= 50 && (campaign.analytics?.conversions || 0) === 0);
  const strongCampaigns = activeCampaigns.filter((campaign) => (campaign.analytics?.revenue || 0) > (campaign.analytics?.spend || 0) * 2);
  const cancelRisk = subscriptions.filter((subscription) => subscription.cancelAtPeriodEnd);

  const plays: AutomationPlay[] = [
    {
      id: 'creative-rescue',
      title: 'Creative rescue para campañas sin conversión',
      summary: `${weakCampaigns.length || 0} campañas pueden entrar en una secuencia de revisión de hook, CTA y oferta.`,
      trigger: 'Gasto >= 50 USD y conversiones = 0',
      action: 'Notificar al admin, sugerir nuevo ángulo y marcar ajuste prioritario.',
      cadence: 'Cada 6 horas',
      priority: weakCampaigns.length > 0 ? 'high' : 'medium',
    },
    {
      id: 'budget-scale',
      title: 'Escalado de presupuesto para ganadoras',
      summary: `${strongCampaigns.length || 0} campañas muestran señales para subir presupuesto con control.`,
      trigger: 'ROAS > 2 y conversiones sostenidas',
      action: 'Enviar alerta positiva y sugerir aumento progresivo del 10% al 20%.',
      cadence: 'Diario',
      priority: strongCampaigns.length > 0 ? 'high' : 'low',
    },
    {
      id: 'retention-save',
      title: 'Recuperación de cancelación',
      summary: `${cancelRisk.length || 0} cuentas quedaron marcadas para fin de periodo.`,
      trigger: 'cancelAtPeriodEnd = true',
      action: 'Disparar correo de retención con wins, oferta y propuesta de ayuda.',
      cadence: 'Diario',
      priority: cancelRisk.length > 0 ? 'high' : 'medium',
    },
  ];

  return plays;
}

export function buildEmailCenterSummary(supportEmail: string) {
  const smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
  const senderReady = Boolean(process.env.EMAIL_FROM);
  const supportEmailReady = Boolean(supportEmail || process.env.SUPPORT_EMAIL);

  const templates: EmailTemplateCard[] = buildLifecycleTemplates(supportEmail || process.env.SUPPORT_EMAIL || '');

  const checklist = [
    smtpReady ? 'SMTP listo para envíos transaccionales.' : 'Falta configurar SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS.',
    senderReady ? 'EMAIL_FROM listo para remitente.' : 'Falta definir EMAIL_FROM para los correos salientes.',
    supportEmailReady ? 'Support email visible para replies y confianza.' : 'Falta SUPPORT_EMAIL para firma y atención.',
    'Conviene definir secuencias de bienvenida, post-venta y seguimiento para que el cliente no se enfríe después de comprar.',
  ];

  return {
    smtpReady,
    senderReady,
    supportEmailReady,
    templates,
    checklist,
  };
}

export function calculateHealthScore(params: {
  activeSubscriptions: number;
  totalUsers: number;
  alertsCount: number;
  paymentReady: boolean;
  smtpReady: boolean;
}) {
  const { activeSubscriptions, totalUsers, alertsCount, paymentReady, smtpReady } = params;
  const activationRatio = totalUsers > 0 ? activeSubscriptions / totalUsers : 0.4;

  let score = 55 + activationRatio * 25;
  if (paymentReady) score += 10;
  if (smtpReady) score += 5;
  score -= alertsCount * 4;

  return Math.max(35, Math.min(97, Math.round(score)));
}

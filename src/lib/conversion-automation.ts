import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

/** Alineado con embudo admin / Stripe: suscripción que cuenta como “pagando”. */
export function isPayingSubscriptionDbStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return s === 'active' || s === 'trialing';
}

export function isPaidStripeSubscriptionStatus(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing';
}

/**
 * No enviar follow-ups comerciales si ya pagó (captura) o tiene suscripción activa/trial.
 * Solo lectura; no altera Stripe ni CRM por tenant.
 */
export async function shouldExcludeRecipientFromSalesFollowup(email: string): Promise<boolean> {
  const trimmed = String(email || '').trim();
  if (!trimmed) return true;

  const paidCapture = await prisma.leadCapture.findFirst({
    where: {
      paid: true,
      email: { equals: trimmed, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (paidCapture) return true;

  const user = await prisma.user.findFirst({
    where: { email: { equals: trimmed, mode: 'insensitive' } },
    select: {
      id: true,
      subscription: { select: { status: true } },
    },
  });
  if (user?.subscription && isPayingSubscriptionDbStatus(user.subscription.status)) {
    return true;
  }

  return false;
}

/**
 * Tras pago confirmado en webhook: onboarding una sola vez + limpiar cola de recuperación en capturas.
 */
export async function onPayingSubscriptionSynced(args: {
  userId: string;
  stripeSubscriptionStatus: Stripe.Subscription.Status;
}): Promise<void> {
  if (!isPaidStripeSubscriptionStatus(args.stripeSubscriptionStatus)) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { id: true, email: true, onboardingStartedAt: true },
  });
  if (!user?.email) return;

  if (!user.onboardingStartedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingStartedAt: new Date() },
    });
    console.info('[conversion-automation] onboarding_started', {
      userId: user.id,
      email: user.email,
      at: new Date().toISOString(),
    });
  }

  await prisma.leadCapture.updateMany({
    where: { email: { equals: user.email, mode: 'insensitive' } },
    data: { needsSalesFollowup: false },
  });
}

const DEFAULT_RECOVERY_MIN_AGE_MS = 60 * 60 * 1000;

/**
 * Marca capturas no pagadas y sin suscripción activa como `needsSalesFollowup` tras un umbral de antigüedad.
 * No envía correos; solo estado. Idempotente para filas ya marcadas.
 */
export async function applyUnpaidLeadRecoveryFlags(options?: {
  now?: Date;
  minAgeMs?: number;
  batchSize?: number;
}): Promise<{ examined: number; marked: number }> {
  const now = options?.now ?? new Date();
  const minAgeMs =
    options?.minAgeMs ??
    (Number(process.env.SALES_RECOVERY_MIN_AGE_MS) > 0
      ? Number(process.env.SALES_RECOVERY_MIN_AGE_MS)
      : DEFAULT_RECOVERY_MIN_AGE_MS);
  const batchSize = Math.min(Math.max(options?.batchSize ?? 3000, 100), 10000);
  const cutoff = new Date(now.getTime() - minAgeMs);

  const candidates = await prisma.leadCapture.findMany({
    where: {
      paid: false,
      needsSalesFollowup: false,
      createdAt: { lte: cutoff },
    },
    select: { id: true, email: true },
    take: batchSize,
  });

  const excludeCache = new Map<string, boolean>();
  const shouldMark = async (rowEmail: string) => {
    const key = rowEmail.trim().toLowerCase();
    if (!key) return false;
    if (excludeCache.has(key)) return !excludeCache.get(key);
    const excluded = await shouldExcludeRecipientFromSalesFollowup(rowEmail);
    excludeCache.set(key, excluded);
    return !excluded;
  };

  const idsToMark: string[] = [];
  for (const row of candidates) {
    if (await shouldMark(row.email)) idsToMark.push(row.id);
  }

  if (idsToMark.length > 0) {
    await prisma.leadCapture.updateMany({
      where: { id: { in: idsToMark } },
      data: { needsSalesFollowup: true, salesFollowupMarkedAt: now },
    });
  }

  return { examined: candidates.length, marked: idsToMark.length };
}

import { Prisma, PrismaClient } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

type Db = Prisma.TransactionClient | PrismaClient;

function isPaidSubscriptionStatus(status: Stripe.Subscription.Status) {
  return status === 'active' || status === 'trialing';
}

/**
 * Funnel ADMIN: persiste `paid` / `convertedToPaidAt` en LeadCapture por email del pagador
 * (Stripe `metadata.userId` → `User.email`, comparación case-insensitive).
 *
 * - `paid` pasa a true mientras la suscripción esté en este estado en el webhook.
 * - `convertedToPaidAt` solo se escribe la primera vez (COALESCE con valor existente).
 *
 * No toca CrmLead, `LeadCapture.userId` ni asignación a CRM por email.
 */
export async function syncPaidLeadCapturesForAdmin(subscription: Stripe.Subscription, db: Db = prisma) {
  if (!isPaidSubscriptionStatus(subscription.status)) {
    return;
  }

  const userId = subscription.metadata?.userId;
  if (!userId) {
    return;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    return;
  }

  const email = user.email.trim();
  if (!email) {
    return;
  }

  const now = new Date();

  await db.$executeRaw`
    UPDATE "LeadCapture"
    SET
      "paid" = true,
      "convertedToPaidAt" = COALESCE("convertedToPaidAt", ${now})
    WHERE LOWER(TRIM("email")) = LOWER(${email})
  `;
}

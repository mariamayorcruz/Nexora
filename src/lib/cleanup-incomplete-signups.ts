import { getAdminEmails, getFounderEmails } from '@/lib/access';
import { prisma } from '@/lib/prisma';

const SESSION_PREFIX = 'session|';
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function protectedEmailSet() {
  return new Set([...getAdminEmails(), ...getFounderEmails()].map((e) => e.toLowerCase()));
}

export type CleanupIncompleteSignupsResult = {
  examined: number;
  deleted: number;
  skippedProtected: number;
};

/**
 * Elimina cuentas abandonadas: suscripción incomplete, sin facturas pagadas,
 * sin stripeSubId (nunca hubo suscripción activa en Stripe enlazada),
 * y registro más antiguo que el umbral. No borra admin/fundador.
 */
export async function cleanupIncompleteSignups(options?: {
  maxAgeMs?: number;
  batchLimit?: number;
}): Promise<CleanupIncompleteSignupsResult> {
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const batchLimit = Math.min(Math.max(options?.batchLimit ?? 200, 1), 1000);
  const cutoff = new Date(Date.now() - maxAgeMs);
  const protectedEmails = protectedEmailSet();

  const candidates = await prisma.user.findMany({
    where: {
      createdAt: { lt: cutoff },
      subscription: {
        is: {
          status: 'incomplete',
          stripeSubId: null,
        },
      },
      invoices: { none: { status: 'paid' } },
    },
    select: { id: true, email: true },
    take: batchLimit,
  });

  const toDelete = candidates.filter((u) => !protectedEmails.has(u.email.trim().toLowerCase()));
  const skippedProtected = candidates.length - toDelete.length;

  for (const u of toDelete) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: { startsWith: `${SESSION_PREFIX}${u.id}|` } },
    });
  }

  if (toDelete.length === 0) {
    return { examined: candidates.length, deleted: 0, skippedProtected };
  }

  const result = await prisma.user.deleteMany({
    where: { id: { in: toDelete.map((u) => u.id) } },
  });

  return {
    examined: candidates.length,
    deleted: result.count,
    skippedProtected,
  };
}

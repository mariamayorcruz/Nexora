import { isInternalOrTestEmail } from '@/lib/access';
import { resolveAppBaseUrlFromEnv } from '@/lib/app-base-url';
import { shouldExcludeRecipientFromSalesFollowup } from '@/lib/conversion-automation';
import { renderCrmTransactionalEmail } from '@/lib/email/template';
import { capitalizeLeadNameForEmail } from '@/lib/format-person-name';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';

/** Plantilla única de recuperación: neutra, sin nombre de producto. */
export const SALES_RECOVERY_FOLLOWUP_SUBJECT = '¿Necesitas ayuda para completar tu registro?';

export function buildSalesRecoveryFollowupBodyText(_greetingName: string): string {
  return `Notamos que tu registro quedó sin completarse.

¿Necesitas ayuda para seguir adelante? Puedes responder a este correo y te orientamos.

Si ya no te interesa o resolviste el proceso por otro canal, puedes ignorar este mensaje.`;
}

const DEFAULT_BATCH_LIMIT = 25;

export type SalesRecoveryFollowupBatchResult = {
  examined: number;
  sent: number;
  skipped: number;
  failed: number;
};

/**
 * Envía un único correo de recuperación por fila LeadCapture elegible.
 * Idempotente por `salesRecoveryFollowupSentAt`; deduplica por email dentro de la misma corrida.
 */
export async function processSalesRecoveryFollowupBatch(options?: {
  limit?: number;
}): Promise<SalesRecoveryFollowupBatchResult> {
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_BATCH_LIMIT, 1), 100);
  const result: SalesRecoveryFollowupBatchResult = {
    examined: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  const candidates = await prisma.leadCapture.findMany({
    where: {
      needsSalesFollowup: true,
      paid: false,
      salesRecoveryFollowupSentAt: null,
    },
    orderBy: [{ salesFollowupMarkedAt: 'asc' }, { createdAt: 'asc' }],
    take: limit * 2,
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  const emailedNormKeys = new Set<string>();

  for (const row of candidates) {
    if (result.sent >= limit) break;
    result.examined += 1;

    const to = String(row.email || '').trim();
    if (!to || isInternalOrTestEmail(to)) {
      result.skipped += 1;
      continue;
    }

    const normKey = to.toLowerCase();
    if (emailedNormKeys.has(normKey)) {
      result.skipped += 1;
      continue;
    }

    if (await shouldExcludeRecipientFromSalesFollowup(to)) {
      result.skipped += 1;
      continue;
    }

    const greetingName = String(row.name || '').trim() || to.split('@')[0] || 'cliente';
    const bodyText = buildSalesRecoveryFollowupBodyText(greetingName);
    const baseUrl = resolveAppBaseUrlFromEnv().replace(/\/$/, '') || 'https://example.invalid';

    const html = renderCrmTransactionalEmail({
      title: SALES_RECOVERY_FOLLOWUP_SUBJECT,
      greetingName,
      bodyText,
      cta: { label: 'Continuar', href: baseUrl },
      brandEyebrow: 'Seguimiento',
    });

    const text = `${SALES_RECOVERY_FOLLOWUP_SUBJECT}\n\nHola ${capitalizeLeadNameForEmail(greetingName)},\n\n${bodyText}\n\nContinuar: ${baseUrl}\n`;

    if (!isEmailDeliveryConfigured()) {
      result.failed += 1;
      console.warn('[sales-recovery-followup] SMTP/Resend not configured; skip send', { to: row.id });
      continue;
    }

    const sendResult = await sendTransactionalEmail({
      to,
      subject: SALES_RECOVERY_FOLLOWUP_SUBJECT,
      html,
      text,
      audit: { flow: 'sales-recovery-followup' },
    });

    if (sendResult.delivered) {
      await prisma.leadCapture.update({
        where: { id: row.id },
        data: { salesRecoveryFollowupSentAt: new Date() },
      });
      emailedNormKeys.add(normKey);
      result.sent += 1;
      console.info('[sales-recovery-followup] sent', { leadCaptureId: row.id, to });
    } else {
      result.failed += 1;
      console.warn('[sales-recovery-followup] not delivered', {
        leadCaptureId: row.id,
        to,
        reason: 'reason' in sendResult ? sendResult.reason : 'unknown',
      });
    }
  }

  return result;
}

import { randomUUID } from 'node:crypto';
import type Mail from 'nodemailer/lib/mailer';
import { NextRequest, NextResponse } from 'next/server';
import { resolveAppBaseUrlFromEnv } from '@/lib/app-base-url';
import { displayNameForAudit, getAuditPricingUrl } from '@/lib/audit-flow';
import { isInternalOrTestEmail } from '@/lib/access';
import { shouldExcludeRecipientFromSalesFollowup } from '@/lib/conversion-automation';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { renderCrmTransactionalEmail } from '@/lib/email/template';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/mailer';
import { generateAuditPdf } from '@/lib/pdf/generateAuditPdf';
import {
  applyTemplateVars,
  parseStoredCadence,
  resolveMeetingLink,
  serializeCadence,
  toMailerAttachments,
  filterVisibleSentLogs,
  type SalesEngineConfig,
} from '@/lib/crm-sequences';

/** CTA principal: compra / aplicar auditoría (#pricing). El enlace de reunión sigue pudiendo ir en el cuerpo vía {{meeting_link}}. */
const CRM_FOLLOWUP_PRIMARY_CTA = {
  label: 'Suscríbete ahora',
  href: getAuditPricingUrl(),
} as const;

/** Tras el CTA; mismo orden en HTML y texto plano. */
const CRM_LEAD_FOLLOWUP_POST_CTA =
  'No es una llamada genérica: saldrás con claridad sobre qué hacer y qué evitar.\n\nQuedo atenta,\nEquipo de soporte';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.crmWorkspaceSettings.findUnique({ where: { userId } });
    const parsed = parseStoredCadence(settings?.defaultCadence);

    return NextResponse.json({
      templates: parsed.salesEngine.followUpTemplates,
      sentLogs: filterVisibleSentLogs(parsed.salesEngine.sentLogs),
      meetingLinks: parsed.salesEngine.meetingLinks,
      calendar: parsed.salesEngine.calendar,
    });
  } catch (error) {
    console.error('Error fetching followups:', error);
    return NextResponse.json({ error: 'Error fetching followups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      leadId?: string;
      to?: string;
      templateId?: string;
      subject?: string;
      body?: string;
    };

    const settings = await prisma.crmWorkspaceSettings.findUnique({ where: { userId } });
    const parsed = parseStoredCadence(settings?.defaultCadence);
    const salesEngine = parsed.salesEngine;

    let to = String(body.to || '').trim();
    let leadName = 'cliente';

    if (!to && body.leadId) {
      const lead = await prisma.crmLead.findFirst({
        where: { id: String(body.leadId), userId },
      });

      if (!lead) {
        return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 });
      }

      if (lead.email) {
        to = lead.email;
        leadName = lead.name;
      } else {
        const linkedCapture = await prisma.leadCapture.findFirst({
          where: {
            crmLeadId: lead.id,
            userId,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            email: true,
            name: true,
          },
        });

        if (!linkedCapture?.email) {
          return NextResponse.json(
            {
              error:
                'Este lead no tiene email en CRM ni en capturas. Agrega email para enviar follow-up.',
            },
            { status: 400 }
          );
        }

        to = linkedCapture.email;
        leadName = linkedCapture.name || lead.name;
      }
    }

    if (!to) {
      return NextResponse.json({ error: 'Email de destinatario requerido.' }, { status: 400 });
    }
    if (isInternalOrTestEmail(to)) {
      return NextResponse.json(
        { error: 'No enviamos follow-ups comerciales a cuentas internas o de prueba.' },
        { status: 400 }
      );
    }

    if (await shouldExcludeRecipientFromSalesFollowup(to)) {
      return NextResponse.json(
        {
          error:
            'Este contacto ya está pagando (suscripción activa o captura marcada como pagada). No se envían follow-ups comerciales.',
        },
        { status: 400 }
      );
    }

    leadName = String(leadName ?? '').trim() || 'cliente';
    const recipientDisplayName = displayNameForAudit(
      leadName.toLowerCase() === 'cliente' ? null : leadName,
      to
    );

    const template =
      salesEngine.followUpTemplates.find((item) => item.id === body.templateId) ||
      salesEngine.followUpTemplates.find((item) => item.active && item.trigger === 'lead_followup') ||
      salesEngine.followUpTemplates[0];

    const meetingLink = resolveMeetingLink(salesEngine);
    const dashboardUrl = `${resolveAppBaseUrlFromEnv().replace(/\/$/, '')}/dashboard`;
    const subject = applyTemplateVars(String(body.subject || template?.subject || 'Seguimiento de tu solicitud').trim(), {
      name: recipientDisplayName,
      meetingLink: meetingLink || '',
      dashboardUrl,
      email: to,
    });
    const bodyText = applyTemplateVars(String(body.body || template?.body || ''), {
      name: recipientDisplayName,
      meetingLink: meetingLink || '',
      dashboardUrl,
      email: to,
    });

    let status: 'sent' | 'failed' | 'pending_setup' = 'pending_setup';

    const textMail = `${bodyText}\n\n${CRM_FOLLOWUP_PRIMARY_CTA.label}: ${CRM_FOLLOWUP_PRIMARY_CTA.href}${
      meetingLink ? `\n\nSi prefieres agendar una llamada: ${meetingLink}` : ''
    }\n\n${CRM_LEAD_FOLLOWUP_POST_CTA}`;

    const html = renderCrmTransactionalEmail({
      title: subject.length > 200 ? `${subject.slice(0, 197)}…` : subject,
      greetingName: recipientDisplayName,
      bodyText: bodyText,
      cta: { label: CRM_FOLLOWUP_PRIMARY_CTA.label, href: CRM_FOLLOWUP_PRIMARY_CTA.href },
      postCtaText: CRM_LEAD_FOLLOWUP_POST_CTA,
      brandEyebrow: 'Tu equipo',
    });

    if (isEmailDeliveryConfigured()) {
      try {
        let auditPdfAttachment: Mail.Attachment[] = [];
        try {
          const pdfBytes = await generateAuditPdf({
            recipientName: leadName.toLowerCase() === 'cliente' ? null : leadName,
            recipientEmail: to,
            variantLabel: null,
          });
          auditPdfAttachment = [
            {
              filename: 'auditoria-nexora.pdf',
              content: Buffer.from(pdfBytes),
              contentType: 'application/pdf',
            },
          ];
        } catch (pdfErr) {
          console.error('[crm/followups] generateAuditPdf failed:', pdfErr);
        }

        const attachments = [...auditPdfAttachment, ...toMailerAttachments(template)];
        const result = await sendTransactionalEmail({
          to,
          subject,
          text: textMail,
          html,
          attachments,
          audit: { flow: 'crm-followups' },
        });
        const delivered = result.delivered;
        console.info('[email-flow:crm-followups]', {
          flow: 'crm-followups',
          templateId: template?.id,
          trigger: template?.trigger,
          subjectPreview: subject.slice(0, 120),
          attachmentCount: attachments.length,
          to,
          delivered,
          failureReason: 'reason' in result ? result.reason : undefined,
          provider: result.meta?.provider,
          from: result.meta?.from,
          providerResponse: result.meta?.providerResponse,
          resendSkippedDueToAttachments: result.meta?.resendSkippedDueToAttachments,
        });
        if (delivered) {
          status = 'sent';
        } else {
          console.error('[crm/followups] Email not delivered:', result);
          status = 'failed';
        }
      } catch (e) {
        console.error('[crm/followups] sendTransactionalEmail error:', e);
        console.info('[email-flow:crm-followups]', {
          flow: 'crm-followups',
          delivered: false,
          to,
          templateId: template?.id,
          trigger: template?.trigger,
          failureReason: e instanceof Error ? e.message : String(e),
          note: 'exception_before_result',
        });
        status = 'failed';
      }
    }

    const nextLogs = [
      {
        id: randomUUID(),
        to,
        subject,
        status,
        sentAt: new Date().toISOString(),
        templateId: template?.id,
        trigger: template?.trigger,
      },
      ...salesEngine.sentLogs,
    ].slice(0, 100);

    const nextEngine: SalesEngineConfig = {
      ...salesEngine,
      sentLogs: nextLogs,
    };

    await prisma.crmWorkspaceSettings.upsert({
      where: { userId },
      update: {
        defaultCadence: serializeCadence({
          cadence: parsed.cadence || '48h',
          salesEngine: nextEngine,
        }),
      },
      create: {
        userId,
        emailAutomationEnabled: true,
        whatsappEnabled: false,
        phoneEnabled: false,
        externalCrmEnabled: false,
        autoFollowUpEnabled: true,
        defaultCadence: serializeCadence({
          cadence: parsed.cadence || '48h',
          salesEngine: nextEngine,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      status,
      sentLog: nextLogs[0],
    });
  } catch (error) {
    console.error('Error sending followup:', error);
    return NextResponse.json({ error: 'Error sending followup' }, { status: 500 });
  }
}

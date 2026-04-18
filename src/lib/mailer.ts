import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { renderBaseEmailTemplate } from '@/lib/email/template';
import { resolveAppBaseUrlFromEnv } from '@/lib/app-base-url';

function readEnv(name: string) {
  const value = process.env[name];
  // Vercel CLI sometimes exports values with literal \r\n — strip them
  const trimmed = value?.replace(/\\r\\n/g, '').replace(/\r\n/g, '').trim();
  return trimmed ? trimmed : undefined;
}

function getSmtpConfig() {
  const host = readEnv('SMTP_HOST');
  const port = Number(readEnv('SMTP_PORT') || 587);
  const user = readEnv('SMTP_USER');
  const pass = readEnv('SMTP_PASS');
  const from = readEnv('EMAIL_FROM');

  return {
    host,
    port,
    user,
    pass,
    from,
    ready: Boolean(host && user && pass && from),
  };
}

function getResendFrom(): string | undefined {
  return readEnv('RESEND_FROM') || readEnv('EMAIL_FROM');
}

/** When `RESEND_USE_TEST_FROM=1` or `true`, Resend sends from onboarding@resend.dev (verified sandbox). Remove after domain DNS is verified. */
function usesResendTestFrom(): boolean {
  const v = readEnv('RESEND_USE_TEST_FROM');
  return v === '1' || v?.toLowerCase() === 'true';
}

function getResendFromAddress(): string | undefined {
  if (usesResendTestFrom()) {
    return 'onboarding@resend.dev';
  }
  return getResendFrom();
}

function isResendConfigured() {
  const key = readEnv('RESEND_API_KEY');
  if (!key) return false;
  if (usesResendTestFrom()) return true;
  return Boolean(getResendFrom());
}

export function isEmailDeliveryConfigured() {
  return getSmtpConfig().ready || isResendConfigured();
}

async function sendViaResend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<{ delivered: true; id?: string } | { delivered: false; reason: string }> {
  const key = readEnv('RESEND_API_KEY');
  const from = getResendFromAddress();
  if (!key || !from) {
    const reason = !key ? 'missing_resend_api_key' : 'missing_resend_from';
    console.error('[mailer] Resend skipped:', reason);
    return { delivered: false, reason };
  }

  if (usesResendTestFrom()) {
    console.warn('[mailer] Resend using test From (onboarding@resend.dev). Set RESEND_USE_TEST_FROM=0 after domain verify.');
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo || readEnv('SUPPORT_EMAIL') || from,
      }),
    });

    const rawBody = await res.text();
    if (!res.ok) {
      console.error('[mailer] Resend HTTP error', res.status, rawBody.slice(0, 500));
      return { delivered: false, reason: `resend_${res.status}:${rawBody.slice(0, 200)}` };
    }

    let id: string | undefined;
    try {
      const parsed = JSON.parse(rawBody) as { id?: string };
      id = parsed.id;
    } catch {
      console.warn('[mailer] Resend OK but response not JSON:', rawBody.slice(0, 200));
    }

    console.info('[mailer] Resend accepted email', { id, to: input.to, from });
    return { delivered: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[mailer] Resend request failed:', msg, e);
    return { delivered: false, reason: `resend_network:${msg}` };
  }
}

export type SendTransactionalAuditMeta = {
  flow: string;
  provider: 'resend' | 'smtp' | 'none';
  from: string;
  providerResponse?: string;
  attachmentCount: number;
  resendSkippedDueToAttachments: boolean;
};

export type SendTransactionalResult =
  | { delivered: true; meta?: SendTransactionalAuditMeta }
  | { delivered: false; reason: string; meta?: SendTransactionalAuditMeta };

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Mail.Attachment[];
  /** When set, attaches `meta` to the result for structured delivery logs (use sparingly; e.g. CRM follow-ups). */
  audit?: { flow: string };
}): Promise<SendTransactionalResult> {
  const auditFlow = input.audit?.flow;
  const attachmentCount = input.attachments?.length ?? 0;
  const resendSkippedDueToAttachments = attachmentCount > 0;
  let resendFailReason: string | undefined;

  if (isResendConfigured() && attachmentCount === 0) {
    const resendFrom = getResendFromAddress() || '';
    const r = await sendViaResend({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    if (r.delivered) {
      const id = 'id' in r ? r.id : undefined;
      return {
        delivered: true as const,
        meta: auditFlow
          ? {
              flow: auditFlow,
              provider: 'resend',
              from: resendFrom,
              providerResponse: id ? `id:${id}` : 'accepted',
              attachmentCount,
              resendSkippedDueToAttachments,
            }
          : undefined,
      };
    }
    resendFailReason = 'reason' in r ? r.reason : 'resend_unknown';
    console.error('[mailer] Resend did not deliver; will try SMTP if configured. Reason:', resendFailReason);
  }

  const config = getSmtpConfig();

  if (!config.ready) {
    const reason = 'missing_smtp_and_resend_failed';
    console.error('[mailer] No SMTP config and Resend path unavailable or failed.', { to: input.to });
    return {
      delivered: false as const,
      reason,
      meta: auditFlow
        ? {
            flow: auditFlow,
            provider: 'none',
            from: getResendFromAddress() || config.from || '',
            providerResponse: resendFailReason || 'smtp_not_configured',
            attachmentCount,
            resendSkippedDueToAttachments,
          }
        : undefined,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    const info = await transporter.sendMail({
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo || readEnv('SUPPORT_EMAIL') || config.from,
      attachments: input.attachments,
    });

    console.info('[mailer] SMTP sendMail accepted', {
      to: input.to,
      messageId: info.messageId,
      response: info.response,
    });
    const smtpResponse = String(info.response || info.messageId || '').slice(0, 500);
    return {
      delivered: true as const,
      meta: auditFlow
        ? {
            flow: auditFlow,
            provider: 'smtp',
            from: config.from || '',
            providerResponse: resendFailReason
              ? `smtp_ok_after_resend_failed:${resendFailReason.slice(0, 200)} | ${smtpResponse}`
              : smtpResponse,
            attachmentCount,
            resendSkippedDueToAttachments,
          }
        : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[mailer] SMTP sendMail failed:', msg, e);
    const combined = [resendFailReason, `smtp:${msg}`].filter(Boolean).join(' | ').slice(0, 500);
    return {
      delivered: false as const,
      reason: `smtp_error:${msg}`,
      meta: auditFlow
        ? {
            flow: auditFlow,
            provider: 'none',
            from: config.from || '',
            providerResponse: combined || msg,
            attachmentCount,
            resendSkippedDueToAttachments,
          }
        : undefined,
    };
  }
}

/**
 * Correo explícito tras el registro para emails de admin/founder (enlaces a login, dashboard y admin).
 */
export async function sendRegistrationTeamWelcome(input: {
  to: string;
  name: string;
  founderAccess: boolean;
  isAdmin: boolean;
}) {
  if (!isEmailDeliveryConfigured()) {
    return { delivered: false as const, reason: 'email_not_configured' as const };
  }

  const origin = resolveAppBaseUrlFromEnv().replace(/\/$/, '');
  const loginUrl = `${origin}/auth/login`;
  const dashboardUrl = `${origin}/dashboard`;
  const adminUrl = `${origin}/admin`;

  const lines: string[] = [
    `Hola ${input.name || 'equipo'},`,
    '',
    'Tu cuenta quedó creada correctamente.',
  ];

  if (input.founderAccess) {
    lines.push(
      '',
      'Como cuenta founder, tu plan y periodo de prueba se aplicaron según la configuración del servidor.'
    );
  }
  if (input.isAdmin) {
    lines.push('', 'Tienes acceso al panel de administración.');
  }

  lines.push(
    '',
    `Iniciar sesión: ${loginUrl}`,
    `Panel (dashboard): ${dashboardUrl}`,
    ...(input.isAdmin ? [`Administración: ${adminUrl}`] : []),
    '',
    'Si no solicitaste esta cuenta, ignora este mensaje.',
    '',
    '— Tu equipo'
  );

  const text = lines.join('\n');

  const contentHtml = [
    `<p style="margin:0 0 16px 0;">Hola ${escapeHtml(input.name || 'equipo')},</p>`,
    `<p style="margin:0 0 16px 0;">Tu cuenta quedó creada correctamente.</p>`,
    input.founderAccess
      ? `<p style="margin:0 0 16px 0;">Como cuenta <strong>founder</strong>, tu plan y periodo de prueba se aplicaron según la configuración del servidor.</p>`
      : '',
    input.isAdmin
      ? `<p style="margin:0 0 16px 0;">Tienes acceso al <strong>panel de administración</strong>.</p>`
      : '',
    `<p style="margin:0;">Accesos directos: <a href="${escapeAttr(dashboardUrl)}" style="color:#0284c7;text-decoration:underline;">Ir al dashboard</a>${input.isAdmin ? ` · <a href="${escapeAttr(adminUrl)}" style="color:#0284c7;text-decoration:underline;">Panel admin</a>` : ''}</p>`,
  ]
    .filter(Boolean)
    .join('');

  const footerHtml = `<p style="margin:0 0 8px 0;">Si no solicitaste esta cuenta, ignora este mensaje.</p><p style="margin:0;">— Tu equipo</p>`;

  const html = renderBaseEmailTemplate({
    title: 'Tu cuenta está lista',
    contentHtml,
    cta: { label: 'Iniciar sesión', href: loginUrl },
    footerHtml,
  });

  return sendTransactionalEmail({
    to: input.to,
    subject: 'Tu cuenta de equipo está lista',
    html,
    text,
    replyTo: readEnv('SUPPORT_EMAIL'),
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

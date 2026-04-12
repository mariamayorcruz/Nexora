import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { resolveAppBaseUrlFromEnv } from '@/lib/app-base-url';

function readEnv(name: string) {
  const value = process.env[name];
  const trimmed = value?.trim();
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

function isResendConfigured() {
  return Boolean(readEnv('RESEND_API_KEY') && getResendFrom());
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
}): Promise<{ delivered: true } | { delivered: false; reason: string }> {
  const key = readEnv('RESEND_API_KEY');
  const from = getResendFrom();
  if (!key || !from) {
    return { delivered: false, reason: 'missing_resend' };
  }

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

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { delivered: false, reason: `resend_${res.status}:${body.slice(0, 200)}` };
  }

  return { delivered: true };
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Mail.Attachment[];
}) {
  if (isResendConfigured() && (!input.attachments || input.attachments.length === 0)) {
    try {
      const r = await sendViaResend({
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
      });
      if (r.delivered) {
        return { delivered: true as const };
      }
    } catch (e) {
      console.warn('[mailer] Resend failed, trying SMTP if configured:', e);
    }
  }

  const config = getSmtpConfig();

  if (!config.ready) {
    return { delivered: false as const, reason: 'missing_smtp' as const };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo || readEnv('SUPPORT_EMAIL') || config.from,
    attachments: input.attachments,
  });

  return { delivered: true as const };
}

/**
 * Correo explícito tras el registro para emails de admin/founder (enlaces a login, dashboard y admin).
 */
export async function sendRegistrationTeamWelcome(input: {
  to: string;
  name: string;
  baseUrl?: string;
  founderAccess: boolean;
  isAdmin: boolean;
}) {
  if (!isEmailDeliveryConfigured()) {
    return { delivered: false as const, reason: 'email_not_configured' as const };
  }

  const origin = (input.baseUrl || resolveAppBaseUrlFromEnv()).replace(/\/$/, '');
  const loginUrl = `${origin}/auth/login`;
  const dashboardUrl = `${origin}/dashboard`;
  const adminUrl = `${origin}/admin`;

  const lines: string[] = [
    `Hola ${input.name || 'equipo'},`,
    '',
    'Tu cuenta en GotNexora quedó creada correctamente.',
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
    '— GotNexora'
  );

  const text = lines.join('\n');

  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
<p>Hola ${escapeHtml(input.name || 'equipo')},</p>
<p>Tu cuenta en <strong>GotNexora</strong> quedó creada correctamente.</p>
${input.founderAccess ? '<p>Como cuenta <strong>founder</strong>, tu plan y periodo de prueba se aplicaron según la configuración del servidor.</p>' : ''}
${input.isAdmin ? '<p>Tienes acceso al <strong>panel de administración</strong>.</p>' : ''}
<ul>
  <li><a href="${escapeAttr(loginUrl)}">Iniciar sesión</a></li>
  <li><a href="${escapeAttr(dashboardUrl)}">Ir al dashboard</a></li>
  ${input.isAdmin ? `<li><a href="${escapeAttr(adminUrl)}">Panel admin</a></li>` : ''}
</ul>
<p style="color:#666;font-size:14px;">Si no solicitaste esta cuenta, ignora este mensaje.</p>
<p>— GotNexora</p>
</body></html>`.trim();

  return sendTransactionalEmail({
    to: input.to,
    subject: 'GotNexora — Cuenta de equipo lista',
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

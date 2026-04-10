import nodemailer from 'nodemailer';

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;

  return {
    host,
    port,
    user,
    pass,
    from,
    ready: Boolean(host && user && pass && from),
  };
}

export function isEmailDeliveryConfigured() {
  return getSmtpConfig().ready;
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) {
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
    replyTo: input.replyTo || process.env.SUPPORT_EMAIL || config.from,
  });

  return { delivered: true as const };
}

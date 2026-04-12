import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, validateEmail } from '@/lib/auth';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

type ProvisionPayload = {
  email?: string;
  name?: string;
  tier?: 'starter' | 'pro' | 'professional' | 'enterprise';
  initialPassword?: string;
};

function getWebhookSecretFromRequest(request: NextRequest) {
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return (request.headers.get('x-gotnexora-secret') || '').trim();
}

function normalizeTier(value: string | undefined) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'pro' || raw === 'professional') return 'professional';
  if (raw === 'enterprise') return 'enterprise';
  return 'starter';
}

function randomPassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*';
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

function resolveLoginUrl() {
  const direct = process.env.NEXORA_STUDIO_LOGIN_URL?.trim();
  if (direct) return direct;

  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth) return `${nextAuth.replace(/\/$/, '')}/auth/login`;

  const domain = process.env.NEXT_PUBLIC_DOMAIN?.trim();
  if (domain) {
    const base = domain.startsWith('http') ? domain : `https://${domain}`;
    return `${base.replace(/\/$/, '')}/auth/login`;
  }

  return 'https://www.gotnexora.com/auth/login';
}

function resolveExternalProvisionUrl() {
  const base = (process.env.NEXORA_STUDIO_API_BASE_URL || '').trim();
  if (!base) return '';
  return `${base.replace(/\/$/, '')}/api/v1/integrations/gotnexora/provision`;
}

async function sendProvisionEmail(input: {
  email: string;
  name: string;
  password: string;
  plan: string;
}) {
  const loginUrl = resolveLoginUrl();
  const subject = 'Tu acceso a Nexora está listo';
  const text = [
    `Hola ${input.name},`,
    '',
    'Tu cuenta de Nexora fue creada correctamente.',
    `Plan activado: ${input.plan}`,
    '',
    `Login: ${loginUrl}`,
    `Usuario: ${input.email}`,
    `Contraseña temporal: ${input.password}`,
    '',
    'Te recomendamos cambiar la contraseña después del primer acceso.',
    '',
    'Equipo Nexora',
  ].join('\n');

  await sendTransactionalEmail({
    to: input.email,
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${text}</div>`,
  });
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = (process.env.GOTNEXORA_WEBHOOK_SECRET || '').trim();
    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'GOTNEXORA_WEBHOOK_SECRET no está configurado en Nexora.' },
        { status: 503 }
      );
    }

    const providedSecret = getWebhookSecretFromRequest(request);
    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized webhook request.' }, { status: 401 });
    }

    const body = (await request.json()) as ProvisionPayload;

    const proxyUrl = resolveExternalProvisionUrl();
    if (proxyUrl) {
      const proxyResponse = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${providedSecret}`,
          'X-Gotnexora-Secret': providedSecret,
        },
        body: JSON.stringify(body),
      });

      const proxyPayload = await proxyResponse.json().catch(() => ({
        error: 'No se pudo leer respuesta de provisión externa.',
      }));

      return NextResponse.json(proxyPayload, { status: proxyResponse.status });
    }

    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim() || email.split('@')[0] || 'Usuario';
    const plan = normalizeTier(body.tier);

    if (!email || !validateEmail(email)) {
      return NextResponse.json({ error: 'Email inválido o ausente.' }, { status: 400 });
    }

    const providedPassword = String(body.initialPassword || '').trim();
    const hasProvidedPassword = Boolean(providedPassword);

    if (hasProvidedPassword && (providedPassword.length < 12 || providedPassword.length > 128)) {
      return NextResponse.json(
        { error: 'initialPassword debe tener entre 12 y 128 caracteres.' },
        { status: 400 }
      );
    }

    if (!hasProvidedPassword && !isEmailDeliveryConfigured()) {
      return NextResponse.json(
        {
          error:
            'No hay Resend/SMTP configurado en Nexora para enviar credenciales. Envía initialPassword desde GotNexora o configura email delivery.',
        },
        { status: 412 }
      );
    }

    const plainPassword = hasProvidedPassword ? providedPassword : randomPassword(18);
    const hashedPassword = await hashPassword(plainPassword);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });

      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              name,
              password: hashedPassword,
            },
          })
        : await tx.user.create({
            data: {
              email,
              name,
              password: hashedPassword,
            },
          });

      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);

      const subscription = await tx.subscription.upsert({
        where: { userId: user.id },
        update: {
          plan,
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
        create: {
          userId: user.id,
          plan,
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });

      return { user, subscription, existed: Boolean(existing) };
    });

    if (!hasProvidedPassword) {
      await sendProvisionEmail({
        email: result.user.email,
        name: result.user.name || name,
        password: plainPassword,
        plan: result.subscription.plan,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        mode: hasProvidedPassword ? 'gotnexora-sends-email' : 'nexora-sends-email',
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        subscription: {
          plan: result.subscription.plan,
          status: result.subscription.status,
        },
        existed: result.existed,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('GotNexora provision error:', error);
    return NextResponse.json({ error: 'No se pudo provisionar el usuario.' }, { status: 500 });
  }
}

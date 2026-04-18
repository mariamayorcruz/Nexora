import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma, withPrismaRetry } from '@/lib/prisma';
import { hashPassword, validateEmail, validatePassword } from '@/lib/auth';
import {
  getFounderPlan,
  getFounderTrialDays,
  isAdminEmail,
  isFounderEmail,
  isInternalOrTestEmail,
} from '@/lib/access';
import { signUserToken } from '@/lib/jwt';
import { dispatchOnboardingSequence } from '@/lib/crm-sequences';
import { sendRegistrationTeamWelcome, isEmailDeliveryConfigured } from '@/lib/mailer';
import { createSessionId, upsertUserSession } from '@/lib/user-sessions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, marketingOptIn } = await request.json();
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const optedInToMarketing = Boolean(marketingOptIn);

    // Validar datos
    if (!cleanEmail || !password || !cleanName) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    if (!validateEmail(cleanEmail)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    const { valid, errors } = validatePassword(password);
    if (!valid) {
      return NextResponse.json(
        { error: errors.join('; ') },
        { status: 400 }
      );
    }

    const founderAccess = isFounderEmail(cleanEmail);
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + (founderAccess ? getFounderTrialDays() : 7));

    const registration = await withPrismaRetry(async () => {
      const existingUser = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (existingUser) {
        return { status: 'duplicate' as const };
      }

      const hashedPassword = await hashPassword(password);

      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            name: cleanName,
            email: cleanEmail,
            password: hashedPassword,
            marketingOptIn: optedInToMarketing,
            marketingOptInAt: optedInToMarketing ? new Date() : null,
            nurtureStatus: optedInToMarketing ? 'eligible' : 'not-consented',
            nextNurtureSendAt: optedInToMarketing
              ? new Date(Date.now() + 24 * 60 * 60 * 1000)
              : null,
          },
        });

        await tx.subscription.create({
          data: {
            userId: createdUser.id,
            plan: founderAccess ? getFounderPlan() : 'starter',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndDate,
          },
        });

        return createdUser;
      });

      const sid = createSessionId();
      await upsertUserSession({
        userId: user.id,
        sid,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for'),
      });

      const token = signUserToken({ userId: user.id, email: user.email, sid });

      return { status: 'ok' as const, user, token, founderAccess };
    });

    if (registration.status === 'duplicate') {
      return NextResponse.json(
        { error: 'El email ya está registrado' },
        { status: 400 }
      );
    }

    const { user, token, founderAccess: founderFlag } = registration;

    if (!isInternalOrTestEmail(cleanEmail)) {
      try {
        await dispatchOnboardingSequence({
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        });
      } catch (sequenceError) {
        console.error('Onboarding sequence dispatch failed:', sequenceError);
      }
    }

    const adminOrFounder = isAdminEmail(cleanEmail) || founderFlag;
    if (adminOrFounder && isEmailDeliveryConfigured()) {
      try {
        const result = await sendRegistrationTeamWelcome({
          to: cleanEmail,
          name: cleanName,
          founderAccess: founderFlag,
          isAdmin: isAdminEmail(cleanEmail),
        });
        if (!result.delivered) {
          console.warn('[register] Team welcome email not delivered:', result);
        }
      } catch (mailErr) {
        console.error('[register] Team welcome email failed:', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        founderAccess: founderFlag,
      },
    });
  } catch (error: unknown) {
    const details =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === 'development'
                ? error.stack
                : undefined,
          }
        : { error };

    console.error('Register error:', details);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'El email ya está registrado' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo guardar tu cuenta. Intenta nuevamente.' },
        { status: 500 }
      );
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: 'La conexion con la base de datos no esta lista. Intenta de nuevo en unos minutos.' },
        { status: 500 }
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: 'La configuracion del servidor no coincide con la base de datos actual.' },
        { status: 500 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('DATABASE_URL')) {
        return NextResponse.json(
          { error: 'Configuración de base de datos incompleta. Contacta soporte.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'No pudimos crear tu cuenta en este momento. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword, validateEmail, validatePassword } from '@/lib/auth';
import { getFounderPlan, getFounderTrialDays, isFounderEmail } from '@/lib/access';
import jwt from 'jsonwebtoken';

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

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'El email ya está registrado' },
        { status: 400 }
      );
    }

    // Hashear contraseña
    const hashedPassword = await hashPassword(password);

    // Crear suscripción por defecto (plan Starter con 7 días de prueba)
    const founderAccess = isFounderEmail(cleanEmail);
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + (founderAccess ? getFounderTrialDays() : 7));

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          password: hashedPassword,
          marketingOptIn: optedInToMarketing,
          marketingOptInAt: optedInToMarketing ? new Date() : null,
          nurtureStatus: optedInToMarketing ? 'eligible' : 'not-consented',
          nextNurtureSendAt: optedInToMarketing ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
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

    // Generar token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        founderAccess,
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

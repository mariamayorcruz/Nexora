import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword, validateEmail, validatePassword } from '@/lib/auth';
import { getFounderPlan, getFounderTrialDays, isFounderEmail } from '@/lib/access';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

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
    console.error('Register error:', error);

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

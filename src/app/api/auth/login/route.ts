import { NextRequest, NextResponse } from 'next/server';
import { prisma, withPrismaRetry } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { signUserToken } from '@/lib/jwt';
import { dispatchOnboardingSequence } from '@/lib/crm-sequences';
import { createSessionId, upsertUserSession } from '@/lib/user-sessions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const authResult = await withPrismaRetry(async () => {
      const user = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (!user) {
        return { ok: false as const };
      }

      const validPassword = await verifyPassword(password, user.password);

      if (!validPassword) {
        return { ok: false as const };
      }

      try {
        await dispatchOnboardingSequence({
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        });
      } catch (sequenceError) {
        console.error('Onboarding sequence dispatch failed on login:', sequenceError);
      }

      const sid = createSessionId();
      await upsertUserSession({
        userId: user.id,
        sid,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for'),
      });

      const token = signUserToken({ userId: user.id, email: user.email, sid });

      return {
        ok: true as const,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    });

    if (!authResult.ok) {
      return NextResponse.json(
        { error: 'Email o contraseña incorrectos' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      token: authResult.token,
      user: authResult.user,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error al iniciar sesión' },
      { status: 500 }
    );
  }
}

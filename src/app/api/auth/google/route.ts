import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { signUserToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createSessionId, upsertUserSession } from '@/lib/user-sessions';
import { ensureUserOrganization } from '@/lib/tenancy/ensure-user-organization';

export const dynamic = 'force-dynamic';

type GoogleTokenInfo = {
  email?: string;
  name?: string;
  sub?: string;
  aud?: string;
  email_verified?: string | boolean;
};

export async function POST(request: NextRequest) {
  try {
    const { credential } = (await request.json()) as { credential?: string };
    if (!credential) {
      return NextResponse.json({ error: 'Missing credential' }, { status: 400 });
    }

    const googleResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { cache: 'no-store' }
    );

    if (!googleResponse.ok) {
      return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
    }

    const googleData = (await googleResponse.json()) as GoogleTokenInfo;
    const email = String(googleData.email || '')
      .trim()
      .toLowerCase();
    const name = String(googleData.name || '').trim();
    const googleId = String(googleData.sub || '').trim();
    const audience = String(googleData.aud || '').trim();
    const configuredClientId = String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();

    if (!email) {
      return NextResponse.json({ error: 'No email from Google' }, { status: 400 });
    }

    if (configuredClientId && audience && audience !== configuredClientId) {
      return NextResponse.json({ error: 'Google token audience mismatch' }, { status: 401 });
    }

    if (googleData.email_verified === false || googleData.email_verified === 'false') {
      return NextResponse.json({ error: 'Google email is not verified' }, { status: 401 });
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const hashedPassword = await hashPassword(`google_${googleId || email}`);
      user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            name: name || email.split('@')[0],
            password: hashedPassword,
            onboardingCompletedAt: null,
          },
        });
        await ensureUserOrganization(tx, {
          userId: createdUser.id,
          onboardingData: createdUser.onboardingData,
        });
        return createdUser;
      });
    } else {
      // Existing identity: idempotent ensure only (fail closed on incompatible tenant state).
      await prisma.$transaction(async (tx) => {
        await ensureUserOrganization(tx, {
          userId: user!.id,
          onboardingData: user!.onboardingData,
        });
      });
    }

    const sid = createSessionId();
    await upsertUserSession({
      userId: user.id,
      sid,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for'),
    });

    const token = signUserToken({ userId: user.id, email: user.email, sid });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json({ error: 'Error en autenticacion con Google' }, { status: 500 });
  }
}

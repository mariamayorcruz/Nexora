import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, signUserToken, verifyUserTokenAllowExpired } from '@/lib/jwt';
import { getUserSession, upsertUserSession } from '@/lib/user-sessions';

export const dynamic = 'force-dynamic';

/**
 * Rotates a short-lived access token while the underlying session is still alive.
 * Closing a session from the security settings revokes the refresh immediately.
 */
export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyUserTokenAllowExpired(token);
    if (!decoded?.userId || !decoded.sid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const session = await getUserSession(decoded.sid);
    if (!session || session.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    await upsertUserSession({
      userId: user.id,
      sid: decoded.sid,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for'),
    });

    return NextResponse.json({
      success: true,
      token: signUserToken({ userId: user.id, email: user.email, sid: decoded.sid }),
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('Token refresh failed:', error);
    return NextResponse.json({ error: 'Error refreshing session' }, { status: 500 });
  }
}

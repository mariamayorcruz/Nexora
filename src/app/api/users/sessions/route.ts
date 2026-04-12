import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';
import { closeOtherSessions, listUserSessions, upsertUserSession } from '@/lib/user-sessions';

export const dynamic = 'force-dynamic';

function getSessionContext(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return null;

  const decoded = verifyUserToken(token);
  if (!decoded?.userId) return null;

  return {
    userId: decoded.userId,
    sid: decoded.sid,
  };
}

export async function GET(request: NextRequest) {
  try {
    const context = getSessionContext(request);
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (context.sid) {
      await upsertUserSession({
        userId: context.userId,
        sid: context.sid,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for'),
      });
    }

    const sessions = await listUserSessions(context.userId, context.sid);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    return NextResponse.json({ error: 'No se pudieron cargar las sesiones.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = getSessionContext(request);
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const removed = await closeOtherSessions(context.userId, context.sid);
    return NextResponse.json({ ok: true, removed });
  } catch (error) {
    console.error('Error closing sessions:', error);
    return NextResponse.json({ error: 'No se pudieron cerrar las otras sesiones.' }, { status: 500 });
  }
}

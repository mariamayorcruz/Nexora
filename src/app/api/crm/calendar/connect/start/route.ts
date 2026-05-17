import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { calendarOAuthRedirectUri } from '@/lib/app-base-url';

export const dynamic = 'force-dynamic';

function getOAuthStateSecret() {
  return process.env.OAUTH_STATE_SECRET || '';
}

function encodeState(payload: Record<string, string>) {
  const secret = getOAuthStateSecret();
  if (!secret) {
    throw new Error('Missing OAUTH_STATE_SECRET');
  }

  const payloadJson = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(payloadJson).digest('hex');

  return Buffer.from(
    JSON.stringify({
      payload,
      signature,
    }),
    'utf-8'
  ).toString('base64url');
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId =
      process.env.GOOGLE_CALENDAR_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_ADS_CLIENT_ID ||
      '';

    if (!clientId.trim()) {
      const redirectUri = calendarOAuthRedirectUri(request);
      return NextResponse.json(
        {
          error: `Falta GOOGLE_CALENDAR_CLIENT_ID (o GOOGLE_CLIENT_ID / GOOGLE_ADS_CLIENT_ID) en el servidor. En Google Cloud Console → OAuth → URI de redirección autorizada, añade exactamente: ${redirectUri} (si usas www y sin www, registra ambas variantes).`,
          setup: {
            requiredEnv: ['GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CLIENT_ID'],
            redirectUri,
            hint: 'Opcional: define APP_BASE_URL=https://www.tudominio.com en Vercel si el redirect no coincide con el host real.',
          },
        },
        { status: 412 }
      );
    }

    if (!getOAuthStateSecret()) {
      return NextResponse.json(
        { error: 'Falta OAUTH_STATE_SECRET en el servidor.' },
        { status: 500 }
      );
    }

    const redirectUri = calendarOAuthRedirectUri(request);
    const state = encodeState({
      userId,
      nonce: randomUUID(),
      ts: String(Date.now()),
    });

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly openid email profile');
    url.searchParams.set('state', state);

    return NextResponse.json({ url: url.toString() });
  } catch (error) {
    console.error('Calendar connect start error:', error);
    return NextResponse.json({ error: 'No se pudo iniciar la conexión de calendario.' }, { status: 500 });
  }
}

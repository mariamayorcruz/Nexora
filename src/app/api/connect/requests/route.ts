import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateEmail } from '@/lib/auth';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';
const ALLOWED_PLATFORMS = new Set(['instagram', 'facebook', 'google', 'tiktok']);
const ALLOWED_SETUP_PREFERENCES = new Set(['oauth', 'manual']);

function getUserIdFromRequest(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return null;
  }

  const decoded = verifyUserToken(token);
  return decoded?.userId || null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await prisma.connectionRequest.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Error fetching connection requests:', error);
    return NextResponse.json({ error: 'Error fetching connection requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const platform = String(body.platform || '').trim().toLowerCase();

    if (!ALLOWED_PLATFORMS.has(platform)) {
      return NextResponse.json({ error: 'La plataforma no es válida.' }, { status: 400 });
    }

    const setupPreference = String(body.setupPreference || '').trim().toLowerCase();
    if (!ALLOWED_SETUP_PREFERENCES.has(setupPreference)) {
      return NextResponse.json({ error: 'El modo de conexión no es válido.' }, { status: 400 });
    }

    const contactEmail = body.contactEmail?.trim() || null;
    if (contactEmail && !validateEmail(contactEmail)) {
      return NextResponse.json({ error: 'El email de contacto no es válido.' }, { status: 400 });
    }

    const connectionRequest = await prisma.connectionRequest.create({
      data: {
        userId,
        platform,
        businessName: body.businessName?.trim() || null,
        contactEmail,
        adAccountLabel: body.adAccountLabel?.trim() || null,
        websiteUrl: body.websiteUrl?.trim() || null,
        notes: body.notes?.trim() || null,
        setupPreference,
        status: 'pending',
      },
    });

    return NextResponse.json({ request: connectionRequest });
  } catch (error) {
    console.error('Error creating connection request:', error);
    return NextResponse.json({ error: 'Error creating connection request' }, { status: 500 });
  }
}

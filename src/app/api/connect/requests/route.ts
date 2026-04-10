import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function getUserIdFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as { userId: string };
  return decoded.userId;
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

    if (!platform) {
      return NextResponse.json({ error: 'La plataforma es obligatoria.' }, { status: 400 });
    }

    const connectionRequest = await prisma.connectionRequest.create({
      data: {
        userId,
        platform,
        businessName: body.businessName?.trim() || null,
        contactEmail: body.contactEmail?.trim() || null,
        adAccountLabel: body.adAccountLabel?.trim() || null,
        websiteUrl: body.websiteUrl?.trim() || null,
        notes: body.notes?.trim() || null,
        setupPreference: body.setupPreference === 'manual' ? 'manual' : 'oauth',
        status: 'pending',
      },
    });

    return NextResponse.json({ request: connectionRequest });
  } catch (error) {
    console.error('Error creating connection request:', error);
    return NextResponse.json({ error: 'Error creating connection request' }, { status: 500 });
  }
}

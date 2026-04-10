import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const source = String(body.source || 'masterclass').trim() || 'masterclass';
    const resource = String(body.resource || 'nexora-decision-map').trim() || 'nexora-decision-map';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Necesitamos un email válido para entregarte el recurso.' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const leadCapture = await prisma.leadCapture.create({
      data: {
        email,
        name: name || null,
        source,
        resource,
        userId: existingUser?.id || null,
      },
    });

    return NextResponse.json({
      success: true,
      leadCaptureId: leadCapture.id,
      resource,
      redirectUrl: `/masterclass/gracias?resource=${resource}`,
    });
  } catch (error) {
    console.error('Lead magnet claim error:', error);
    return NextResponse.json({ error: 'No pudimos registrar tu acceso en este momento.' }, { status: 500 });
  }
}

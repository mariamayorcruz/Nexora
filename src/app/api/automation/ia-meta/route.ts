import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runRealtimeIaAutomation } from '@/lib/automation/ia-meta-automation';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

// Endpoint para activar/desactivar y configurar automatización IA en tiempo real
export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = verifyUserToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { enabled, maxMonthlyBudget } = body;
    if (typeof enabled !== 'boolean' || typeof maxMonthlyBudget !== 'number') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        iaAutomationEnabled: enabled,
        iaAutomationMaxBudget: maxMonthlyBudget,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error configurando automatización' }, { status: 500 });
  }
}

// Endpoint para ejecución manual (debug/testing)
export async function PUT(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = verifyUserToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await runRealtimeIaAutomation(decoded.userId);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: 'Error ejecutando automatización' }, { status: 500 });
  }
}

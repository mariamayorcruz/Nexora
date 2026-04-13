import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import type { BudgetAllocation } from '@/lib/ai/budgetOptimizer';

export const dynamic = 'force-dynamic';

function mapPlatformToAccounts(platform: BudgetAllocation['platform']) {
  if (platform === 'meta') return ['facebook', 'instagram'];
  if (platform === 'google') return ['google'];
  if (platform === 'tiktok') return ['tiktok'];
  if (platform === 'linkedin') return ['linkedin'];
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      profileDescription?: string;
      allocations?: BudgetAllocation[];
    };

    if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
      return NextResponse.json({ error: 'No hay asignaciones para lanzar.' }, { status: 400 });
    }

    const adAccounts = await prisma.adAccount.findMany({
      where: { userId, connected: true },
      orderBy: { createdAt: 'asc' },
    });

    if (adAccounts.length === 0) {
      return NextResponse.json(
        { error: 'Necesitas conectar al menos una cuenta antes de lanzar Smart Campaign.' },
        { status: 412 }
      );
    }

    const created = [] as Array<{ id: string; name: string; platform: string; budget: number }>;

    for (const alloc of body.allocations.slice(0, 4)) {
      const account = adAccounts.find((item) => mapPlatformToAccounts(alloc.platform).includes(item.platform));
      if (!account) {
        continue;
      }

      const campaign = await prisma.campaign.create({
        data: {
          userId,
          adAccountId: account.id,
          name: `Smart ${alloc.platform.toUpperCase()} ${new Date().toLocaleDateString('es-ES')}`,
          description: `Smart Dispatcher · ${body.profileDescription || 'sin descripcion'} · Goal: ${alloc.optimizationGoal}`,
          budget: alloc.dailyBudget,
          startDate: new Date(),
          status: 'draft',
          targeting: {
            source: 'smart-dispatcher',
            platform: alloc.platform,
            bidStrategy: alloc.bidStrategy,
            optimizationGoal: alloc.optimizationGoal,
          },
        },
      });

      created.push({
        id: campaign.id,
        name: campaign.name,
        platform: alloc.platform,
        budget: alloc.dailyBudget,
      });
    }

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    console.error('Smart launch error:', error);
    return NextResponse.json({ error: 'No se pudo lanzar la Smart Campaign.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { isInternalOrTestEmail } from '@/lib/access';
import { prisma, withPrismaRetry } from '@/lib/prisma';
import { validateEmail } from '@/lib/auth';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const campaignSelect = {
  id: true,
  name: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rawLeads = await withPrismaRetry(() =>
      prisma.crmLead.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          campaign: { select: campaignSelect },
        },
      })
    );
    const leads = rawLeads.filter((lead) => !isInternalOrTestEmail(lead.email));

    return NextResponse.json({
      leads: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        createdAt: lead.createdAt,
        campaign: lead.campaign,
      })),
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los leads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
    }
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'El correo es obligatorio' }, { status: 400 });
    }
    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Correo no válido' }, { status: 400 });
    }
    if (isInternalOrTestEmail(email)) {
      return NextResponse.json(
        { error: 'Los correos internos o de prueba no se guardan en la lista comercial.' },
        { status: 400 }
      );
    }

    const rawCampaign = body.campaignId;
    let resolvedCampaignId: string | null = null;
    if (rawCampaign != null && String(rawCampaign).trim() !== '') {
      const campaignId = String(rawCampaign).trim();
      const owned = await withPrismaRetry(() =>
        prisma.campaign.findFirst({
          where: { id: campaignId, userId },
          select: { id: true },
        })
      );
      if (!owned) {
        return NextResponse.json({ error: 'Campaña no válida o no pertenece a tu cuenta' }, { status: 400 });
      }
      resolvedCampaignId = owned.id;
    }

    const lead = await withPrismaRetry(() =>
      prisma.crmLead.create({
        data: {
          userId,
          name,
          email,
          source: 'manual',
          ...(resolvedCampaignId ? { campaignId: resolvedCampaignId } : {}),
        },
        include: {
          campaign: { select: campaignSelect },
        },
      })
    );

    return NextResponse.json({
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        createdAt: lead.createdAt,
        campaign: lead.campaign,
      },
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: 'No se pudo crear el lead' }, { status: 500 });
  }
}

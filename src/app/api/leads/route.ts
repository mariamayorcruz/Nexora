import { NextRequest, NextResponse } from 'next/server';
import { isInternalOrTestEmail } from '@/lib/access';
import { prisma, withPrismaRetry } from '@/lib/prisma';
import { validateEmail } from '@/lib/auth';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import {
  crmReadErrorResponse,
  NEXORA_ORGANIZATION_HEADER,
  resolveCrmReadOrganization,
} from '@/lib/tenancy/resolve-crm-read-organization';
import {
  legacyCrmWriteClientMessage,
  legacyCrmWriteHttpStatus,
  resolveLegacyCrmWriteOrganization,
} from '@/lib/tenancy/resolve-legacy-crm-write-organization';

export const dynamic = 'force-dynamic';

const campaignSelect = {
  id: true,
  name: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get('authorization');
    const readOrg = await resolveCrmReadOrganization({
      authorizationHeader,
      organizationIdHeader: request.headers.get(NEXORA_ORGANIZATION_HEADER),
    });
    if (!readOrg.ok) {
      return crmReadErrorResponse(readOrg);
    }

    // Point 8B-4: organizationId authorization boundary (explicit select keeps public shape).
    const rawLeads = await withPrismaRetry(() =>
      prisma.crmLead.findMany({
        where: { organizationId: readOrg.context.organizationId },
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
    const authorizationHeader = request.headers.get('authorization');
    const userId = getUserIdFromAuthorizationHeader(authorizationHeader);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const writeOrg = await resolveLegacyCrmWriteOrganization({
      userId,
      authorizationHeader,
      organizationIdHeader: request.headers.get(NEXORA_ORGANIZATION_HEADER),
    });
    if (!writeOrg.ok) {
      return NextResponse.json(
        { error: legacyCrmWriteClientMessage(writeOrg.code), code: writeOrg.code },
        { status: legacyCrmWriteHttpStatus(writeOrg.code) }
      );
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

    // Never trust body.organizationId — ownership is server-assigned only.
    const lead = await withPrismaRetry(() =>
      prisma.crmLead.create({
        data: {
          userId,
          organizationId: writeOrg.organizationId,
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

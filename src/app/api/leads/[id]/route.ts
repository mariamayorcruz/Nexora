import { NextRequest, NextResponse } from 'next/server';
import { prisma, withPrismaRetry } from '@/lib/prisma';
import {
  crmReadErrorResponse,
  NEXORA_ORGANIZATION_HEADER,
  resolveCrmReadOrganization,
} from '@/lib/tenancy/resolve-crm-read-organization';
import {
  crmWriteErrorResponse,
  resolveCrmWriteOrganization,
} from '@/lib/tenancy/resolve-crm-write-organization';

export const dynamic = 'force-dynamic';

const campaignSelect = {
  id: true,
  name: true,
} as const;

const ALLOWED_STATUS = new Set(['nuevo', 'contactado', 'cerrado']);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authorizationHeader = request.headers.get('authorization');
    const readOrg = await resolveCrmReadOrganization({
      authorizationHeader,
      organizationIdHeader: request.headers.get(NEXORA_ORGANIZATION_HEADER),
    });
    if (!readOrg.ok) {
      return crmReadErrorResponse(readOrg);
    }

    const { id } = params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const lead = await withPrismaRetry(() =>
      prisma.crmLead.findFirst({
        where: { id: leadId, organizationId: readOrg.context.organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          notes: true,
          createdAt: true,
          campaign: { select: campaignSelect },
        },
      })
    );

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        status: lead.status,
        notes: lead.notes,
        createdAt: lead.createdAt,
        campaign: lead.campaign,
      },
    });
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ error: 'No se pudo cargar el lead' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authorizationHeader = request.headers.get('authorization');
    const writeOrg = await resolveCrmWriteOrganization({
      authorizationHeader,
      organizationIdHeader: request.headers.get(NEXORA_ORGANIZATION_HEADER),
    });
    if (!writeOrg.ok) {
      return crmWriteErrorResponse(writeOrg);
    }

    const { id } = params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
    }

    const updateData: { status?: string; notes?: string | null } = {};

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = String(body.status ?? '').trim().toLowerCase();
      if (!ALLOWED_STATUS.has(status)) {
        return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
      }
      updateData.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
      const raw = body.notes;
      if (raw === null) {
        updateData.notes = null;
      } else {
        const trimmed = String(raw).trim();
        updateData.notes = trimmed === '' ? null : trimmed;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    // Point 8B-5B: updateMany WHERE is id + organizationId (no creator userId filter).
    const updated = await withPrismaRetry(() =>
      prisma.crmLead.updateMany({
        where: { id: leadId, organizationId: writeOrg.context.organizationId },
        data: updateData,
      })
    );

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    const lead = await withPrismaRetry(() =>
      prisma.crmLead.findFirst({
        where: { id: leadId, organizationId: writeOrg.context.organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          notes: true,
          createdAt: true,
          campaign: { select: campaignSelect },
        },
      })
    );

    return NextResponse.json({
      lead: lead
        ? {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            status: lead.status,
            notes: lead.notes,
            createdAt: lead.createdAt,
            campaign: lead.campaign,
          }
        : null,
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el lead' }, { status: 500 });
  }
}

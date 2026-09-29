import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  NEXORA_ORGANIZATION_HEADER,
  resolveTenantContext,
  tenantContextHttpStatus,
} from '@/lib/tenancy/tenant-context';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tenant/context
 * Returns trusted current tenant context for the authenticated User.
 * Does not migrate business APIs; informational foundation only.
 */
export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveTenantContext({
      authorizationHeader: request.headers.get('authorization'),
      organizationIdHeader: request.headers.get(NEXORA_ORGANIZATION_HEADER),
    });

    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.message, code: resolved.code },
        { status: tenantContextHttpStatus(resolved.code) }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: resolved.context.organizationId },
      select: { id: true, name: true, slug: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found', code: 'ORGANIZATION_ACCESS_DENIED' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      membership: {
        role: resolved.context.role,
      },
    });
  } catch (error) {
    console.error('[api/tenant/context] error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Unable to resolve tenant context' }, { status: 500 });
  }
}

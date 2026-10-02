import { NextRequest, NextResponse } from 'next/server';
import { MembershipStatus, OrganizationStatus } from '@prisma/client';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tenant/organizations
 * Point 8B-5C — discover ACTIVE organizations for the authenticated user.
 *
 * Intentionally does NOT call resolveTenantContext (multi-org users must list
 * before selecting). Does NOT call ensureUserOrganization. Read-only.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberships = await prisma.membership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      orderBy: [{ createdAt: 'asc' }, { organizationId: 'asc' }],
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({
      organizations: memberships.map((entry) => ({
        id: entry.organization.id,
        name: entry.organization.name,
        slug: entry.organization.slug,
        role: entry.role,
      })),
    });
  } catch (error) {
    console.error(
      '[api/tenant/organizations] error:',
      error instanceof Error ? error.name : 'unknown'
    );
    return NextResponse.json({ error: 'Unable to list organizations' }, { status: 500 });
  }
}

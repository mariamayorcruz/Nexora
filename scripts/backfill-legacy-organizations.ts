/**
 * Point 7 Slice 0 — deterministic legacy Organization + OWNER Membership backfill.
 *
 * Default: DRY RUN (no writes).
 * Apply:   npx tsx scripts/backfill-legacy-organizations.ts --apply
 *
 * DO NOT run --apply against production without explicit authorization.
 *
 * Transitional note (new Users after historical backfill, before Slice cutover):
 * Registration/auth is intentionally unchanged in Slice 0. Existing APIs remain
 * userId-scoped. A later slice must ensure each User obtains a legacy Organization
 * (same deterministic mapping) before organization-scoped APIs become mandatory —
 * either via registration hook or a repeatable backfill. That lifecycle is NOT
 * implemented in this script beyond idempotent re-runs of this tool.
 */

import { PrismaClient } from '@prisma/client';
import {
  buildLegacyOrganizationId,
  planLegacyOrganizationBackfill,
  type LegacyBackfillPlan,
} from '../src/lib/tenancy/legacy-organization-backfill';

type Summary = {
  usersInspected: number;
  organizationsWouldCreate: number;
  organizationsAlreadyMapped: number;
  membershipsWouldCreate: number;
  membershipsAlreadyPresent: number;
  namingConflicts: number;
  conflicts: number;
  appliedOrganizationsCreated: number;
  appliedMembershipsCreated: number;
};

function parseArgs(argv: string[]) {
  return {
    apply: argv.includes('--apply'),
  };
}

function emptySummary(): Summary {
  return {
    usersInspected: 0,
    organizationsWouldCreate: 0,
    organizationsAlreadyMapped: 0,
    membershipsWouldCreate: 0,
    membershipsAlreadyPresent: 0,
    namingConflicts: 0,
    conflicts: 0,
    appliedOrganizationsCreated: 0,
    appliedMembershipsCreated: 0,
  };
}

function recordPlan(summary: Summary, plan: LegacyBackfillPlan) {
  if (plan.action === 'conflict') {
    summary.conflicts += 1;
    return;
  }

  if (plan.nameConflict) {
    summary.namingConflicts += 1;
  }

  if (plan.action === 'create') {
    summary.organizationsWouldCreate += 1;
    summary.membershipsWouldCreate += 1;
    return;
  }

  summary.organizationsAlreadyMapped += 1;
  if (plan.membershipAction === 'create') {
    summary.membershipsWouldCreate += 1;
  } else {
    summary.membershipsAlreadyPresent += 1;
  }
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const mode = apply ? 'APPLY' : 'DRY_RUN';

  console.log(`[point7-slice0] mode=${mode}`);
  console.log(
    '[point7-slice0] Production execution requires separate explicit authorization after PR review.'
  );

  if (!process.env.DATABASE_URL) {
    console.error('[point7-slice0] DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const summary = emptySummary();
  const conflictDetails: Array<{ userId: string; organizationId: string; reason: string }> = [];
  const plans: LegacyBackfillPlan[] = [];

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        onboardingData: true,
        automationConfig: {
          select: {
            businessName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Phase 1: plan everything with zero writes.
    for (const user of users) {
      summary.usersInspected += 1;
      const organizationId = buildLegacyOrganizationId(user.id);

      const [existingOrganization, existingMembership] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true, slug: true, status: true },
        }),
        prisma.membership.findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId: user.id,
            },
          },
          select: {
            id: true,
            organizationId: true,
            userId: true,
            role: true,
            status: true,
          },
        }),
      ]);

      let plan = planLegacyOrganizationBackfill({
        userId: user.id,
        onboardingData: user.onboardingData,
        automationBusinessName: user.automationConfig?.businessName,
        existingOrganization,
        existingMembership,
      });

      if (plan.action === 'create') {
        const slugTaken = await prisma.organization.findUnique({
          where: { slug: plan.slug },
          select: { id: true },
        });
        if (slugTaken && slugTaken.id !== plan.organizationId) {
          plan = {
            action: 'conflict',
            userId: user.id,
            organizationId: plan.organizationId,
            reason: 'slug_already_owned_by_different_organization',
          };
        }
      }

      plans.push(plan);
      recordPlan(summary, plan);

      if (plan.action === 'conflict') {
        conflictDetails.push({
          userId: plan.userId,
          organizationId: plan.organizationId,
          reason: plan.reason,
        });
        continue;
      }

      if (plan.nameConflict) {
        console.warn('[point7-slice0] naming_conflict', {
          userId: user.id,
          organizationId: plan.organizationId,
          chosenSource: plan.nameSource,
        });
      }
    }

    if (conflictDetails.length > 0) {
      console.error('[point7-slice0] conflicts detected — fail closed. No writes performed.');
      console.error(
        JSON.stringify(
          {
            mode,
            conflicts: conflictDetails,
            summary,
          },
          null,
          2
        )
      );
      process.exitCode = 2;
      return;
    }

    // Phase 2: apply only when explicitly requested and planning succeeded.
    if (apply) {
      for (const plan of plans) {
        if (plan.action === 'conflict') {
          // Unreachable when conflictDetails is empty; keep fail-closed guard.
          throw new Error('Unexpected conflict during apply phase');
        }

        if (plan.action === 'create') {
          await prisma.organization.create({
            data: {
              id: plan.organizationId,
              name: plan.name,
              slug: plan.slug,
              status: 'ACTIVE',
            },
          });
          summary.appliedOrganizationsCreated += 1;
        }

        if (plan.membershipAction === 'create') {
          await prisma.membership.create({
            data: {
              organizationId: plan.organizationId,
              userId: plan.userId,
              role: 'OWNER',
              status: 'ACTIVE',
            },
          });
          summary.appliedMembershipsCreated += 1;
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          mode,
          summary,
          conflicts: conflictDetails,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[point7-slice0] fatal', error instanceof Error ? error.message : 'unknown');
  process.exit(1);
});

/**
 * Point 7 Slice 0 — deterministic legacy Organization + OWNER Membership backfill.
 *
 * Default: DRY RUN (no writes).
 * Apply:   npx tsx scripts/backfill-legacy-organizations.ts --apply
 *
 * DO NOT run --apply against production without explicit authorization.
 *
 * Apply semantics:
 * - planning / batch conflict -> zero writes
 * - transaction failure -> full rollback (no committed partial batch)
 * - successful apply -> all intended creates committed atomically
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
  validateLegacyBackfillBatch,
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
  batchCollisions: number;
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
    batchCollisions: 0,
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
  } else {
    summary.organizationsAlreadyMapped += 1;
  }

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
  console.log(
    '[point7-slice0] Production migrate deploy remains BLOCKED until FR-004 migration baseline integrity is resolved.'
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
      console.error('[point7-slice0] planning_conflict — fail closed. No writes performed.');
      console.error(
        JSON.stringify(
          {
            mode,
            outcome: 'planning_conflict_no_writes',
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

    // Phase 1b: pure in-batch collision preflight (before any transaction).
    const batchCheck = validateLegacyBackfillBatch(plans);
    if (!batchCheck.ok) {
      summary.batchCollisions = batchCheck.collisions.length;
      console.error('[point7-slice0] batch_preflight_conflict — fail closed. No writes performed.');
      console.error(
        JSON.stringify(
          {
            mode,
            outcome: 'batch_preflight_conflict_no_writes',
            collisions: batchCheck.collisions,
            summary,
          },
          null,
          2
        )
      );
      process.exitCode = 2;
      return;
    }

    // Phase 2: atomic apply — all creates in one transaction, or full rollback.
    if (apply) {
      try {
        const applyResult = await prisma.$transaction(async (tx) => {
          let organizationsCreated = 0;
          let membershipsCreated = 0;

          for (const plan of plans) {
            if (plan.action === 'conflict') {
              throw new Error('Unexpected conflict during apply phase');
            }

            if (plan.action === 'create') {
              // No skipDuplicates — unique constraint violations fail the whole transaction.
              await tx.organization.create({
                data: {
                  id: plan.organizationId,
                  name: plan.name,
                  slug: plan.slug,
                  status: 'ACTIVE',
                },
              });
              organizationsCreated += 1;
            }

            if (plan.membershipAction === 'create') {
              await tx.membership.create({
                data: {
                  organizationId: plan.organizationId,
                  userId: plan.userId,
                  role: 'OWNER',
                  status: 'ACTIVE',
                },
              });
              membershipsCreated += 1;
            }
          }

          return { organizationsCreated, membershipsCreated };
        });

        summary.appliedOrganizationsCreated = applyResult.organizationsCreated;
        summary.appliedMembershipsCreated = applyResult.membershipsCreated;

        console.log(
          JSON.stringify(
            {
              mode,
              outcome: 'apply_committed',
              summary,
              conflicts: conflictDetails,
            },
            null,
            2
          )
        );
        return;
      } catch (error) {
        console.error('[point7-slice0] transaction_failure — rollback. No committed partial batch.');
        console.error(
          JSON.stringify(
            {
              mode,
              outcome: 'transaction_rollback_no_partial_writes',
              error: error instanceof Error ? error.message : 'unknown',
              summary: {
                ...summary,
                appliedOrganizationsCreated: 0,
                appliedMembershipsCreated: 0,
              },
            },
            null,
            2
          )
        );
        process.exitCode = 3;
        return;
      }
    }

    console.log(
      JSON.stringify(
        {
          mode,
          outcome: 'dry_run_no_writes',
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

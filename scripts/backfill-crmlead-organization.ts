/**
 * Point 8B-3 — historical CrmLead.organizationId backfill (NULL rows only).
 *
 * Default: DRY RUN (no writes).
 * Apply:   npx tsx scripts/backfill-crmlead-organization.ts --apply
 *
 * Apply is restricted to disposable local databases in this authorization window.
 * Production --apply is NOT authorized.
 *
 * Semantics:
 * - plans every NULL lead against deterministic legacy Organization(userId)
 * - FAIL CLOSED on any blocker (no Organization/Membership repair)
 * - never modifies non-null organizationId
 * - --apply re-runs preflight, then one transaction; abort on gate FAIL
 */

import { PrismaClient } from '@prisma/client';
import { buildLegacyOrganizationId } from '../src/lib/tenancy/legacy-organization-backfill';
import {
  emptyCrmLeadOrgBackfillSummary,
  evaluateCrmLeadOrgBackfillGate,
  evaluatePoint8b6ReadinessFromCounts,
  planNullCrmLeadOrganizationBackfill,
  recordNullPlan,
  toBackfillReportCounters,
  type CrmLeadOrgBackfillPlan,
  type CrmLeadOrgBackfillSummary,
} from '../src/lib/tenancy/crmlead-organization-backfill';

function assertDisposableUrl(url: string) {
  const host = new URL(url.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'))
    .hostname.toLowerCase();
  const blocked = ['supabase.co', 'neon.tech', 'railway.app', 'amazonaws.com'];
  if (blocked.some((b) => host.includes(b)) || host.includes('prod')) {
    throw new Error('Refusing non-disposable database host');
  }
  if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(host) && !host.endsWith('.local')) {
    throw new Error(`Host ${host} is not an allowed disposable target`);
  }
}

function parseArgs(argv: string[]) {
  return { apply: argv.includes('--apply') };
}

async function collectIntegrityOnAssigned(prisma: PrismaClient, summary: CrmLeadOrgBackfillSummary) {
  const orphanRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "CrmLead" c
    LEFT JOIN "Organization" o ON o.id = c."organizationId"
    WHERE c."organizationId" IS NOT NULL
      AND o.id IS NULL
  `;
  summary.alreadyAssignedOrphanOrganization = Number(orphanRows[0]?.count || 0);

  const legacyInconsistent = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "CrmLead" c
    WHERE c."organizationId" IS NOT NULL
      AND c."organizationId" LIKE 'legacy_org_%'
      AND c."organizationId" <> ('legacy_org_' || c."userId")
  `;
  summary.alreadyAssignedLegacyInconsistent = Number(legacyInconsistent[0]?.count || 0);

  const missingMembership = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "CrmLead" c
    WHERE c."organizationId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "Membership" m
        WHERE m."organizationId" = c."organizationId"
          AND m."userId" = c."userId"
          AND m.status = 'ACTIVE'
      )
  `;
  summary.alreadyAssignedMissingActiveMembership = Number(missingMembership[0]?.count || 0);
}

async function countNullOrganizationId(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "CrmLead" WHERE "organizationId" IS NULL
  `;
  return Number(rows[0]?.count || 0);
}

async function collectPoint8b6Counts(prisma: PrismaClient) {
  const nullOrganizationId = await countNullOrganizationId(prisma);
  const orphanRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "CrmLead" c
    LEFT JOIN "Organization" o ON o.id = c."organizationId"
    WHERE c."organizationId" IS NOT NULL AND o.id IS NULL
  `;
  const legacyInconsistent = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "CrmLead" c
    WHERE c."organizationId" IS NOT NULL
      AND c."organizationId" LIKE 'legacy_org_%'
      AND c."organizationId" <> ('legacy_org_' || c."userId")
  `;
  const missingMembership = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "CrmLead" c
    WHERE c."organizationId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Membership" m
        WHERE m."organizationId" = c."organizationId"
          AND m."userId" = c."userId"
          AND m.status = 'ACTIVE'
      )
  `;
  return {
    nullOrganizationId,
    orphanOrganizationId: Number(orphanRows[0]?.count || 0),
    legacyMappingInconsistent: Number(legacyInconsistent[0]?.count || 0),
    missingActiveMembership: Number(missingMembership[0]?.count || 0),
  };
}

async function planAll(
  prisma: PrismaClient
): Promise<{ summary: CrmLeadOrgBackfillSummary; plans: CrmLeadOrgBackfillPlan[] }> {
  const summary = emptyCrmLeadOrgBackfillSummary();
  const plans: CrmLeadOrgBackfillPlan[] = [];

  summary.totalCrmLeads = await prisma.crmLead.count();
  summary.nullOrganizationId = await countNullOrganizationId(prisma);
  summary.alreadyAssigned = summary.totalCrmLeads - summary.nullOrganizationId;

  await collectIntegrityOnAssigned(prisma, summary);

  // Raw query: Prisma client rejects organizationId:null filters after schema NOT NULL.
  const nullLeads = await prisma.$queryRaw<
    Array<{ id: string; userId: string; organizationId: string | null }>
  >`
    SELECT id, "userId" AS "userId", "organizationId" AS "organizationId"
    FROM "CrmLead"
    WHERE "organizationId" IS NULL
    ORDER BY "createdAt" ASC
  `;

  for (const lead of nullLeads) {
    const expectedOrganizationId = buildLegacyOrganizationId(lead.userId);
    const [user, organization, membership] = await Promise.all([
      prisma.user.findUnique({ where: { id: lead.userId }, select: { id: true } }),
      prisma.organization.findUnique({
        where: { id: expectedOrganizationId },
        select: { id: true, status: true },
      }),
      prisma.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: expectedOrganizationId,
            userId: lead.userId,
          },
        },
        select: {
          organizationId: true,
          userId: true,
          role: true,
          status: true,
        },
      }),
    ]);

    const plan = planNullCrmLeadOrganizationBackfill({
      lead,
      userExists: Boolean(user),
      organization,
      membership,
    });
    plans.push(plan);
    recordNullPlan(summary, plan);
  }

  // alreadyAssigned counted above from totals; null planner must not increment skip_already_assigned
  return { summary, plans };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const mode = apply ? 'APPLY' : 'DRY_RUN';
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('[point8b3] DATABASE_URL / FR004_DATABASE_URL is required');
    process.exit(1);
  }
  assertDisposableUrl(url);

  console.log(`[point8b3] mode=${mode}`);
  console.log(`[point8b3] target=${url.replace(/:\/\/[^@]+@/, '://***@')}`);
  console.log('[point8b3] Production --apply is NOT authorized in this window.');

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const { summary, plans } = await planAll(prisma);
    const gate = evaluateCrmLeadOrgBackfillGate(summary);
    const wouldUpdateIds = plans
      .filter((p): p is Extract<CrmLeadOrgBackfillPlan, { action: 'would_update' }> => p.action === 'would_update')
      .map((p) => ({ leadId: p.leadId, userId: p.userId, organizationId: p.organizationId }));

    const blocked = plans.filter((p) => p.action === 'blocked');

    console.log(
      JSON.stringify(
        {
          mode,
          summary: toBackfillReportCounters(summary),
          gate: {
            pass: gate.pass,
            status: gate.pass ? 'PASS' : 'FAIL',
            failures: gate.failures,
          },
          blockedSample: blocked.slice(0, 20),
          wouldUpdateSample: wouldUpdateIds.slice(0, 20),
        },
        null,
        2
      )
    );

    if (!gate.pass) {
      console.error('[point8b3] FAIL gate — no writes performed');
      process.exitCode = 1;
      return;
    }

    console.log('[point8b3] preflight gate PASS');

    if (!apply) {
      console.log('[point8b3] DRY_RUN complete — re-run with --apply on disposable DB to write');
      return;
    }

    // Re-plan immediately before writes (TOCTOU fail-closed).
    const replay = await planAll(prisma);
    const replayGate = evaluateCrmLeadOrgBackfillGate(replay.summary);
    if (!replayGate.pass) {
      console.error('[point8b3] FAIL re-preflight before apply — aborting', replayGate.failures);
      process.exitCode = 1;
      return;
    }

    const updates = replay.plans.filter(
      (p): p is Extract<CrmLeadOrgBackfillPlan, { action: 'would_update' }> => p.action === 'would_update'
    );

    const applied = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const row of updates) {
        // Raw update: Prisma rejects organizationId:null filters after schema NOT NULL.
        const result = await tx.$executeRawUnsafe(
          `UPDATE "CrmLead"
           SET "organizationId" = $1, "updatedAt" = NOW()
           WHERE id = $2
             AND "userId" = $3
             AND "organizationId" IS NULL`,
          row.organizationId,
          row.leadId,
          row.userId
        );
        const matched = typeof result === 'number' ? result : 0;
        if (matched !== 1) {
          throw new Error(
            `Expected exactly 1 update for lead ${row.leadId}; matched=${matched}`
          );
        }
        count += 1;
      }
      return count;
    });

    summary.appliedUpdates = applied;

    const post = await collectPoint8b6Counts(prisma);
    const postGate = evaluatePoint8b6ReadinessFromCounts(post);

    console.log(
      JSON.stringify(
        {
          mode,
          appliedUpdates: applied,
          postWriteCounts: post,
          point8b6ReadinessGate: postGate,
        },
        null,
        2
      )
    );

    if (!postGate.pass) {
      console.error('[point8b3] FAIL post-write 8B-6 readiness gate', postGate.failures);
      process.exitCode = 1;
      return;
    }

    console.log('[point8b3] APPLY PASS — null backfill committed; 8B-6 readiness gates satisfied');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[point8b3] FAIL', err);
  process.exit(1);
});

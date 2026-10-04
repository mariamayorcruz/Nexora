/**
 * Point 8B-6 — CrmLead.organizationId NOT NULL preflight (SELECT-only).
 *
 * Default: disposable local Postgres only (assertDisposableUrl).
 * Optional hosted read-only:
 *   POINT8B6_PREFLIGHT_ALLOW_HOSTED_READONLY=1
 *   (still SELECT-only; never mutates)
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:preflight-point8b6
 *
 * Exit codes:
 *   0 = gates PASS (safe to consider NOT NULL apply after human auth)
 *   1 = gates FAIL or configuration error
 */

import { PrismaClient } from '@prisma/client';
import { buildLegacyOrganizationId } from '../src/lib/tenancy/legacy-organization-backfill';

type PreflightCounts = {
  totalCrmLeads: number;
  nullOrganizationId: number;
  orphanOrganizationId: number;
  legacyMappingInconsistent: number;
  missingActiveMembership: number;
  organizationInactive: number;
  withValidDeterministicOwnership: number;
};

function assertUrlPolicy(url: string) {
  const host = new URL(url.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'))
    .hostname.toLowerCase();
  const allowHosted = process.env.POINT8B6_PREFLIGHT_ALLOW_HOSTED_READONLY === '1';
  const blockedTokens = ['prod'];
  if (blockedTokens.some((t) => host.includes(t)) && !allowHosted) {
    throw new Error('Refusing host that looks like production without POINT8B6_PREFLIGHT_ALLOW_HOSTED_READONLY=1');
  }
  if (!allowHosted) {
    const blocked = ['supabase.co', 'neon.tech', 'railway.app', 'amazonaws.com'];
    if (blocked.some((b) => host.includes(b))) {
      throw new Error('Refusing hosted database host (set POINT8B6_PREFLIGHT_ALLOW_HOSTED_READONLY=1 for SELECT-only)');
    }
    if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(host) && !host.endsWith('.local')) {
      throw new Error(`Host ${host} is not an allowed disposable target`);
    }
  }
}

export async function collectPoint8b6PreflightCounts(prisma: PrismaClient): Promise<PreflightCounts> {
  const totalCrmLeads = await prisma.crmLead.count();
  const nullOrganizationId = await prisma.crmLead.count({ where: { organizationId: null } });

  const orphanRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "CrmLead" c
    LEFT JOIN "Organization" o ON o.id = c."organizationId"
    WHERE c."organizationId" IS NOT NULL
      AND o.id IS NULL
  `;
  const orphanOrganizationId = Number(orphanRows[0]?.count || 0);

  const legacyInconsistentRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "CrmLead" c
    WHERE c."organizationId" IS NOT NULL
      AND c."organizationId" LIKE 'legacy_org_%'
      AND c."organizationId" <> ('legacy_org_' || c."userId")
  `;
  const legacyMappingInconsistent = Number(legacyInconsistentRows[0]?.count || 0);

  const missingMembershipRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
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
  const missingActiveMembership = Number(missingMembershipRows[0]?.count || 0);

  const inactiveOrgRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "CrmLead" c
    INNER JOIN "Organization" o ON o.id = c."organizationId"
    WHERE o.status <> 'ACTIVE'
  `;
  const organizationInactive = Number(inactiveOrgRows[0]?.count || 0);

  const withValidDeterministicOwnership =
    totalCrmLeads -
    nullOrganizationId -
    orphanOrganizationId -
    legacyMappingInconsistent -
    missingActiveMembership;

  return {
    totalCrmLeads,
    nullOrganizationId,
    orphanOrganizationId,
    legacyMappingInconsistent,
    missingActiveMembership,
    organizationInactive,
    withValidDeterministicOwnership: Math.max(0, withValidDeterministicOwnership),
  };
}

export function evaluatePoint8b6PreflightGates(counts: PreflightCounts): {
  pass: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  if (counts.nullOrganizationId !== 0) {
    failures.push(
      `nullOrganizationId=${counts.nullOrganizationId} (zero-null gate failed; 8B-3 dependency not satisfied for this DB)`
    );
  }
  if (counts.orphanOrganizationId !== 0) {
    failures.push(`orphanOrganizationId=${counts.orphanOrganizationId}`);
  }
  if (counts.legacyMappingInconsistent !== 0) {
    failures.push(`legacyMappingInconsistent=${counts.legacyMappingInconsistent}`);
  }
  if (counts.missingActiveMembership !== 0) {
    failures.push(`missingActiveMembership=${counts.missingActiveMembership}`);
  }
  return { pass: failures.length === 0, failures };
}

/**
 * Disposable-only helper used by the 8B-6 validator to simulate Point 8B-3
 * (deterministic legacy org backfill). NOT a production backfill tool.
 */
export async function simulateDisposableLegacyOrgBackfill(prisma: PrismaClient): Promise<number> {
  const nullLeads = await prisma.crmLead.findMany({
    where: { organizationId: null },
    select: { id: true, userId: true },
  });
  let updated = 0;
  for (const lead of nullLeads) {
    const organizationId = buildLegacyOrganizationId(lead.userId);
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new Error(
        `Disposable backfill simulation cannot proceed: missing legacy Organization ${organizationId}`
      );
    }
    await prisma.crmLead.update({
      where: { id: lead.id },
      data: { organizationId },
    });
    updated += 1;
  }
  return updated;
}

async function main() {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL');
  assertUrlPolicy(url);

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    console.log('[point8b6-preflight] target=', url.replace(/:\/\/[^@]+@/, '://***@'));
    console.log(
      '[point8b6-preflight] mode=',
      process.env.POINT8B6_PREFLIGHT_ALLOW_HOSTED_READONLY === '1'
        ? 'hosted-readonly-select'
        : 'disposable-select'
    );

    const counts = await collectPoint8b6PreflightCounts(prisma);
    const gate = evaluatePoint8b6PreflightGates(counts);

    console.log(JSON.stringify({ counts, gate }, null, 2));

    if (!gate.pass) {
      console.error('[point8b6-preflight] FAIL', gate.failures.join('; '));
      process.exitCode = 1;
      return;
    }
    console.log('[point8b6-preflight] PASS — zero null/orphan/inconsistent ownership blockers');
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly = process.argv[1]?.includes('preflight-point8b6-crmlead-org-not-null');
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

/**
 * Point 8B-5C controlled QA fixtures — DISPOSABLE DB ONLY.
 * Never run against hosted/production databases.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://fr004:fr004@127.0.0.1:5432/point8b5c_qa \
 *     npx tsx scripts/qa-point8b5c-controlled-fixtures.ts
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  PrismaClient,
} from '@prisma/client';
import { hashPassword } from '../src/lib/auth';
import { ensureUserOrganization } from '../src/lib/tenancy/ensure-user-organization';
import { buildLegacyOrganizationId } from '../src/lib/tenancy/legacy-organization-backfill';

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

const QA_PASSWORD = 'QaTest2026!';

async function upsertQaUser(
  prisma: PrismaClient,
  params: { email: string; name: string; onboardingCompleted: boolean }
) {
  const password = await hashPassword(QA_PASSWORD);
  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      name: params.name,
      password,
      onboardingCompletedAt: params.onboardingCompleted ? new Date() : null,
      onboardingData: params.onboardingCompleted
        ? {
            businessName: `QA ${params.name}`,
            firstWinReady: true,
            sampleLeadCreatedAt: new Date().toISOString(),
          }
        : null,
      subscription: {
        upsert: {
          update: {
            plan: 'professional',
            status: 'active',
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          },
          create: {
            plan: 'professional',
            status: 'active',
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          },
        },
      },
    },
    create: {
      email: params.email,
      name: params.name,
      password,
      onboardingCompletedAt: params.onboardingCompleted ? new Date() : null,
      onboardingData: params.onboardingCompleted
        ? {
            businessName: `QA ${params.name}`,
            firstWinReady: true,
            sampleLeadCreatedAt: new Date().toISOString(),
          }
        : null,
      subscription: {
        create: {
          plan: 'professional',
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      },
    },
  });
}

async function main() {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL');
  assertDisposableUrl(url);
  console.log('[qa-8b5c] target=', url.replace(/:\/\/[^@]+@/, '://***@'));

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
    await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  } finally {
    await prisma.$disconnect();
  }

  const bin = path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
  execFileSync(bin, ['migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const single = await upsertQaUser(db, {
      email: 'qa-single-org@nexora.test',
      name: 'QA Single Org',
      onboardingCompleted: true,
    });
    await ensureUserOrganization(db, { userId: single.id });
    const singleOrgId = buildLegacyOrganizationId(single.id);
    await db.organization.update({
      where: { id: singleOrgId },
      data: { name: 'QA Org SINGLE' },
    });

    const multi = await upsertQaUser(db, {
      email: 'qa-multi-org@nexora.test',
      name: 'QA Multi Org',
      onboardingCompleted: true,
    });
    await ensureUserOrganization(db, { userId: multi.id });
    const orgA = buildLegacyOrganizationId(multi.id);
    await db.organization.update({
      where: { id: orgA },
      data: { name: 'QA Org ALPHA' },
    });
    const orgB = await db.organization.create({
      data: {
        id: 'org_qa_beta_8b5c',
        name: 'QA Org BETA',
        slug: 'qa-org-beta-8b5c',
        status: OrganizationStatus.ACTIVE,
      },
    });
    await db.membership.create({
      data: {
        organizationId: orgB.id,
        userId: multi.id,
        role: MembershipRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    await db.crmLead.create({
      data: {
        userId: multi.id,
        organizationId: orgA,
        name: 'TEST ALPHA',
        email: 'alpha.lead@nexora.qa',
        source: 'manual',
        stage: 'lead',
      },
    });
    await db.crmLead.create({
      data: {
        userId: multi.id,
        organizationId: orgB.id,
        name: 'TEST BETA',
        email: 'beta.lead@nexora.qa',
        source: 'manual',
        stage: 'lead',
      },
    });

    const zero = await upsertQaUser(db, {
      email: 'qa-zero-org@nexora.test',
      name: 'QA Zero Org',
      onboardingCompleted: true,
    });
    const inactiveOrg = await db.organization.create({
      data: {
        id: 'org_qa_inactive_8b5c',
        name: 'QA Org INACTIVE',
        slug: 'qa-org-inactive-8b5c',
        status: OrganizationStatus.SUSPENDED,
      },
    });
    await db.membership.create({
      data: {
        organizationId: inactiveOrg.id,
        userId: zero.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const foreign = await db.organization.create({
      data: {
        id: 'org_qa_foreign_unowned',
        name: 'QA Org FOREIGN',
        slug: 'qa-org-foreign-unowned',
        status: OrganizationStatus.ACTIVE,
      },
    });

    console.log(
      JSON.stringify(
        {
          password: QA_PASSWORD,
          users: {
            single: { email: single.email, orgId: singleOrgId, orgName: 'QA Org SINGLE' },
            multi: {
              email: multi.email,
              orgA: { id: orgA, name: 'QA Org ALPHA', lead: 'TEST ALPHA' },
              orgB: { id: orgB.id, name: 'QA Org BETA', lead: 'TEST BETA' },
            },
            zero: { email: zero.email, note: 'no ACTIVE usable org' },
          },
          foreignOrgId: foreign.id,
        },
        null,
        2
      )
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Point 8 / 4A-1C-1A — real-schema full content stability validation.
 *
 * Scope:
 * - locks + contentRevision for all real CrmReadPolicy content/evidence tables
 * - bundle identity/revision discipline
 * - candidate-anchor regression
 * - concurrency serialization against a pending VALIDATED transition
 * - least privilege / TRUNCATE boundary
 *
 * Explicitly out of scope:
 * - SealService
 * - HMAC / secret storage
 * - authority
 * - HTTP/runtime activation
 *
 * Requires a disposable local PostgreSQL database.
 */

import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import {
  assertDisposableDatabaseUrl,
  prismaCliVersion,
  psql,
  psqlFile,
  readMigrationRows,
  repoRoot,
  runPrisma,
  sanitizeDbUrlForLog,
} from './fr004-lib';

const MIGRATION_NAME = '20261113110000_crm_read_policy_full_content_stability';

type Result = { id: string; ok: boolean; detail: string };
const results: Result[] = [];

function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${detail}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function expectFail(url: string, sql: string, label: string, re?: RegExp) {
  try {
    psql(url, sql);
    throw new Error(`${label}: expected failure`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('expected failure')) throw e;
    if (re && !re.test(msg)) {
      throw new Error(`${label}: failure did not match ${re}: ${msg.slice(0, 900)}`);
    }
  }
}

function rev(url: string, bundleId: string): bigint {
  return BigInt(
    psql(url, `SELECT "contentRevision"::text FROM "CrmReadPolicyBundle" WHERE "id"=${sqlString(bundleId)};`)
  );
}

function status(url: string, bundleId: string): string {
  return psql(url, `SELECT "status"::text FROM "CrmReadPolicyBundle" WHERE "id"=${sqlString(bundleId)};`);
}

function privilegedValidateBundle(url: string, bundleId: string, checksum = 'fixture-checksum') {
  psql(
    url,
    `BEGIN;
     SET LOCAL session_replication_role = replica;
     UPDATE "CrmReadPolicyBundle"
       SET "status"='VALIDATED', "contentChecksum"=${sqlString(checksum)}
       WHERE "id"=${sqlString(bundleId)};
     COMMIT;`
  );
}

type Seed = {
  t: string;
  orgA: string;
  orgB: string;
  userA: string;
  userB: string;
  memA: string;
  memB: string;
  leadA: string;
  leadB: string;
};

function seedTenants(url: string): Seed {
  const t = new Date().toISOString();
  const orgA = id('org');
  const orgB = id('org');
  const userA = id('user');
  const userB = id('user');
  const memA = id('mem');
  const memB = id('mem');
  const leadA = id('lead');
  const leadB = id('lead');

  psql(
    url,
    `INSERT INTO "User" ("id","email","password","nurtureStatus","createdAt","updatedAt") VALUES
      (${sqlString(userA)},${sqlString(userA + '@example.com')},'x','not-consented',${sqlString(t)},${sqlString(t)}),
      (${sqlString(userB)},${sqlString(userB + '@example.com')},'x','not-consented',${sqlString(t)},${sqlString(t)});
     INSERT INTO "Organization" ("id","name","slug","status","createdAt","updatedAt") VALUES
      (${sqlString(orgA)},'Org A',${sqlString('slug-' + orgA)},'ACTIVE',${sqlString(t)},${sqlString(t)}),
      (${sqlString(orgB)},'Org B',${sqlString('slug-' + orgB)},'ACTIVE',${sqlString(t)},${sqlString(t)});
     INSERT INTO "Membership" ("id","organizationId","userId","role","status","createdAt","updatedAt") VALUES
      (${sqlString(memA)},${sqlString(orgA)},${sqlString(userA)},'OWNER','ACTIVE',${sqlString(t)},${sqlString(t)}),
      (${sqlString(memB)},${sqlString(orgB)},${sqlString(userB)},'OWNER','ACTIVE',${sqlString(t)},${sqlString(t)});
     INSERT INTO "CrmLead" ("id","userId","organizationId","name","source","stage","status","value","confidence","createdAt","updatedAt") VALUES
      (${sqlString(leadA)},${sqlString(userA)},${sqlString(orgA)},'Lead A','manual','lead','nuevo',0,25,${sqlString(t)},${sqlString(t)}),
      (${sqlString(leadB)},${sqlString(userB)},${sqlString(orgB)},'Lead B','manual','lead','nuevo',0,25,${sqlString(t)},${sqlString(t)});`
  );

  return { t, orgA, orgB, userA, userB, memA, memB, leadA, leadB };
}

function insertBundle(
  url: string,
  opts: {
    id: string;
    org: string;
    version: number;
    t: string;
    predecessorVersion?: number;
  }
) {
  const predOrg = opts.predecessorVersion == null ? 'NULL' : sqlString(opts.org);
  const predVer = opts.predecessorVersion == null ? 'NULL' : String(opts.predecessorVersion);
  psql(
    url,
    `INSERT INTO "CrmReadPolicyBundle"
      ("id","organizationId","version","status","canonicalVersion","contentChecksum",
       "predecessorOrganizationId","predecessorVersion","createdAt","updatedAt")
     VALUES
      (${sqlString(opts.id)},${sqlString(opts.org)},${opts.version},'DRAFT',
       'crm-read-policy-canonical/v1',NULL,${predOrg},${predVer},${sqlString(opts.t)},${sqlString(opts.t)});`
  );
}

class PsqlSession {
  private readonly child: ChildProcessWithoutNullStreams;
  private buf = '';
  private waiters: Array<{ marker: string; resolve: (s: string) => void; reject: (e: Error) => void }> = [];

  constructor(databaseUrl: string) {
    this.child = spawn('psql', [databaseUrl, '-Atq'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.onChunk(chunk));
    this.child.stderr.on('data', (chunk: string) => this.onChunk(chunk));
    this.child.on('exit', (code) => {
      for (const w of this.waiters) w.reject(new Error(`psql exited early code=${code}`));
      this.waiters = [];
    });
  }

  private onChunk(chunk: string) {
    this.buf += chunk;
    this.waiters = this.waiters.filter((w) => {
      if (!this.buf.includes(w.marker)) return true;
      const idx = this.buf.indexOf(w.marker);
      const out = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + w.marker.length);
      w.resolve(out);
      return false;
    });
  }

  async exec(sql: string, timeoutMs = 8000): Promise<string> {
    const marker = `__M_${randomUUID().replace(/-/g, '')}__`;
    const p = new Promise<string>((resolve, reject) => {
      this.waiters.push({ marker, resolve, reject });
      this.child.stdin.write(`${sql};\n\\echo ${marker}\n`);
    });
    let timer: NodeJS.Timeout | undefined;
    try {
      const out = await Promise.race([
        p,
        new Promise<string>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`psql timeout after ${timeoutMs}ms: ${sql.slice(0, 120)}`)),
            timeoutMs
          );
        }),
      ]);
      if (/ERROR:/i.test(out)) throw new Error(out.trim());
      return out;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async close() {
    try {
      this.child.stdin.write('\\q\n');
    } catch {
      // ignore
    }
    this.child.kill('SIGTERM');
  }
}

async function main() {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL || '';
  assertDisposableDatabaseUrl(url, 'FR004_DATABASE_URL');
  const env = { ...process.env, DATABASE_URL: url, FR004_DATABASE_URL: url };

  console.log(`[point8-4a1c-1a] prisma=${prismaCliVersion()}`);
  console.log(`[point8-4a1c-1a] target=${sanitizeDbUrlForLog(url)}`);

  runPrisma(['validate'], env);
  runPrisma(['migrate', 'deploy'], env);

  const migrations = readMigrationRows(url);
  assert(
    migrations.some((m) => m.migration_name === MIGRATION_NAME && m.finished_at && !m.rolled_back_at),
    `${MIGRATION_NAME} must be applied`
  );

  const s = seedTenants(url);
  const b1 = id('bundle');
  const b2 = id('bundle');
  const b3 = id('bundle');
  insertBundle(url, { id: b1, org: s.orgA, version: 1, t: s.t });
  insertBundle(url, { id: b2, org: s.orgA, version: 2, predecessorVersion: 1, t: s.t });
  insertBundle(url, { id: b3, org: s.orgA, version: 3, predecessorVersion: 2, t: s.t });

  // B1: new bundles start at revision zero and identity is immutable.
  try {
    assert(rev(url, b1) === 0n && rev(url, b2) === 0n, 'new bundle revision must start at 0');
    expectFail(
      url,
      `UPDATE "CrmReadPolicyBundle" SET "version"=99 WHERE "id"=${sqlString(b1)};`,
      'bundle version mutation',
      /identity.*immutable/i
    );
    expectFail(
      url,
      `UPDATE "CrmReadPolicyBundle" SET "organizationId"=${sqlString(s.orgB)} WHERE "id"=${sqlString(b1)};`,
      'bundle organization mutation',
      /identity.*immutable/i
    );
    record('B1', true, 'bundle identity frozen; new revisions start at 0');
  } catch (e) {
    record('B1', false, String(e));
  }

  // B2: canonical/predecessor changes bump exactly one; revision rollback/jump rejected.
  try {
    const before = rev(url, b1);
    psql(
      url,
      `UPDATE "CrmReadPolicyBundle"
       SET "canonicalVersion"='crm-read-policy-canonical/v1-test'
       WHERE "id"=${sqlString(b1)};`
    );
    assert(rev(url, b1) === before + 1n, 'canonicalVersion must bump exactly one');
    const afterCanonical = rev(url, b1);

    expectFail(
      url,
      `UPDATE "CrmReadPolicyBundle"
       SET "contentRevision"="contentRevision"+5
       WHERE "id"=${sqlString(b1)};`,
      'revision jump',
      /advance exactly one/i
    );
    assert(rev(url, b1) === afterCanonical, 'failed jump must not persist');

    psql(
      url,
      `UPDATE "CrmReadPolicyBundle"
       SET "contentRevision"="contentRevision"+1
       WHERE "id"=${sqlString(b1)};`
    );
    assert(rev(url, b1) === afterCanonical + 1n, 'single revision bump should be allowed');
    record('B2', true, 'canonical change bumps; revision rollback/jump rejected');
  } catch (e) {
    record('B2', false, String(e));
  }

  // C1: INSERT coverage for every real child/evidence category.
  try {
    let expected = rev(url, b2);

    const memLink = s.memA;
    psql(
      url,
      `INSERT INTO "CrmReadPolicyBundleMembershipLink"
       ("organizationId","bundleId","membershipId")
       VALUES (${sqlString(s.orgA)},${sqlString(b2)},${sqlString(memLink)});`
    );
    expected += 1n;
    assert(rev(url, b2) === expected, 'MembershipLink insert bump');

    psql(
      url,
      `INSERT INTO "CrmReadPolicyBundleLeadLink"
       ("organizationId","bundleId","leadId")
       VALUES (${sqlString(s.orgA)},${sqlString(b2)},${sqlString(s.leadA)});`
    );
    expected += 1n;
    assert(rev(url, b2) === expected, 'LeadLink insert bump');

    const retired = id('retired');
    psql(
      url,
      `INSERT INTO "CrmReadPolicyRetiredGrantLogicalId"
       ("organizationId","bundleId","logicalId")
       VALUES (${sqlString(s.orgA)},${sqlString(b2)},${sqlString(retired)});`
    );
    expected += 1n;
    assert(rev(url, b2) === expected, 'Retired insert bump');

    const grantVersion = id('gv');
    const grantLogical = id('g');
    psql(
      url,
      `INSERT INTO "CrmReadPolicyGrant"
       ("organizationId","bundleId","versionId","logicalId","membershipId",
        "scopeKind","originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
       VALUES
       (${sqlString(s.orgA)},${sqlString(b2)},${sqlString(grantVersion)},${sqlString(grantLogical)},
        ${sqlString(s.memA)},'COMPANY','LEGACY_SNAPSHOT',${sqlString(s.orgA)},true,
        ${sqlString(s.t)},${sqlString(s.t)});`
    );
    expected += 1n;
    assert(rev(url, b2) === expected, 'Grant insert bump');

    psql(
      url,
      `INSERT INTO "CrmReadPolicyGrantFieldClass"
       ("organizationId","bundleId","grantVersionId","fieldClass")
       VALUES (${sqlString(s.orgA)},${sqlString(b2)},${sqlString(grantVersion)},'IDENTIDAD');`
    );
    expected += 1n;
    assert(rev(url, b2) === expected, 'GrantFieldClass insert bump');

    const restrictionVersion = id('rv');
    const restrictionLogical = id('r');
    psql(
      url,
      `INSERT INTO "CrmReadPolicyRestriction"
       ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind","createdAt","updatedAt")
       VALUES
       (${sqlString(s.orgA)},${sqlString(b2)},${sqlString(restrictionVersion)},
        ${sqlString(restrictionLogical)},${sqlString(s.memA)},'COMPANY',
        ${sqlString(s.t)},${sqlString(s.t)});`
    );
    expected += 1n;
    assert(rev(url, b2) === expected, 'Restriction insert bump');

    psql(
      url,
      `INSERT INTO "CrmReadPolicyRestrictionFieldClass"
       ("organizationId","bundleId","restrictionVersionId","fieldClass")
       VALUES (${sqlString(s.orgA)},${sqlString(b2)},${sqlString(restrictionVersion)},'GESTION');`
    );
    expected += 1n;
    assert(rev(url, b2) === expected, 'RestrictionFieldClass insert bump');

    const ev = id('ev');
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
       ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES
       (${sqlString(ev)},${sqlString(id('evidence'))},${sqlString(s.orgA)},1,2,
        'ADD_GRANT',${sqlString(grantLogical)},${sqlString(s.t)});`
    );
    expected += 1n;
    assert(rev(url, b2) === expected, 'Evidence insert bump candidate');

    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidenceFieldClass"
       ("organizationId","evidenceRowId","direction","fieldClass")
       VALUES (${sqlString(s.orgA)},${sqlString(ev)},'ADDED','CANAL');`
    );
    expected += 1n;
    assert(rev(url, b2) === expected, 'EvidenceFieldClass insert bump candidate');

    record('C1', true, `all child/evidence INSERT paths bumped candidate revision to ${expected}`);
  } catch (e) {
    record('C1', false, String(e));
  }

  // C2: in-place UPDATE + direct DELETE bump; nested cascade does not need its own bump.
  try {
    const grantVersion = psql(
      url,
      `SELECT "versionId" FROM "CrmReadPolicyGrant"
       WHERE "bundleId"=${sqlString(b2)} LIMIT 1;`
    );
    let before = rev(url, b2);
    psql(
      url,
      `UPDATE "CrmReadPolicyGrant"
       SET "grantVersion"='v2'
       WHERE "organizationId"=${sqlString(s.orgA)}
         AND "bundleId"=${sqlString(b2)}
         AND "versionId"=${sqlString(grantVersion)};`
    );
    assert(rev(url, b2) === before + 1n, 'grant update must bump');

    before = rev(url, b2);
    psql(
      url,
      `DELETE FROM "CrmReadPolicyBundleLeadLink"
       WHERE "organizationId"=${sqlString(s.orgA)}
         AND "bundleId"=${sqlString(b2)}
         AND "leadId"=${sqlString(s.leadA)};`
    );
    assert(rev(url, b2) === before + 1n, 'direct child delete must bump');
    record('C2', true, 'in-place UPDATE and direct DELETE bump revision');
  } catch (e) {
    record('C2', false, String(e));
  }

  // C3: same-org move locks/bump OLD+NEW; cross-org move is frozen.
  try {
    const grantVersion = psql(
      url,
      `SELECT "versionId" FROM "CrmReadPolicyGrant"
       WHERE "bundleId"=${sqlString(b2)} LIMIT 1;`
    );
    const before2 = rev(url, b2);
    const before3 = rev(url, b3);
    psql(
      url,
      `UPDATE "CrmReadPolicyGrant"
       SET "bundleId"=${sqlString(b3)}
       WHERE "organizationId"=${sqlString(s.orgA)}
         AND "bundleId"=${sqlString(b2)}
         AND "versionId"=${sqlString(grantVersion)};`
    );
    assert(rev(url, b2) > before2, 'move must bump old bundle');
    assert(rev(url, b3) > before3, 'move must bump new bundle');

    expectFail(
      url,
      `UPDATE "CrmReadPolicyGrant"
       SET "organizationId"=${sqlString(s.orgB)}
       WHERE "organizationId"=${sqlString(s.orgA)}
         AND "bundleId"=${sqlString(b3)}
         AND "versionId"=${sqlString(grantVersion)};`,
      'cross-org grant move',
      /organizationId is immutable/i
    );
    record('C3', true, 'same-org move bumps OLD+NEW; cross-org rewrite rejected');
  } catch (e) {
    record('C3', false, String(e));
  }

  // E1: candidate-anchor remains valid with a VALIDATED predecessor.
  try {
    privilegedValidateBundle(url, b1, 'pred-checksum');
    const before3 = rev(url, b3);
    const ev = id('ev');
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
       ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES
       (${sqlString(ev)},${sqlString(id('evidence'))},${sqlString(s.orgA)},1,3,
        'ADD_GRANT','candidate-anchor-ok',${sqlString(s.t)});`
    );
    assert(rev(url, b3) === before3 + 1n, 'candidate evidence must bump DRAFT candidate');
    record('E1', true, 'VALIDATED predecessor does not block evidence for DRAFT candidate');
  } catch (e) {
    record('E1', false, String(e));
  }

  // E2: evidence retarget bumps old/new candidates; org rewrite remains frozen.
  try {
    const b4 = id('bundle');
    insertBundle(url, { id: b4, org: s.orgA, version: 4, predecessorVersion: 3, t: s.t });
    const ev = id('ev');
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
       ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES
       (${sqlString(ev)},${sqlString(id('evidence'))},${sqlString(s.orgA)},2,3,
        'ADD_GRANT','retarget',${sqlString(s.t)});`
    );
    const before3 = rev(url, b3);
    const before4 = rev(url, b4);
    psql(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence"
       SET "fromVersion"=3, "toVersion"=4
       WHERE "id"=${sqlString(ev)};`
    );
    assert(rev(url, b3) === before3 + 1n, 'old candidate must bump on retarget');
    assert(rev(url, b4) === before4 + 1n, 'new candidate must bump on retarget');
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence"
       SET "organizationId"=${sqlString(s.orgB)}
       WHERE "id"=${sqlString(ev)};`,
      'evidence org rewrite',
      /organizationId is immutable/i
    );
    record('E2', true, 'evidence retarget bumps OLD+NEW candidates; org freeze preserved');
  } catch (e) {
    record('E2', false, String(e));
  }

  // E3: moving an EvidenceFieldClass between two evidence rows that belong to
  // the same candidate is one candidate mutation and must bump exactly once.
  try {
    const b8 = id('bundle');
    insertBundle(url, { id: b8, org: s.orgA, version: 8, predecessorVersion: 7, t: s.t });
    const evA = id('ev');
    const evB = id('ev');
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
       ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES
       (${sqlString(evA)},${sqlString(id('evidence'))},${sqlString(s.orgA)},7,8,
        'ADD_GRANT','fc-move-a',${sqlString(s.t)}),
       (${sqlString(evB)},${sqlString(id('evidence'))},${sqlString(s.orgA)},7,8,
        'ADD_GRANT','fc-move-b',${sqlString(s.t)});`
    );
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidenceFieldClass"
       ("organizationId","evidenceRowId","direction","fieldClass")
       VALUES (${sqlString(s.orgA)},${sqlString(evA)},'ADDED','RESERVADO');`
    );
    const before = rev(url, b8);
    psql(
      url,
      `UPDATE "CrmReadPolicyChangeEvidenceFieldClass"
       SET "evidenceRowId"=${sqlString(evB)}
       WHERE "organizationId"=${sqlString(s.orgA)}
         AND "evidenceRowId"=${sqlString(evA)}
         AND "direction"='ADDED'
         AND "fieldClass"='RESERVADO';`
    );
    assert(rev(url, b8) === before + 1n, 'same-candidate EvidenceFieldClass move must bump exactly once');
    record('E3', true, 'same-candidate EvidenceFieldClass move bumps revision exactly once');
  } catch (e) {
    record('E3', false, String(e));
  }

  // I1: once candidate is VALIDATED, all ordinary child DML remains rejected.
  try {
    const b5 = id('bundle');
    insertBundle(url, { id: b5, org: s.orgA, version: 5, predecessorVersion: 4, t: s.t });
    privilegedValidateBundle(url, b5, 'sealed-fixture');
    assert(status(url, b5) === 'VALIDATED', 'fixture must be VALIDATED');
    expectFail(
      url,
      `INSERT INTO "CrmReadPolicyRetiredGrantLogicalId"
       ("organizationId","bundleId","logicalId")
       VALUES (${sqlString(s.orgA)},${sqlString(b5)},'blocked-after-validation');`,
      'child insert into validated',
      /VALIDATED.*immutable/i
    );
    record('I1', true, 'VALIDATED bundle content remains immutable');
  } catch (e) {
    record('I1', false, String(e));
  }

  // L1: real concurrent child INSERT waits on parent row lock and is rejected
  // after the pending seal fixture commits VALIDATED.
  try {
    const b6 = id('bundle');
    insertBundle(url, { id: b6, org: s.orgA, version: 6, predecessorVersion: 5, t: s.t });
    const t1 = new PsqlSession(url);
    const t2 = new PsqlSession(url);
    let settled = false;
    let t2Error = '';
    try {
      await t1.exec('BEGIN');
      await t1.exec(
        `SELECT "id" FROM "CrmReadPolicyBundle"
         WHERE "organizationId"=${sqlString(s.orgA)}
           AND "id"=${sqlString(b6)}
         FOR UPDATE`
      );
      await t1.exec('SET LOCAL session_replication_role = replica');
      await t1.exec(
        `UPDATE "CrmReadPolicyBundle"
         SET "status"='VALIDATED', "contentChecksum"='concurrency-fixture'
         WHERE "id"=${sqlString(b6)}`
      );

      await t2.exec('BEGIN');
      const p = t2
        .exec(
          `INSERT INTO "CrmReadPolicyRetiredGrantLogicalId"
           ("organizationId","bundleId","logicalId")
           VALUES (${sqlString(s.orgA)},${sqlString(b6)},'concurrent-child')`,
          12000
        )
        .then(() => {
          settled = true;
        })
        .catch((e) => {
          settled = true;
          t2Error = e instanceof Error ? e.message : String(e);
        });

      await new Promise((r) => setTimeout(r, 350));
      assert(!settled, 'child INSERT should wait while parent lock is held');

      await t1.exec('COMMIT');
      await p;
      assert(/VALIDATED|immutable/i.test(t2Error), `blocked child should reject after seal commit: ${t2Error}`);
      try {
        await t2.exec('ROLLBACK');
      } catch {
        // expected if statement aborted txn
      }
      record('L1', true, 'bundle-scoped child DML serializes behind parent lock');
    } finally {
      await t1.close();
      await t2.close();
    }
  } catch (e) {
    record('L1', false, String(e));
  }

  // L2: evidence path locks predecessor + candidate and rejects after candidate
  // becomes VALIDATED while the evidence writer is waiting.
  try {
    const b7 = id('bundle');
    insertBundle(url, { id: b7, org: s.orgA, version: 7, predecessorVersion: 6, t: s.t });
    const t1 = new PsqlSession(url);
    const t2 = new PsqlSession(url);
    let settled = false;
    let t2Error = '';
    try {
      await t1.exec('BEGIN');
      await t1.exec(
        `SELECT "id" FROM "CrmReadPolicyBundle"
         WHERE "organizationId"=${sqlString(s.orgA)}
           AND "id"=${sqlString(b7)}
         FOR UPDATE`
      );
      await t1.exec('SET LOCAL session_replication_role = replica');
      await t1.exec(
        `UPDATE "CrmReadPolicyBundle"
         SET "status"='VALIDATED', "contentChecksum"='evidence-concurrency-fixture'
         WHERE "id"=${sqlString(b7)}`
      );

      await t2.exec('BEGIN');
      const p = t2
        .exec(
          `INSERT INTO "CrmReadPolicyChangeEvidence"
           ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
           VALUES
           (${sqlString(id('ev'))},${sqlString(id('evidence'))},${sqlString(s.orgA)},6,7,
            'ADD_GRANT','concurrent-evidence',${sqlString(s.t)})`,
          12000
        )
        .then(() => {
          settled = true;
        })
        .catch((e) => {
          settled = true;
          t2Error = e instanceof Error ? e.message : String(e);
        });

      await new Promise((r) => setTimeout(r, 350));
      assert(!settled, 'evidence INSERT should wait while candidate lock is held');

      await t1.exec('COMMIT');
      await p;
      assert(/VALIDATED|immutable/i.test(t2Error), `evidence should reject after candidate validation: ${t2Error}`);
      try {
        await t2.exec('ROLLBACK');
      } catch {
        // expected
      }
      record('L2', true, 'evidence DML serializes behind predecessor/candidate locks');
    } finally {
      await t1.close();
      await t2.close();
    }
  } catch (e) {
    record('L2', false, String(e));
  }

  // P1: helper functions are not executable by ordinary roles; re-applying
  // migration after synthetic grants removes table capability including TRUNCATE.
  try {
    psql(
      url,
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nexora_app') THEN
           CREATE ROLE nexora_app NOLOGIN;
         END IF;
       END $$;
       GRANT ALL ON TABLE "CrmReadPolicyBundle" TO nexora_app;
       GRANT EXECUTE ON FUNCTION crm_read_policy_lock_bundle_by_id(text,text) TO nexora_app;`
    );

    const migrationFile = path.join(
      repoRoot(),
      'prisma/migrations',
      MIGRATION_NAME,
      'migration.sql'
    );
    psqlFile(url, migrationFile);

    const canTable = psql(
      url,
      `SELECT has_table_privilege('nexora_app','"CrmReadPolicyBundle"','SELECT')::text || '|' ||
              has_table_privilege('nexora_app','"CrmReadPolicyBundle"','TRUNCATE')::text;`
    );
    const canFn = psql(
      url,
      `SELECT has_function_privilege(
         'nexora_app',
         'crm_read_policy_lock_bundle_by_id(text,text)',
         'EXECUTE'
       )::text;`
    );
    assert(canTable === 'false|false', `nexora_app table privileges remain: ${canTable}`);
    assert(canFn === 'false', `nexora_app helper EXECUTE remains: ${canFn}`);
    record('P1', true, 'migration revokes ordinary-role table/TRUNCATE/helper privileges');
  } catch (e) {
    record('P1', false, String(e));
  }

  // S1: this cut must not introduce any seal/HMAC surface.
  try {
    const sealFn = psql(
      url,
      `SELECT CASE
         WHEN to_regprocedure('crm_read_policy_seal_bundle(jsonb,bytea,jsonb)') IS NULL
         THEN '0' ELSE '1' END;`
    );
    const internalSchema = psql(
      url,
      `SELECT CASE WHEN EXISTS (
         SELECT 1 FROM pg_namespace WHERE nspname='crm_internal'
       ) THEN '1' ELSE '0' END;`
    );
    assert(sealFn === '0', 'seal function must not exist in 1A');
    assert(internalSchema === '0', 'secret/internal schema must not be introduced in 1A');
    record('S1', true, 'no operational seal, HMAC or secret storage introduced');
  } catch (e) {
    record('S1', false, String(e));
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n[point8-4a1c-1a] summary', {
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    failedIds: failed.map((r) => r.id),
  });

  if (failed.length > 0) {
    console.error('[point8-4a1c-1a] FAIL');
    process.exit(1);
  }

  console.log('[point8-4a1c-1a] PASS');
}

main().catch((err) => {
  console.error('[point8-4a1c-1a] FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});

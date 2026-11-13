/**
 * Point 8 / 4A-1C-0c — evidence parent locks + cross-org freeze.
 *
 * Depends on: PR #24 → PR #27 (0b candidate-anchor) → this cut.
 * Applies real migrations on disposable local Postgres.
 * Does NOT implement SealService/HMAC/activation. Not production verification.
 *
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8-4a1c-0c
 */

import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BASELINE_NAME,
  POINT8B1_NAME,
  POINT8B6_NAME,
  SLICE0_NAME,
  assertDisposableDatabaseUrl,
  prismaCliVersion,
  psql,
  readMigrationRows,
  runPrisma,
  sanitizeDbUrlForLog,
} from './fr004-lib';

/** Interactive psql session for overlapping-transaction concurrency tests. */
class PsqlSession {
  private readonly child: ChildProcessWithoutNullStreams;
  private buf = '';
  private waiters: Array<{ marker: string; resolve: (s: string) => void; reject: (e: Error) => void }> =
    [];

  constructor(databaseUrl: string) {
    // No ON_ERROR_STOP: overlapping tests must keep the session alive after a rejected statement.
    this.child = spawn('psql', [databaseUrl, '-Atq'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.onChunk(chunk));
    this.child.stderr.on('data', (chunk: string) => this.onChunk(chunk));
    this.child.on('exit', (code) => {
      for (const w of this.waiters) {
        w.reject(new Error(`psql session exited early code=${code}`));
      }
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
            () => reject(new Error(`psql exec timeout after ${timeoutMs}ms: ${sql.slice(0, 120)}`)),
            timeoutMs
          );
        }),
      ]);
      if (/ERROR:/i.test(out)) {
        throw new Error(out.trim());
      }
      return out;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async close() {
    try {
      this.child.stdin.write('\\q\n');
    } catch {
      /* ignore */
    }
    this.child.kill('SIGTERM');
  }
}

const POINT8_4A1B_NAME = '20261031200000_add_crm_read_policy_candidate_persistence';
const POINT8_4A1B_HARDENING_NAME = '20261031210000_crm_read_policy_candidate_persistence_hardening';
const POINT8_4A1C_0B_NAME = '20261109010000_crm_read_policy_evidence_candidate_anchor';
const POINT8_4A1C_0C_NAME = '20261109020000_crm_read_policy_evidence_concurrency_isolation';

type CaseResult = { id: string; ok: boolean; detail: string };
const results: CaseResult[] = [];

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${detail}`);
}

function id(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function resetPublic(url: string) {
  psql(url, 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

function expectFail(url: string, sql: string, label: string, re?: RegExp) {
  try {
    psql(url, sql);
    throw new Error(`${label}: expected failure`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('expected failure')) throw e;
    if (re && !re.test(msg)) {
      throw new Error(`${label}: failure did not match ${re}: ${msg}`);
    }
  }
}

function seedTenants(url: string) {
  const t = new Date().toISOString();
  const orgA = id('org');
  const orgB = id('org');
  const userA = id('user');
  const userB = id('user');
  const memA = id('mem');
  const memB = id('mem');
  const leadA = id('lead');
  psql(
    url,
    `INSERT INTO "User" ("id","email","password","nurtureStatus","createdAt","updatedAt") VALUES
       ('${userA}','${userA}@example.com','x','not-consented','${t}','${t}'),
       ('${userB}','${userB}@example.com','x','not-consented','${t}','${t}');
     INSERT INTO "Organization" ("id","name","slug","status","createdAt","updatedAt") VALUES
       ('${orgA}','Org A','slug-${orgA}','ACTIVE','${t}','${t}'),
       ('${orgB}','Org B','slug-${orgB}','ACTIVE','${t}','${t}');
     INSERT INTO "Membership" ("id","organizationId","userId","role","status","createdAt","updatedAt") VALUES
       ('${memA}','${orgA}','${userA}','OWNER','ACTIVE','${t}','${t}'),
       ('${memB}','${orgB}','${userB}','OWNER','ACTIVE','${t}','${t}');
     INSERT INTO "CrmLead" ("id","userId","organizationId","name","source","stage","status","value","confidence","createdAt","updatedAt") VALUES
       ('${leadA}','${userA}','${orgA}','Lead A','manual','lead','nuevo',0,25,'${t}','${t}');`
  );
  return { t, orgA, orgB, memA, memB, leadA };
}

function insertDraft(
  url: string,
  opts: {
    bundleId: string;
    orgId: string;
    version: number;
    t: string;
    predecessorVersion?: number | null;
  }
) {
  const predOrg = opts.predecessorVersion == null ? 'NULL' : `'${opts.orgId}'`;
  const predVer = opts.predecessorVersion == null ? 'NULL' : String(opts.predecessorVersion);
  psql(
    url,
    `INSERT INTO "CrmReadPolicyBundle"
      ("id","organizationId","version","status","canonicalVersion","contentChecksum",
       "predecessorOrganizationId","predecessorVersion","createdAt","updatedAt")
     VALUES ('${opts.bundleId}','${opts.orgId}',${opts.version},'DRAFT',
       'crm-read-policy-canonical/v1',NULL,${predOrg},${predVer},'${opts.t}','${opts.t}');`
  );
}

/** Disposable-only: suppress user triggers to place VALIDATED fixture (not a product path). */
function privilegedValidated(
  url: string,
  opts: { bundleId: string; orgId: string; version: number; memId: string; t: string; withGrant?: boolean }
) {
  const grant = opts.withGrant
    ? `INSERT INTO "CrmReadPolicyGrant"
         ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
          "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
       VALUES ('${opts.orgId}','${opts.bundleId}','gv_${opts.bundleId}','g_${opts.bundleId}','${opts.memId}',
         'COMPANY','LEGACY_SNAPSHOT','${opts.orgId}',true,'${opts.t}','${opts.t}');`
    : '';
  psql(
    url,
    `BEGIN;
     SET LOCAL session_replication_role = replica;
     INSERT INTO "CrmReadPolicyBundle"
       ("id","organizationId","version","status","canonicalVersion","contentChecksum","createdAt","updatedAt")
     VALUES ('${opts.bundleId}','${opts.orgId}',${opts.version},'VALIDATED',
       'crm-read-policy-canonical/v1','crm-read-policy-canonical/v1:fixture','${opts.t}','${opts.t}');
     ${grant}
     SET LOCAL session_replication_role = origin;
     COMMIT;`
  );
}

/** Lab-only: flip existing DRAFT → VALIDATED by suppressing triggers. */
function privilegedSealDraft(url: string, bundleId: string, checksum = 'crm-read-policy-canonical/v1:sealed') {
  psql(
    url,
    `BEGIN;
     SET LOCAL session_replication_role = replica;
     UPDATE "CrmReadPolicyBundle"
       SET "status"='VALIDATED', "contentChecksum"='${checksum}'
     WHERE "id"='${bundleId}' AND "status"='DRAFT';
     SET LOCAL session_replication_role = origin;
     COMMIT;`
  );
}

function eitherEndpointBodies(): { touches: string; rowTouches: string } {
  return {
    touches: `
CREATE OR REPLACE FUNCTION crm_read_policy_evidence_touches_validated(
  p_org_id text, p_from_version integer, p_to_version integer)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM "CrmReadPolicyBundle" b
    WHERE b."organizationId" = p_org_id
      AND b."version" IN (p_from_version, p_to_version)
      AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
  );
$$;`,
    rowTouches: `
CREATE OR REPLACE FUNCTION crm_read_policy_evidence_row_touches_validated(
  p_org_id text, p_evidence_row_id text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "CrmReadPolicyChangeEvidence" e
    JOIN "CrmReadPolicyBundle" b
      ON b."organizationId" = e."organizationId"
     AND b."version" IN (e."fromVersion", e."toVersion")
    WHERE e."organizationId" = p_org_id
      AND e."id" = p_evidence_row_id
      AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
  );
$$;`,
  };
}

function candidateAnchorBodies(): { touches: string; rowTouches: string } {
  return {
    touches: `
CREATE OR REPLACE FUNCTION crm_read_policy_evidence_touches_validated(
  p_org_id text, p_from_version integer, p_to_version integer)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM "CrmReadPolicyBundle" b
    WHERE b."organizationId" = p_org_id
      AND b."version" = p_to_version
      AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
  );
$$;`,
    rowTouches: `
CREATE OR REPLACE FUNCTION crm_read_policy_evidence_row_touches_validated(
  p_org_id text, p_evidence_row_id text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "CrmReadPolicyChangeEvidence" e
    JOIN "CrmReadPolicyBundle" b
      ON b."organizationId" = e."organizationId"
     AND b."version" = e."toVersion"
    WHERE e."organizationId" = p_org_id
      AND e."id" = p_evidence_row_id
      AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
  );
$$;`,
  };
}

async function main() {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('Set FR004_DATABASE_URL to disposable local Postgres');
  assertDisposableDatabaseUrl(url);

  console.log(`[point8-4a1c-0c] prisma=${prismaCliVersion()}`);
  console.log(`[point8-4a1c-0c] target=${sanitizeDbUrlForLog(url)}`);
  console.log(
    '[point8-4a1c-0c] deps PR#24@b57c233 → PR#27@0b90192 → 0c; design PR#25@29d8e34 (not modified)'
  );

  const env = { ...process.env, DATABASE_URL: url };
  console.log('[point8-4a1c-0c] prisma validate');
  runPrisma(['validate'], env);

  resetPublic(url);
  console.log('[point8-4a1c-0c] migrate deploy (#24 + 0b + 0c)');
  const deployOut = runPrisma(['migrate', 'deploy'], env);
  assert(deployOut.includes(POINT8_4A1B_NAME), '4A-1B migration missing');
  assert(deployOut.includes(POINT8_4A1B_HARDENING_NAME), 'hardening missing');
  assert(deployOut.includes(POINT8_4A1C_0B_NAME), '4A-1C-0b migration missing');
  assert(deployOut.includes(POINT8_4A1C_0C_NAME), '4A-1C-0c migration missing');

  const names = readMigrationRows(url).map((r) => r.migration_name);
  assert(
    names.length === 8 &&
      names[0] === BASELINE_NAME &&
      names[1] === SLICE0_NAME &&
      names[2] === POINT8B1_NAME &&
      names[3] === POINT8B6_NAME &&
      names[4] === POINT8_4A1B_NAME &&
      names[5] === POINT8_4A1B_HARDENING_NAME &&
      names[6] === POINT8_4A1C_0B_NAME &&
      names[7] === POINT8_4A1C_0C_NAME,
    `unexpected migrations: ${names.join(',')}`
  );

  // Confirm helper semantics: pred VALIDATED + cand DRAFT must NOT touch
  {
    const s = seedTenants(url);
    const v1 = id('b');
    const v2 = id('b');
    privilegedValidated(url, { bundleId: v1, orgId: s.orgA, version: 1, memId: s.memA, t: s.t, withGrant: true });
    insertDraft(url, { bundleId: v2, orgId: s.orgA, version: 2, t: s.t, predecessorVersion: 1 });
    const flag = psql(
      url,
      `SELECT crm_read_policy_evidence_touches_validated('${s.orgA}', 1, 2)::text;`
    );
    assert(flag === 'false', `candidate-anchor helper must be false for VALIDATED→DRAFT, got ${flag}`);
  }

  // Shared fixture for E-FIX 1-6
  const s = seedTenants(url);
  const b1 = id('b');
  const b2 = id('b');
  const b3 = id('b');
  privilegedValidated(url, { bundleId: b1, orgId: s.orgA, version: 1, memId: s.memA, t: s.t, withGrant: true });
  insertDraft(url, { bundleId: b2, orgId: s.orgA, version: 2, t: s.t, predecessorVersion: 1 });
  insertDraft(url, { bundleId: b3, orgId: s.orgA, version: 3, t: s.t, predecessorVersion: 2 });

  const ev1 = id('ev');
  const evid1 = id('evidence');

  // E-FIX-1
  try {
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${ev1}','${evid1}','${s.orgA}',1,2,'ADD_GRANT','g_new','${s.t}');`
    );
    record('E-FIX-1', true, 'INSERT evidence VALIDATED→DRAFT allowed');
  } catch (e) {
    record('E-FIX-1', false, String(e));
  }

  // E-FIX-2
  try {
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidenceFieldClass"
         ("organizationId","evidenceRowId","direction","fieldClass")
       VALUES ('${s.orgA}','${ev1}','ADDED','IDENTIDAD');`
    );
    record('E-FIX-2', true, 'INSERT EvidenceFieldClass on DRAFT candidate allowed');
  } catch (e) {
    record('E-FIX-2', false, String(e));
  }

  // E-FIX-3
  try {
    psql(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence"
         SET "changeKind"='WIDEN_GRANT_CLASSES', "targetLogicalId"='g_new2'
       WHERE "id"='${ev1}';`
    );
    record('E-FIX-3', true, 'UPDATE evidence while candidate DRAFT allowed');
  } catch (e) {
    record('E-FIX-3', false, String(e));
  }

  // E-FIX-4 — delete a disposable second evidence row while DRAFT
  const evDel = id('ev');
  try {
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${evDel}','${id('evidence')}','${s.orgA}',1,2,'ADD_RESTRICTION','r_x','${s.t}');
       DELETE FROM "CrmReadPolicyChangeEvidence" WHERE "id"='${evDel}';`
    );
    record('E-FIX-4', true, 'DELETE evidence while candidate DRAFT allowed');
  } catch (e) {
    record('E-FIX-4', false, String(e));
  }

  // Seal candidate v2 (lab-only)
  privilegedSealDraft(url, b2);

  // E-FIX-5
  try {
    expectFail(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${id('ev')}','${id('evidence')}','${s.orgA}',1,2,'ADD_GRANT','g_after','${s.t}');`,
      'E-FIX-5',
      /VALIDATED|immutable/i
    );
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence" SET "targetLogicalId"='nope' WHERE "id"='${ev1}';`,
      'E-FIX-5-upd',
      /VALIDATED|immutable/i
    );
    expectFail(
      url,
      `DELETE FROM "CrmReadPolicyChangeEvidence" WHERE "id"='${ev1}';`,
      'E-FIX-5-del',
      /VALIDATED|immutable/i
    );
    record('E-FIX-5', true, 'DML evidence after candidate VALIDATED rejected');
  } catch (e) {
    record('E-FIX-5', false, String(e));
  }

  // E-FIX-6
  try {
    expectFail(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidenceFieldClass"
         ("organizationId","evidenceRowId","direction","fieldClass")
       VALUES ('${s.orgA}','${ev1}','REMOVED','CANAL');`,
      'E-FIX-6',
      /VALIDATED|immutable/i
    );
    expectFail(
      url,
      `DELETE FROM "CrmReadPolicyChangeEvidenceFieldClass"
       WHERE "organizationId"='${s.orgA}' AND "evidenceRowId"='${ev1}';`,
      'E-FIX-6-del',
      /VALIDATED|immutable/i
    );
    record('E-FIX-6', true, 'EvidenceFieldClass DML after candidate VALIDATED rejected');
  } catch (e) {
    record('E-FIX-6', false, String(e));
  }

  // E-FIX-7: UPDATE toVersion 2→3 with V2 VALIDATED
  try {
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence" SET "toVersion"=3 WHERE "id"='${ev1}';`,
      'E-FIX-7',
      /VALIDATED|immutable/i
    );
    record('E-FIX-7', true, 'retarget away from VALIDATED candidate rejected');
  } catch (e) {
    record('E-FIX-7', false, String(e));
  }

  // E-FIX-8: evidence on DRAFT v3, try move toVersion onto VALIDATED v2
  const ev3 = id('ev');
  try {
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${ev3}','${id('evidence')}','${s.orgA}',2,3,'ADD_GRANT','g_v3','${s.t}');`
    );
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence" SET "toVersion"=2, "fromVersion"=1 WHERE "id"='${ev3}';`,
      'E-FIX-8',
      /VALIDATED|immutable/i
    );
    record('E-FIX-8', true, 'retarget DRAFT evidence onto VALIDATED candidate rejected');
  } catch (e) {
    record('E-FIX-8', false, String(e));
  }

  // E-FIX-9 cross-org: orgB has no versions — lock helper fails closed (FK-coded)
  // before row insert; message is "cannot lock" rather than stock FK text.
  try {
    expectFail(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${id('ev')}','${id('evidence')}','${s.orgB}',1,2,'ADD_GRANT','g_x','${s.t}');`,
      'E-FIX-9',
      /foreign key|violat|does not exist|cannot lock/i
    );
    record('E-FIX-9', true, 'cross-org evidence INSERT rejected (cannot lock missing candidate)');
  } catch (e) {
    record('E-FIX-9', false, String(e));
  }

  // E-FIX-10 predecessor grant immutability
  try {
    expectFail(
      url,
      `INSERT INTO "CrmReadPolicyGrant"
         ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
          "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
       VALUES ('${s.orgA}','${b1}','gv_new','g_new','${s.memA}','COMPANY',
         'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
      'E-FIX-10',
      /VALIDATED|immutable/i
    );
    record('E-FIX-10', true, 'predecessor VALIDATED grant insert still rejected');
  } catch (e) {
    record('E-FIX-10', false, String(e));
  }

  // E-FIX-11 both DRAFT
  try {
    const s2 = seedTenants(url);
    const d1 = id('b');
    const d2 = id('b');
    insertDraft(url, { bundleId: d1, orgId: s2.orgA, version: 1, t: s2.t });
    insertDraft(url, { bundleId: d2, orgId: s2.orgA, version: 2, t: s2.t, predecessorVersion: 1 });
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${id('ev')}','${id('evidence')}','${s2.orgA}',1,2,'ADD_GRANT','g_dd','${s2.t}');`
    );
    record('E-FIX-11', true, 'DRAFT→DRAFT evidence DML allowed');
  } catch (e) {
    record('E-FIX-11', false, String(e));
  }

  // E-FIX-12 sensitivity: restore either-endpoint → succession INSERT fails; restore anchor
  try {
    const s3 = seedTenants(url);
    const p1 = id('b');
    const c1 = id('b');
    privilegedValidated(url, { bundleId: p1, orgId: s3.orgA, version: 1, memId: s3.memA, t: s3.t });
    insertDraft(url, { bundleId: c1, orgId: s3.orgA, version: 2, t: s3.t, predecessorVersion: 1 });
    const old = eitherEndpointBodies();
    psql(url, old.touches);
    psql(url, old.rowTouches);
    let blocked = false;
    try {
      psql(
        url,
        `INSERT INTO "CrmReadPolicyChangeEvidence"
           ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
         VALUES ('${id('ev')}','${id('evidence')}','${s3.orgA}',1,2,'ADD_GRANT','g_sens','${s3.t}');`
      );
    } catch {
      blocked = true;
    }
    const neu = candidateAnchorBodies();
    psql(url, neu.touches);
    psql(url, neu.rowTouches);
    // prove restored anchor allows again
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${id('ev')}','${id('evidence')}','${s3.orgA}',1,2,'ADD_GRANT','g_sens2','${s3.t}');`
    );
    record(
      'E-FIX-12',
      blocked,
      blocked
        ? 'sensitivity: either-endpoint blocks succession; candidate-anchor restored'
        : 'either-endpoint did not block (unexpected)'
    );
  } catch (e) {
    // always try restore
    try {
      const neu = candidateAnchorBodies();
      psql(url, neu.touches);
      psql(url, neu.rowTouches);
    } catch {
      /* ignore */
    }
    record('E-FIX-12', false, String(e));
  }

  // ---------------------------------------------------------------------------
  // Real concurrency: two independent psql sessions, overlapping transactions
  // ---------------------------------------------------------------------------
  // CONC-A: T1 prepares lab VALIDATED flip (held open); T2 tries evidence UPDATE.
  try {
    const s4 = seedTenants(url);
    const p = id('b');
    const c = id('b');
    const ev = id('ev');
    privilegedValidated(url, { bundleId: p, orgId: s4.orgA, version: 1, memId: s4.memA, t: s4.t });
    insertDraft(url, { bundleId: c, orgId: s4.orgA, version: 2, t: s4.t, predecessorVersion: 1 });
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${ev}','${id('evidence')}','${s4.orgA}',1,2,'ADD_GRANT','g_c','${s4.t}');`
    );

    const t1 = new PsqlSession(url);
    const t2 = new PsqlSession(url);
    try {
      await t1.exec('BEGIN');
      // Lab-only seal path inside open txn (product SealService not in scope).
      // Row lock on candidate is held even under replica (triggers suppressed, lock remains).
      await t1.exec(`SET LOCAL session_replication_role = replica`);
      await t1.exec(
        `UPDATE "CrmReadPolicyBundle"
           SET "status"='VALIDATED', "contentChecksum"='crm-read-policy-canonical/v1:conc-a'
         WHERE "id"='${c}' AND "status"='DRAFT'`
      );

      await t2.exec('BEGIN');
      // T2 should block on parent FOR UPDATE until T1 commits, then fail immutability.
      const t2Promise = t2.exec(
        `UPDATE "CrmReadPolicyChangeEvidence"
           SET "targetLogicalId"='race_a'
         WHERE "id"='${ev}'`,
        12000
      );
      await new Promise((r) => setTimeout(r, 400));

      await t1.exec(`SET LOCAL session_replication_role = origin`);
      await t1.exec('COMMIT');

      let t2Ok = false;
      let t2Err = '';
      try {
        await t2Promise;
        await t2.exec('COMMIT');
        t2Ok = true;
      } catch (e) {
        t2Err = e instanceof Error ? e.message : String(e);
        try {
          await t2.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
      }

      const status = psql(url, `SELECT "status" FROM "CrmReadPolicyBundle" WHERE "id"='${c}';`);
      const target = psql(
        url,
        `SELECT "targetLogicalId" FROM "CrmReadPolicyChangeEvidence" WHERE "id"='${ev}';`
      );
      assert(status === 'VALIDATED', `candidate must be VALIDATED after T1 commit, got ${status}`);
      assert(target !== 'race_a', `evidence must not keep overlapping edit; got ${target}`);
      assert(!t2Ok, `T2 must not commit evidence edit overlapping seal; err=${t2Err.slice(0, 200)}`);

      expectFail(
        url,
        `UPDATE "CrmReadPolicyChangeEvidence" SET "targetLogicalId"='after' WHERE "id"='${ev}';`,
        'CONC-A-POST',
        /VALIDATED|immutable/i
      );
      record('CONC-A-POST', true, 'after seal commit, evidence UPDATE rejected');
      record(
        'CONC-A-OVERLAP',
        true,
        `T2 blocked/rejected after waiting on candidate lock (demonstrated). err=${t2Err.slice(0, 180)}`
      );
      record('CONC-A', true, `seal-then-edit: no post-seal mutation; target=${target}`);
    } finally {
      await t1.close();
      await t2.close();
    }
  } catch (e) {
    record('CONC-A', false, String(e));
    record('CONC-A-OVERLAP', false, String(e));
    record('CONC-A-POST', false, String(e));
  }

  // CONC-B: T1 holds open evidence UPDATE; T2 seals candidate; T1 then commits.
  try {
    const s4b = seedTenants(url);
    const p = id('b');
    const c = id('b');
    const ev = id('ev');
    privilegedValidated(url, { bundleId: p, orgId: s4b.orgA, version: 1, memId: s4b.memA, t: s4b.t });
    insertDraft(url, { bundleId: c, orgId: s4b.orgA, version: 2, t: s4b.t, predecessorVersion: 1 });
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${ev}','${id('evidence')}','${s4b.orgA}',1,2,'ADD_GRANT','g_b0','${s4b.t}');`
    );

    const t1 = new PsqlSession(url);
    const t2 = new PsqlSession(url);
    try {
      await t1.exec('BEGIN');
      await t1.exec(
        `UPDATE "CrmReadPolicyChangeEvidence"
           SET "targetLogicalId"='race_b'
         WHERE "id"='${ev}'`
      );
      // Candidate FOR UPDATE held by T1 evidence trigger until T1 commits.

      await t2.exec('BEGIN');
      await t2.exec(`SET LOCAL session_replication_role = replica`);
      const t2SealPromise = t2.exec(
        `UPDATE "CrmReadPolicyBundle"
           SET "status"='VALIDATED', "contentChecksum"='crm-read-policy-canonical/v1:conc-b'
         WHERE "id"='${c}' AND "status"='DRAFT'`,
        12000
      );
      await new Promise((r) => setTimeout(r, 400));

      await t1.exec('COMMIT');

      let t2SealOk = false;
      let t2Err = '';
      try {
        await t2SealPromise;
        await t2.exec(`SET LOCAL session_replication_role = origin`);
        await t2.exec('COMMIT');
        t2SealOk = true;
      } catch (e) {
        t2Err = e instanceof Error ? e.message : String(e);
        try {
          await t2.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
      }

      const status = psql(url, `SELECT "status" FROM "CrmReadPolicyBundle" WHERE "id"='${c}';`);
      const target = psql(
        url,
        `SELECT "targetLogicalId" FROM "CrmReadPolicyChangeEvidence" WHERE "id"='${ev}';`
      );
      assert(t2SealOk, `T2 seal must succeed after T1 releases candidate lock; ${t2Err}`);
      assert(status === 'VALIDATED', `expected VALIDATED, got ${status}`);
      assert(target === 'race_b', `T1 edit before seal must persist; got ${target}`);

      expectFail(
        url,
        `UPDATE "CrmReadPolicyChangeEvidence" SET "targetLogicalId"='after_b' WHERE "id"='${ev}';`,
        'CONC-B-POST',
        /VALIDATED|immutable/i
      );
      record('CONC-B-POST', true, 'post-seal evidence UPDATE rejected');
      record(
        'CONC-B-OVERLAP',
        true,
        'T2 seal waited on T1 candidate lock; edit-then-seal serialized without lost immutability'
      );
      record('CONC-B', true, `edit-then-seal ordered; status=${status} target=${target}`);
    } finally {
      await t1.close();
      await t2.close();
    }
  } catch (e) {
    record('CONC-B', false, String(e));
    record('CONC-B-OVERLAP', false, String(e));
    record('CONC-B-POST', false, String(e));
  }

  // ---------------------------------------------------------------------------
  // Real isolation: both orgs DRAFT — cross-org evidence / field-class moves
  // ---------------------------------------------------------------------------
  try {
    const s5 = seedTenants(url);
    const pA = id('b');
    const cA = id('b');
    const pB = id('b');
    const cB = id('b');
    // Both orgs: DRAFT predecessors + DRAFT candidates (no VALIDATED dependency)
    insertDraft(url, { bundleId: pA, orgId: s5.orgA, version: 1, t: s5.t });
    insertDraft(url, { bundleId: cA, orgId: s5.orgA, version: 2, t: s5.t, predecessorVersion: 1 });
    insertDraft(url, { bundleId: pB, orgId: s5.orgB, version: 1, t: s5.t });
    insertDraft(url, { bundleId: cB, orgId: s5.orgB, version: 2, t: s5.t, predecessorVersion: 1 });

    const evA = id('ev');
    const evidA = id('evidence');
    const evB = id('ev');
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES
         ('${evA}','${evidA}','${s5.orgA}',1,2,'ADD_GRANT','g_a','${s5.t}'),
         ('${evB}','${id('evidence')}','${s5.orgB}',1,2,'ADD_GRANT','g_b','${s5.t}');
       INSERT INTO "CrmReadPolicyChangeEvidenceFieldClass"
         ("organizationId","evidenceRowId","direction","fieldClass")
       VALUES ('${s5.orgA}','${evA}','ADDED','IDENTIDAD'),
              ('${s5.orgB}','${evB}','ADDED','CANAL');`
    );

    const beforeA = psql(
      url,
      `SELECT "organizationId"||':'||"targetLogicalId" FROM "CrmReadPolicyChangeEvidence" WHERE "id"='${evA}';`
    );
    const beforeFc = psql(
      url,
      `SELECT COUNT(*)::text FROM "CrmReadPolicyChangeEvidenceFieldClass"
       WHERE "organizationId"='${s5.orgA}' AND "evidenceRowId"='${evA}';`
    );

    // Any organizationId rewrite is rejected by 0c org-freeze (before FK).
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence"
         SET "organizationId"='${s5.orgB}', "fromVersion"=1, "toVersion"=99
       WHERE "id"='${evA}';`,
      'ISO-EV-ORG',
      /organizationId is immutable/i
    );
    // Same-org incoherent toVersion still fails closed via lock/FK path.
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence"
         SET "fromVersion"=1, "toVersion"=99
       WHERE "id"='${evA}';`,
      'ISO-EV-FK',
      /foreign key|violat|cannot lock/i
    );
    const afterA = psql(
      url,
      `SELECT "organizationId"||':'||"targetLogicalId" FROM "CrmReadPolicyChangeEvidence" WHERE "id"='${evA}';`
    );
    assert(beforeA === afterA, `partial evidence move: before=${beforeA} after=${afterA}`);

    // Field class: keep orgA but point at orgB evidence id → composite FK fail.
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidenceFieldClass"
         SET "evidenceRowId"='${evB}'
       WHERE "organizationId"='${s5.orgA}' AND "evidenceRowId"='${evA}' AND "fieldClass"='IDENTIDAD';`,
      'ISO-FC-FK',
      /foreign key|violat/i
    );
    // Field class: change organizationId to orgB while evidenceRowId still orgA's row.
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidenceFieldClass"
         SET "organizationId"='${s5.orgB}'
       WHERE "organizationId"='${s5.orgA}' AND "evidenceRowId"='${evA}' AND "fieldClass"='IDENTIDAD';`,
      'ISO-FC-ORG',
      /organizationId is immutable|foreign key|violat/i
    );
    const afterFc = psql(
      url,
      `SELECT COUNT(*)::text FROM "CrmReadPolicyChangeEvidenceFieldClass"
       WHERE "organizationId"='${s5.orgA}' AND "evidenceRowId"='${evA}';`
    );
    assert(beforeFc === afterFc, `partial field-class move: before=${beforeFc} after=${afterFc}`);

    // Version-aligned orgId rewrite must now be rejected by 0c org-freeze.
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence"
         SET "organizationId"='${s5.orgB}'
       WHERE "id"='${evA}';`,
      'ISO-ORG-ALIGN',
      /organizationId is immutable/i
    );
    const stillA = psql(
      url,
      `SELECT "organizationId" FROM "CrmReadPolicyChangeEvidence" WHERE "id"='${evA}';`
    );
    assert(stillA === s5.orgA, `aligned org move must not stick; got ${stillA}`);

    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidenceFieldClass"
         SET "organizationId"='${s5.orgB}', "evidenceRowId"='${evB}'
       WHERE "organizationId"='${s5.orgA}' AND "evidenceRowId"='${evA}' AND "fieldClass"='IDENTIDAD';`,
      'ISO-FC-ALIGN',
      /organizationId is immutable|foreign key|violat/i
    );

    record(
      'ISO-CROSS-ORG',
      true,
      'FK rejects incoherent cross-org retargets; no partial writes on failed statements'
    );
    record(
      'ISO-ORG-ALIGN',
      true,
      'organizationId rewrite rejected even when both orgs share version numbers 1/2'
    );
  } catch (e) {
    record('ISO-CROSS-ORG', false, String(e));
    record('ISO-ORG-ALIGN', false, String(e));
  }

  // OLD/NEW retargets among DRAFT candidates vs onto VALIDATED
  try {
    const s6 = seedTenants(url);
    const d1 = id('b');
    const d2 = id('b');
    const d3 = id('b');
    insertDraft(url, { bundleId: d1, orgId: s6.orgA, version: 1, t: s6.t });
    insertDraft(url, { bundleId: d2, orgId: s6.orgA, version: 2, t: s6.t, predecessorVersion: 1 });
    insertDraft(url, { bundleId: d3, orgId: s6.orgA, version: 3, t: s6.t, predecessorVersion: 2 });
    const ev = id('ev');
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${ev}','${id('evidence')}','${s6.orgA}',1,2,'ADD_GRANT','g_old','${s6.t}');`
    );
    // OLD/NEW both DRAFT candidates: retarget toVersion 2→3 allowed
    psql(url, `UPDATE "CrmReadPolicyChangeEvidence" SET "toVersion"=3, "fromVersion"=2 WHERE "id"='${ev}';`);
    const mid = psql(url, `SELECT "toVersion"::text FROM "CrmReadPolicyChangeEvidence" WHERE "id"='${ev}';`);
    assert(mid === '3', `expected toVersion 3, got ${mid}`);

    privilegedSealDraft(url, d3);
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence" SET "toVersion"=2, "fromVersion"=1 WHERE "id"='${ev}';`,
      'OLDNEW-away',
      /VALIDATED|immutable/i
    );
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence" SET "targetLogicalId"='no' WHERE "id"='${ev}';`,
      'OLDNEW-post',
      /VALIDATED|immutable/i
    );
    record('OLD-NEW', true, 'DRAFT→DRAFT retarget allowed; OLD/NEW involving VALIDATED candidate rejected');
  } catch (e) {
    record('OLD-NEW', false, String(e));
  }

  // Post-validation immutability dedicated case
  try {
    const s7 = seedTenants(url);
    const p = id('b');
    const c = id('b');
    const ev = id('ev');
    privilegedValidated(url, { bundleId: p, orgId: s7.orgA, version: 1, memId: s7.memA, t: s7.t });
    insertDraft(url, { bundleId: c, orgId: s7.orgA, version: 2, t: s7.t, predecessorVersion: 1 });
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${ev}','${id('evidence')}','${s7.orgA}',1,2,'ADD_GRANT','g_pv','${s7.t}');
       INSERT INTO "CrmReadPolicyChangeEvidenceFieldClass"
         ("organizationId","evidenceRowId","direction","fieldClass")
       VALUES ('${s7.orgA}','${ev}','ADDED','GESTION');`
    );
    privilegedSealDraft(url, c);
    expectFail(
      url,
      `UPDATE "CrmReadPolicyChangeEvidence" SET "changeKind"='REMOVE_GRANT' WHERE "id"='${ev}';`,
      'POST-VAL-EV',
      /VALIDATED|immutable/i
    );
    expectFail(
      url,
      `DELETE FROM "CrmReadPolicyChangeEvidenceFieldClass" WHERE "evidenceRowId"='${ev}';`,
      'POST-VAL-FC',
      /VALIDATED|immutable/i
    );
    record('POST-VAL', true, 'after candidate VALIDATED, evidence and field-class DML rejected');
  } catch (e) {
    record('POST-VAL', false, String(e));
  }

  // Historical immutability of VALIDATED predecessor content (extra regression)
  try {
    const grantCount = psql(
      url,
      `SELECT COUNT(*)::text FROM "CrmReadPolicyGrant" g
       JOIN "CrmReadPolicyBundle" b ON b."id"=g."bundleId" AND b."status"='VALIDATED';`
    );
    assert(Number(grantCount) >= 1, 'expected VALIDATED grants from fixtures');
    record('HIST', true, `VALIDATED predecessor content remains (${grantCount} grants); E-FIX-10 covered writes`);
  } catch (e) {
    record('HIST', false, String(e));
  }

  // contentRevision bumps on evidence DML
  try {
    const sR = seedTenants(url);
    const p = id('b');
    const c = id('b');
    privilegedValidated(url, { bundleId: p, orgId: sR.orgA, version: 1, memId: sR.memA, t: sR.t });
    insertDraft(url, { bundleId: c, orgId: sR.orgA, version: 2, t: sR.t, predecessorVersion: 1 });
    const r0 = Number(
      psql(url, `SELECT "contentRevision"::text FROM "CrmReadPolicyBundle" WHERE "id"='${c}';`)
    );
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${id('ev')}','${id('evidence')}','${sR.orgA}',1,2,'ADD_GRANT','g_rev','${sR.t}');`
    );
    const r1 = Number(
      psql(url, `SELECT "contentRevision"::text FROM "CrmReadPolicyBundle" WHERE "id"='${c}';`)
    );
    assert(r1 === r0 + 1, `contentRevision expected ${r0}+1 got ${r1}`);
    record('REV', true, `contentRevision bumped on evidence INSERT ${r0}→${r1}`);
  } catch (e) {
    record('REV', false, String(e));
  }

  // Sensitivity: remove parent lock helper body → CONC-A style race reappears
  try {
    const sS = seedTenants(url);
    const p = id('b');
    const c = id('b');
    const ev = id('ev');
    privilegedValidated(url, { bundleId: p, orgId: sS.orgA, version: 1, memId: sS.memA, t: sS.t });
    insertDraft(url, { bundleId: c, orgId: sS.orgA, version: 2, t: sS.t, predecessorVersion: 1 });
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${ev}','${id('evidence')}','${sS.orgA}',1,2,'ADD_GRANT','g_s','${sS.t}');`
    );
    // Mutant: drop parent FOR UPDATE AND contentRevision bump so evidence DML no
    // longer touches the candidate row. Without both, an overlapping edit can
    // commit while a seal txn holds the candidate — proving the lock is required.
    // (bump alone serializes via UPDATE; removing only FOR UPDATE is insufficient.)
    psql(
      url,
      `CREATE OR REPLACE FUNCTION crm_read_policy_lock_bundle_by_version(p_org_id text, p_version integer)
       RETURNS text LANGUAGE plpgsql AS $$
       DECLARE v_id text;
       BEGIN
         SELECT b."id" INTO v_id FROM "CrmReadPolicyBundle" b
         WHERE b."organizationId"=p_org_id AND b."version"=p_version;
         RETURN v_id;
       END; $$;
       CREATE OR REPLACE FUNCTION crm_read_policy_bump_content_revision(p_org_id text, p_version integer)
       RETURNS void LANGUAGE plpgsql AS $$
       BEGIN
         RETURN;
       END; $$;`
    );
    const t1 = new PsqlSession(url);
    const t2 = new PsqlSession(url);
    let raced = false;
    let raceErr = '';
    try {
      await t1.exec('BEGIN');
      await t1.exec(`SET LOCAL session_replication_role = replica`);
      await t1.exec(
        `UPDATE "CrmReadPolicyBundle"
           SET "status"='VALIDATED', "contentChecksum"='crm-read-policy-canonical/v1:sens'
         WHERE "id"='${c}'`
      );
      await t2.exec('BEGIN');
      // T2 must be able to finish while T1 still holds the open seal txn.
      const t2Promise = t2.exec(
        `UPDATE "CrmReadPolicyChangeEvidence" SET "targetLogicalId"='sens_race' WHERE "id"='${ev}'`,
        8000
      );
      await new Promise((r) => setTimeout(r, 300));
      try {
        await t2Promise;
        await t2.exec('COMMIT');
        raced = true;
      } catch (e) {
        raceErr = e instanceof Error ? e.message : String(e);
        try {
          await t2.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
      }
      await t1.exec('COMMIT');
    } finally {
      await t1.close();
      await t2.close();
      psql(
        url,
        `CREATE OR REPLACE FUNCTION crm_read_policy_lock_bundle_by_version(p_org_id text, p_version integer)
         RETURNS text LANGUAGE plpgsql AS $$
         DECLARE v_id text;
         BEGIN
           SELECT b."id" INTO v_id FROM "CrmReadPolicyBundle" b
           WHERE b."organizationId"=p_org_id AND b."version"=p_version
           FOR UPDATE;
           IF v_id IS NULL THEN
             RAISE EXCEPTION 'crm_read_policy: cannot lock candidate bundle %.%', p_org_id, p_version
               USING ERRCODE = 'foreign_key_violation';
           END IF;
           RETURN v_id;
         END; $$;
         CREATE OR REPLACE FUNCTION crm_read_policy_bump_content_revision(p_org_id text, p_version integer)
         RETURNS void LANGUAGE plpgsql AS $$
         BEGIN
           UPDATE "CrmReadPolicyBundle"
           SET "contentRevision" = "contentRevision" + 1
           WHERE "organizationId" = p_org_id
             AND "version" = p_version;
         END; $$;`
      );
    }
    const sensTarget = psql(
      url,
      `SELECT "targetLogicalId" FROM "CrmReadPolicyChangeEvidence" WHERE "id"='${ev}'`
    );
    const sensOk = raced && sensTarget === 'sens_race';
    record(
      'SENS-LOCK',
      sensOk,
      sensOk
        ? 'sensitivity: without parent FOR UPDATE (+ bump touch), edit commits during open seal (control necessary); restored'
        : `expected race when locks removed; raced=${raced} target=${sensTarget} err=${raceErr.slice(0, 160)}`
    );
  } catch (e) {
    record('SENS-LOCK', false, String(e));
  }

  // Sensitivity: org-freeze clause present + mutant proves aligned rewrite becomes possible
  try {
    const sO = seedTenants(url);
    insertDraft(url, { bundleId: id('b'), orgId: sO.orgA, version: 1, t: sO.t });
    insertDraft(url, {
      bundleId: id('b'),
      orgId: sO.orgA,
      version: 2,
      t: sO.t,
      predecessorVersion: 1,
    });
    insertDraft(url, { bundleId: id('b'), orgId: sO.orgB, version: 1, t: sO.t });
    insertDraft(url, {
      bundleId: id('b'),
      orgId: sO.orgB,
      version: 2,
      t: sO.t,
      predecessorVersion: 1,
    });
    const before = psql(
      url,
      `SELECT pg_get_functiondef('crm_read_policy_child_immutability()'::regprocedure)`
    );
    assert(before.includes('organizationId is immutable'), '0c org freeze missing from function');
    record('SENS-ORG-DEF', true, 'org-freeze clause present in child_immutability (definition check)');

    const evM = id('ev');
    psql(
      url,
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId","createdAt")
       VALUES ('${evM}','${id('evidence')}','${sO.orgA}',1,2,'ADD_GRANT','g_om','${sO.t}');`
    );
    // Mutant: skip org-freeze on evidence UPDATE but keep candidate-anchor + locks.
    const migPath = path.join(
      process.cwd(),
      'prisma/migrations/20261109020000_crm_read_policy_evidence_concurrency_isolation/migration.sql'
    );
    psql(
      url,
      `CREATE OR REPLACE FUNCTION crm_read_policy_child_immutability()
       RETURNS trigger LANGUAGE plpgsql AS $$
       DECLARE old_to integer; new_to integer;
       BEGIN
         IF TG_TABLE_NAME = 'CrmReadPolicyChangeEvidence' THEN
           IF TG_OP = 'UPDATE' THEN
             PERFORM crm_read_policy_lock_two_candidates(
               OLD."organizationId", OLD."toVersion",
               NEW."organizationId", NEW."toVersion"
             );
             IF crm_read_policy_evidence_touches_validated(
               OLD."organizationId", OLD."fromVersion", OLD."toVersion"
             ) THEN
               RAISE EXCEPTION 'crm_read_policy: evidence origin tied to VALIDATED bundle is immutable'
                 USING ERRCODE = 'integrity_constraint_violation';
             END IF;
             IF crm_read_policy_evidence_touches_validated(
               NEW."organizationId", NEW."fromVersion", NEW."toVersion"
             ) THEN
               RAISE EXCEPTION 'crm_read_policy: evidence destination tied to VALIDATED bundle is immutable'
                 USING ERRCODE = 'integrity_constraint_violation';
             END IF;
             RETURN NEW;
           END IF;
         END IF;
         RETURN COALESCE(NEW, OLD);
       END; $$;`
    );
    let moved = false;
    try {
      psql(
        url,
        `UPDATE "CrmReadPolicyChangeEvidence"
           SET "organizationId"='${sO.orgB}'
         WHERE "id"='${evM}';`
      );
      const got = psql(
        url,
        `SELECT "organizationId" FROM "CrmReadPolicyChangeEvidence" WHERE "id"='${evM}';`
      );
      moved = got === sO.orgB;
    } finally {
      // Restore full 0c trigger body from migration file (idempotent CREATE OR REPLACE).
      const sql = fs.readFileSync(migPath, 'utf8');
      psql(url, sql);
    }
    record(
      'SENS-ORG',
      moved,
      moved
        ? 'sensitivity: without org-freeze, aligned organizationId rewrite succeeds (control necessary); 0c restored'
        : 'expected aligned org rewrite when org-freeze removed'
    );
  } catch (e) {
    try {
      const migPath = path.join(
        process.cwd(),
        'prisma/migrations/20261109020000_crm_read_policy_evidence_concurrency_isolation/migration.sql'
      );
      psql(url, fs.readFileSync(migPath, 'utf8'));
    } catch {
      /* ignore */
    }
    record('SENS-ORG-DEF', false, String(e));
    record('SENS-ORG', false, String(e));
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n[point8-4a1c-0c] summary', {
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    failedIds: failed.map((r) => r.id),
  });
  if (failed.length) {
    console.error('[point8-4a1c-0c] FAIL');
    process.exit(1);
  }
  console.log('[point8-4a1c-0c] PASS');
}

main().catch((err) => {
  console.error('[point8-4a1c-0c] FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});

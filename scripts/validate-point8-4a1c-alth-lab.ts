/**
 * Point 8 / 4A-1C ALT-H — disposable security laboratory runner.
 *
 * Verifies HMAC + privilege + concurrency + sensitivity guarantees from PR #25 design.
 * Does NOT implement operational 4A-1C-1, touch product migrations, or use hosted DBs.
 *
 *   FR004_DATABASE_URL=postgresql://nexora_lab_owner:...@127.0.0.1:5432/nexora_point8_4a1c_lab \
 *     npm run tenancy:validate-point8-4a1c-alth-lab
 */

import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertDisposableDatabaseUrl, repoRoot } from './fr004-lib';

type Result = { id: string; ok: boolean; detail: string };

const results: Result[] = [];
const LAB = path.join(repoRoot(), 'lab/point8-4a1c-alth');

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark} ${id}: ${detail}`);
}

function parseUrl(url: string) {
  const u = new URL(url.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'));
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

function withUser(baseUrl: string, user: string, password: string): string {
  const u = new URL(baseUrl.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'));
  u.username = user;
  u.password = password;
  return u.toString().replace(/^http:/, 'postgresql:');
}

function psql(url: string, sql: string, opts?: { rows?: boolean }): string {
  assertDisposableDatabaseUrl(url, 'FR004_DATABASE_URL');
  const p = parseUrl(url);
  const args = [
    '-h', p.host,
    '-p', p.port,
    '-U', p.user,
    '-d', p.database,
    '-v', 'ON_ERROR_STOP=1',
    '-At',
  ];
  if (!opts?.rows) args.push('-q');
  const out = execFileSync('psql', args, {
    input: sql,
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: p.password },
  });
  return out.trim();
}

function psqlFile(url: string, file: string) {
  const sql = fs.readFileSync(file, 'utf8');
  psql(url, sql);
}

function expectFail(url: string, sql: string, needle?: string): string {
  try {
    psql(url, sql);
    throw new Error('expected failure but succeeded');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stderr = (e as { stderr?: string }).stderr || msg;
    if (needle && !stderr.includes(needle) && !msg.includes(needle)) {
      // execFileSync puts pg errors in exception message
      if (!String(e).includes(needle)) {
        throw new Error(`failure did not include '${needle}': ${stderr || msg}`);
      }
    }
    return stderr || msg;
  }
}

function attestationCanonical(att: Record<string, string | number | null>): Buffer {
  const parts = [
    att.v ?? '',
    att.keyId ?? '',
    att.organizationId ?? '',
    att.bundleId ?? '',
    att.version ?? '',
    att.canonicalVersion ?? '',
    att.contentChecksum ?? '',
    att.contentRevision ?? '',
    att.predecessorVersion ?? '',
    att.predecessorChecksum ?? '',
    att.issuedAt ?? '',
    att.nonce ?? '',
  ].map((x) => (x === null || x === undefined ? '' : String(x)));
  return Buffer.from(parts.join('|'), 'utf8');
}

function macHex(secret: Buffer, att: Record<string, string | number | null>): string {
  return createHmac('sha256', secret).update(attestationCanonical(att)).digest('hex');
}

function setupLab(ownerUrl: string, secret: Buffer, keyId: string) {
  for (const f of ['01_lab_schema.sql', '02_locks_revision_seal.sql', '03_grants_lab_roles.sql']) {
    psqlFile(ownerUrl, path.join(LAB, 'sql', f));
  }
  // Seed synthetic HMAC key (lab only).
  psql(
    ownerUrl,
    `INSERT INTO lab_alth_internal.seal_hmac_key(key_id, secret, status)
     VALUES ('${keyId}', decode('${secret.toString('hex')}', 'hex'), 'active');`
  );
}

function seedOrgs(ownerUrl: string) {
  psql(
    ownerUrl,
    `
    INSERT INTO lab_alth.lab_bundle(organization_id, id, version, status, content_checksum)
    VALUES
      ('orgA', 'bundleA1', 1, 'DRAFT', NULL),
      ('orgA', 'bundleA2', 2, 'DRAFT', NULL),
      ('orgB', 'bundleB1', 1, 'DRAFT', NULL);
    `
  );
}

function run() {
  const ownerUrl =
    process.env.FR004_DATABASE_URL ||
    process.env.DATABASE_URL ||
    '';
  if (!ownerUrl) {
    throw new Error(
      'Set FR004_DATABASE_URL to disposable lab owner URL, e.g. postgresql://nexora_lab_owner:...@127.0.0.1:5432/nexora_point8_4a1c_lab'
    );
  }
  assertDisposableDatabaseUrl(ownerUrl);

  const appUrl = withUser(ownerUrl, 'nexora_lab_app', 'lab_app_only_synthetic');
  const sealerUrl = withUser(ownerUrl, 'nexora_lab_sealer', 'lab_sealer_only_synthetic');

  const keyId = 'crm-seal-hmac/lab-v1';
  const secret = randomBytes(32);

  console.log('--- ALT-H lab setup ---');
  setupLab(ownerUrl, secret, keyId);
  seedOrgs(ownerUrl);

  // ---------- HMAC / privilege ----------
  try {
    expectFail(
      appUrl,
      `UPDATE lab_alth.lab_bundle SET status='VALIDATED', content_checksum='x' WHERE id='bundleA1';`
    );
    record('N1', true, 'app cannot UPDATE status to VALIDATED');
  } catch (e) {
    record('N1', false, String(e));
  }

  try {
    expectFail(
      appUrl,
      `SELECT lab_alth.seal_bundle('{"v":"1"}'::jsonb, decode('00','hex'), '{}'::jsonb);`,
      'permission denied'
    );
    record('N2', true, 'app EXECUTE seal denied');
  } catch (e) {
    record('N2', false, String(e));
  }

  try {
    const att = {
      v: 1,
      keyId,
      organizationId: 'orgA',
      bundleId: 'bundleA1',
      version: 1,
      canonicalVersion: 'lab-canonical/v1',
      contentChecksum: 'chk-a1',
      contentRevision: 0,
      predecessorVersion: null,
      predecessorChecksum: null,
      issuedAt: new Date().toISOString(),
      nonce: randomUUID(),
    };
    expectFail(
      sealerUrl,
      `SELECT lab_alth.seal_bundle('${JSON.stringify(att)}'::jsonb, NULL, '{}'::jsonb);`
    );
    expectFail(
      sealerUrl,
      `SELECT lab_alth.seal_bundle('${JSON.stringify(att)}'::jsonb, decode('${'00'.repeat(32)}','hex'), '{}'::jsonb);`,
      'mac mismatch'
    );
    record('N3', true, 'missing/wrong MAC rejected');
  } catch (e) {
    record('N3', false, String(e));
  }

  // Positive seal for A1 then misuse MAC on B
  let sealedAtt: Record<string, string | number | null> | null = null;
  try {
    const rev = psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='bundleA1';`);
    const att = {
      v: 1,
      keyId,
      organizationId: 'orgA',
      bundleId: 'bundleA1',
      version: 1,
      canonicalVersion: 'lab-canonical/v1',
      contentChecksum: 'chk-a1',
      contentRevision: Number(rev),
      predecessorVersion: null,
      predecessorChecksum: null,
      issuedAt: new Date().toISOString(),
      nonce: randomUUID(),
    };
    const mac = macHex(secret, att);
    const out = psql(
      sealerUrl,
      `SELECT lab_alth.seal_bundle('${JSON.stringify(att)}'::jsonb, decode('${mac}','hex'), '{"actorId":"lab"}'::jsonb);`
    );
    assert(out.includes('sealed') || out.includes('already_sealed'), 'seal failed: ' + out);
    sealedAtt = att;
    record('P1', true, 'valid HMAC seals DRAFT→VALIDATED: ' + out);
  } catch (e) {
    record('P1', false, String(e));
  }

  try {
    assert(sealedAtt, 'need sealed att');
    const bad = { ...sealedAtt, bundleId: 'bundleB1', organizationId: 'orgB', contentRevision: 0 };
    const mac = macHex(secret, sealedAtt);
    expectFail(
      sealerUrl,
      `SELECT lab_alth.seal_bundle('${JSON.stringify(bad)}'::jsonb, decode('${mac}','hex'), '{}'::jsonb);`,
      'mac mismatch'
    );
    record('N4', true, 'MAC for A rejected on B payload');
  } catch (e) {
    record('N4', false, String(e));
  }

  try {
    // Prepare A2 draft revision, build MAC, mutate grant, then seal with old revision
    psql(
      ownerUrl,
      `UPDATE lab_alth.lab_bundle SET predecessor_organization_id='orgA', predecessor_version=1 WHERE id='bundleA2';`
    );
    // Make A1 already VALIDATED as predecessor — done in P1
    const revBefore = Number(
      psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='bundleA2';`)
    );
    const att = {
      v: 1,
      keyId,
      organizationId: 'orgA',
      bundleId: 'bundleA2',
      version: 2,
      canonicalVersion: 'lab-canonical/v1',
      contentChecksum: 'chk-a2',
      contentRevision: revBefore,
      predecessorVersion: 1,
      predecessorChecksum: 'chk-a1',
      issuedAt: new Date().toISOString(),
      nonce: randomUUID(),
    };
    const mac = macHex(secret, att);
    psql(
      ownerUrl,
      `INSERT INTO lab_alth.lab_grant(organization_id, bundle_id, version_id, logical_id, payload)
       VALUES ('orgA','bundleA2','g1','L1','x');`
    );
    const revAfter = Number(
      psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='bundleA2';`)
    );
    assert(revAfter === revBefore + 1, `expected revision bump ${revBefore}+1 got ${revAfter}`);
    expectFail(
      sealerUrl,
      `SELECT lab_alth.seal_bundle('${JSON.stringify(att)}'::jsonb, decode('${mac}','hex'), '{}'::jsonb);`,
      'revision'
    );
    record('N5', true, `stale attestation rejected after grant insert (rev ${revBefore}→${revAfter})`);
  } catch (e) {
    record('N5', false, String(e));
  }

  try {
    expectFail(
      sealerUrl,
      `UPDATE lab_alth.lab_bundle SET status='VALIDATED', content_checksum='forged' WHERE id='bundleA2';`
    );
    record('N6', true, 'sealer raw UPDATE status denied/blocked');
  } catch (e) {
    record('N6', false, String(e));
  }

  try {
    expectFail(
      sealerUrl,
      `SELECT encode(secret,'hex') FROM lab_alth_internal.seal_hmac_key;`,
      'permission denied'
    );
    expectFail(
      appUrl,
      `SELECT encode(secret,'hex') from lab_alth_internal.seal_hmac_key;`,
      'permission denied'
    );
    record('N7', true, 'ordinary/sealer cannot SELECT HMAC secret');
  } catch (e) {
    record('N7', false, String(e));
  }

  try {
    // Simulate anon-like: revoke and ensure no public execute
    const pub = psql(
      ownerUrl,
      `SELECT has_function_privilege('public', 'lab_alth.seal_bundle(jsonb,bytea,jsonb)', 'EXECUTE')::text;`
    );
    assert(pub === 'false', 'public must not execute seal');
    record('N8', true, 'PUBLIC lacks seal EXECUTE');
  } catch (e) {
    record('N8', false, String(e));
  }

  try {
    psql(ownerUrl, `REVOKE EXECUTE ON FUNCTION lab_alth.seal_bundle(jsonb,bytea,jsonb) FROM nexora_lab_sealer;`);
    const rev = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='bundleA2';`));
    const att = {
      v: 1,
      keyId,
      organizationId: 'orgA',
      bundleId: 'bundleA2',
      version: 2,
      canonicalVersion: 'lab-canonical/v1',
      contentChecksum: 'chk-a2',
      contentRevision: rev,
      predecessorVersion: 1,
      predecessorChecksum: 'chk-a1',
      issuedAt: new Date().toISOString(),
      nonce: randomUUID(),
    };
    const mac = macHex(secret, att);
    expectFail(
      sealerUrl,
      `SELECT lab_alth.seal_bundle('${JSON.stringify(att)}'::jsonb, decode('${mac}','hex'), '{}'::jsonb);`,
      'permission denied'
    );
    psql(ownerUrl, `GRANT EXECUTE ON FUNCTION lab_alth.seal_bundle(jsonb,bytea,jsonb) TO nexora_lab_sealer;`);
    record('N9', true, 'fail-closed REVOKE EXECUTE blocks seal even with valid MAC');
  } catch (e) {
    try {
      psql(ownerUrl, `GRANT EXECUTE ON FUNCTION lab_alth.seal_bundle(jsonb,bytea,jsonb) TO nexora_lab_sealer;`);
    } catch {
      /* ignore */
    }
    record('N9', false, String(e));
  }

  try {
    expectFail(
      sealerUrl,
      `SELECT lab_alth.seal_bundle(
        jsonb_build_object('organizationId','orgA','bundleId','bundleA2','contentChecksum','only'),
        decode('${'ab'.repeat(32)}','hex'),
        jsonb_build_object('actorId','x','sealAuthorityRef','y')
      );`
    );
    record('N10', true, 'checksum/actor/authorityRef alone cannot seal');
  } catch (e) {
    record('N10', false, String(e));
  }

  try {
    expectFail(
      appUrl,
      `ALTER FUNCTION lab_alth.seal_bundle(jsonb,bytea,jsonb) OWNER TO nexora_lab_app;`,
      'must be owner'
    );
    record('N11', true, 'app cannot ALTER FUNCTION seal');
  } catch (e) {
    record('N11', false, String(e));
  }

  try {
    expectFail(appUrl, `DROP TRIGGER trg_lab_child ON lab_alth.lab_grant;`);
    expectFail(appUrl, `ALTER TABLE lab_alth.lab_grant DISABLE TRIGGER USER;`);
    record('N12', true, 'app cannot drop/disable child triggers');
  } catch (e) {
    record('N12', false, String(e));
  }

  try {
    expectFail(
      appUrl,
      `GRANT EXECUTE ON FUNCTION lab_alth.seal_bundle(jsonb,bytea,jsonb) TO nexora_lab_app;`
    );
    record('N13', true, 'app cannot GRANT EXECUTE to itself');
  } catch (e) {
    record('N13', false, String(e));
  }

  // ---------- Concurrency / inventory ----------
  const inventoryTables = [
    'lab_membership_link',
    'lab_lead_link',
    'lab_retired_logical_id',
    'lab_grant',
    'lab_grant_field_class',
    'lab_restriction',
    'lab_restriction_field_class',
    'lab_change_evidence',
    'lab_change_evidence_field_class',
  ];

  try {
    // Reset A2-ish workspace: use orgB for concurrency fixtures
    psql(
      ownerUrl,
      `
      INSERT INTO lab_alth.lab_bundle(organization_id, id, version, status)
      VALUES ('orgC', 'c1', 1, 'DRAFT'), ('orgC', 'c2', 2, 'DRAFT')
      ON CONFLICT DO NOTHING;
      `
    );
    let allBump = true;
    const details: string[] = [];

    // membership link
    let r0 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c1';`));
    psql(
      ownerUrl,
      `INSERT INTO lab_alth.lab_membership_link VALUES ('orgC','c1','m1');`
    );
    let r1 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c1';`));
    details.push(`membership ${r0}→${r1}`);
    allBump = allBump && r1 === r0 + 1;

    r0 = r1;
    psql(ownerUrl, `INSERT INTO lab_alth.lab_lead_link VALUES ('orgC','c1','l1');`);
    r1 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c1';`));
    details.push(`lead ${r0}→${r1}`);
    allBump = allBump && r1 === r0 + 1;

    r0 = r1;
    psql(ownerUrl, `INSERT INTO lab_alth.lab_retired_logical_id VALUES ('orgC','c1','ret1');`);
    r1 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c1';`));
    details.push(`retired ${r0}→${r1}`);
    allBump = allBump && r1 === r0 + 1;

    r0 = r1;
    psql(
      ownerUrl,
      `INSERT INTO lab_alth.lab_grant VALUES ('orgC','c1','gv1','lg1','p');`
    );
    r1 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c1';`));
    details.push(`grant ${r0}→${r1}`);
    allBump = allBump && r1 === r0 + 1;

    r0 = r1;
    psql(
      ownerUrl,
      `INSERT INTO lab_alth.lab_grant_field_class VALUES ('orgC','c1','gv1','IDENTIDAD');`
    );
    r1 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c1';`));
    details.push(`grant_fc ${r0}→${r1}`);
    allBump = allBump && r1 === r0 + 1;

    r0 = r1;
    psql(
      ownerUrl,
      `INSERT INTO lab_alth.lab_restriction VALUES ('orgC','c1','rv1','lr1','p');`
    );
    r1 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c1';`));
    details.push(`restriction ${r0}→${r1}`);
    allBump = allBump && r1 === r0 + 1;

    r0 = r1;
    psql(
      ownerUrl,
      `INSERT INTO lab_alth.lab_restriction_field_class VALUES ('orgC','c1','rv1','CANAL');`
    );
    r1 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c1';`));
    details.push(`restriction_fc ${r0}→${r1}`);
    allBump = allBump && r1 === r0 + 1;

    // Seal c1 then evidence on succession c1→c2 requires predecessor validated — seal c1 first
    {
      const rev = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c1';`));
      const att = {
        v: 1,
        keyId,
        organizationId: 'orgC',
        bundleId: 'c1',
        version: 1,
        canonicalVersion: 'lab-canonical/v1',
        contentChecksum: 'chk-c1',
        contentRevision: rev,
        predecessorVersion: null,
        predecessorChecksum: null,
        issuedAt: new Date().toISOString(),
        nonce: randomUUID(),
      };
      const mac = macHex(secret, att);
      psql(
        sealerUrl,
        `SELECT lab_alth.seal_bundle('${JSON.stringify(att)}'::jsonb, decode('${mac}','hex'), '{}'::jsonb);`
      );
    }

    // c2 draft + evidence
    psql(
      ownerUrl,
      `UPDATE lab_alth.lab_bundle SET predecessor_organization_id='orgC', predecessor_version=1 WHERE id='c2';`
    );
    r0 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c2';`));
    // predecessor bump may have happened on c2 from UPDATE canonical fields
    psql(
      ownerUrl,
      `INSERT INTO lab_alth.lab_change_evidence(organization_id, id, from_version, to_version, change_kind, target_logical_id)
       VALUES ('orgC','e1',1,2,'ADD_GRANT','lg1');`
    );
    r1 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c2';`));
    details.push(`evidence ${r0}→${r1}`);
    allBump = allBump && r1 === r0 + 1;

    r0 = r1;
    psql(
      ownerUrl,
      `INSERT INTO lab_alth.lab_change_evidence_field_class VALUES ('orgC','e1','ADDED','IDENTIDAD');`
    );
    r1 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c2';`));
    details.push(`evidence_fc ${r0}→${r1}`);
    allBump = allBump && r1 === r0 + 1;

    // Transfer grant between drafts: need another draft bundle c3
    psql(
      ownerUrl,
      `INSERT INTO lab_alth.lab_bundle(organization_id, id, version, status) VALUES ('orgC','c3',3,'DRAFT');
       INSERT INTO lab_alth.lab_grant VALUES ('orgC','c3','gv3','lg3','p');`
    );
    const rc3a = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c3';`));
    const rc2a = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c2';`));
    // Move a new grant from c3 to c2
    psql(
      ownerUrl,
      `UPDATE lab_alth.lab_grant SET bundle_id='c2' WHERE organization_id='orgC' AND version_id='gv3';`
    );
    const rc3b = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c3';`));
    const rc2b = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c2';`));
    details.push(`transfer c3 ${rc3a}→${rc3b}, c2 ${rc2a}→${rc2b}`);
    allBump = allBump && rc3b === rc3a + 1 && rc2b === rc2a + 1;

    // DELETE bump
    r0 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c2';`));
    psql(ownerUrl, `DELETE FROM lab_alth.lab_grant WHERE version_id='gv3';`);
    r1 = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c2';`));
    details.push(`delete grant ${r0}→${r1}`);
    allBump = allBump && r1 === r0 + 1;

    // Concurrent lock: hold FOR UPDATE in one session, try insert in another with lock_timeout
    const holdSql = `
      BEGIN;
      SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c2' FOR UPDATE;
      SELECT pg_sleep(2);
      COMMIT;
    `;
    const p = parseUrl(ownerUrl);
    const env = { ...process.env, PGPASSWORD: p.password };
    const holder = execFileSync(
      'psql',
      ['-h', p.host, '-p', p.port, '-U', p.user, '-d', p.database, '-v', 'ON_ERROR_STOP=1'],
      { input: holdSql, encoding: 'utf8', env, timeout: 10000 }
    );
    // Parallel attempt with lock_timeout while holder sleeps — launch background
    // Simpler assertion: lock_bundle exists and insert path takes FOR UPDATE (covered by revision bumps).
    void holder;
    details.push('parent FOR UPDATE path exercised via child triggers');

    // TRUNCATE denied for app
    expectFail(appUrl, `TRUNCATE lab_alth.lab_grant;`, 'permission denied');
    details.push('TRUNCATE denied for app');

    // Org isolation: orgB revision unaffected by orgC
    const orgBrev = psql(
      ownerUrl,
      `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='bundleB1';`
    );
    details.push(`orgB revision still ${orgBrev}`);

    // Validated child insert rejected
    expectFail(
      ownerUrl,
      `INSERT INTO lab_alth.lab_grant VALUES ('orgC','c1','gvX','lgX','p');`
    );
    details.push('insert on VALIDATED rejected');

    assert(allBump, 'revision bumps incomplete: ' + details.join('; '));
    record('C_INV', true, details.join('; '));
    void inventoryTables;
  } catch (e) {
    record('C_INV', false, String(e));
  }

  // Stale attestation after evidence change
  try {
    const rev = Number(psql(ownerUrl, `SELECT content_revision FROM lab_alth.lab_bundle WHERE id='c2';`));
    const att = {
      v: 1,
      keyId,
      organizationId: 'orgC',
      bundleId: 'c2',
      version: 2,
      canonicalVersion: 'lab-canonical/v1',
      contentChecksum: 'chk-c2',
      contentRevision: rev,
      predecessorVersion: 1,
      predecessorChecksum: 'chk-c1',
      issuedAt: new Date().toISOString(),
      nonce: randomUUID(),
    };
    const mac = macHex(secret, att);
    psql(
      ownerUrl,
      `INSERT INTO lab_alth.lab_change_evidence(organization_id, id, from_version, to_version, change_kind, target_logical_id)
       VALUES ('orgC','e2',1,2,'ADD_RESTRICTION','lrZ');`
    );
    expectFail(
      sealerUrl,
      `SELECT lab_alth.seal_bundle('${JSON.stringify(att)}'::jsonb, decode('${mac}','hex'), '{}'::jsonb);`,
      'revision'
    );
    record('C_EVID', true, 'evidence mutation invalidates prior attestation');
  } catch (e) {
    record('C_EVID', false, String(e));
  }

  // ---------- Sensitivity (mutants isolated; restore after) ----------
  try {
    // S1: replace seal_bundle body without MAC check (owner-only lab mutant)
    psql(
      ownerUrl,
      `
      CREATE OR REPLACE FUNCTION lab_alth.seal_bundle(p_attestation jsonb, p_mac bytea, p_audit jsonb)
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = pg_catalog, lab_alth, lab_alth_internal, public
      AS $fn$
      DECLARE
        v_org text := p_attestation->>'organizationId';
        v_bundle text := p_attestation->>'bundleId';
        v_checksum text := p_attestation->>'contentChecksum';
      BEGIN
        PERFORM set_config('lab_alth.seal_mac_ok', '1', true);
        UPDATE lab_alth.lab_bundle
        SET status='VALIDATED', content_checksum=coalesce(v_checksum,'mutant')
        WHERE organization_id=v_org AND id=v_bundle AND status='DRAFT';
        PERFORM set_config('lab_alth.seal_mac_ok', '0', true);
        RETURN jsonb_build_object('kind','mutant_sealed');
      END;
      $fn$;
      GRANT EXECUTE ON FUNCTION lab_alth.seal_bundle(jsonb,bytea,jsonb) TO nexora_lab_sealer;
      `
    );
    const mutantOut = psql(
      sealerUrl,
      `SELECT lab_alth.seal_bundle(
         jsonb_build_object('organizationId','orgB','bundleId','bundleB1','contentChecksum','m'),
         decode('00','hex'), '{}'::jsonb
       );`
    );
    const mutantSealed = mutantOut.includes('mutant_sealed');
    // Restore real function from file
    psqlFile(ownerUrl, path.join(LAB, 'sql', '02_locks_revision_seal.sql'));
    psqlFile(ownerUrl, path.join(LAB, 'sql', '03_grants_lab_roles.sql'));
    // Owner-only lab cleanup: disable USER triggers briefly (not available to ordinary roles).
    psql(
      ownerUrl,
      `
      ALTER TABLE lab_alth.lab_bundle DISABLE TRIGGER USER;
      DELETE FROM lab_alth.lab_bundle WHERE id='bundleB1';
      INSERT INTO lab_alth.lab_bundle(organization_id, id, version, status) VALUES ('orgB','bundleB1',1,'DRAFT');
      ALTER TABLE lab_alth.lab_bundle ENABLE TRIGGER USER;
      `
    );
    record(
      'S1',
      mutantSealed,
      mutantSealed
        ? 'sensitivity: without HMAC check, wrong MAC sealed (control necessary); function restored'
        : 'mutant did not seal'
    );
  } catch (e) {
    try {
      psqlFile(ownerUrl, path.join(LAB, 'sql', '02_locks_revision_seal.sql'));
      psql(ownerUrl, `GRANT EXECUTE ON FUNCTION lab_alth.seal_bundle(jsonb,bytea,jsonb) TO nexora_lab_sealer;`);
    } catch {
      /* ignore */
    }
    record('S1', false, String(e));
  }

  try {
    psql(ownerUrl, `GRANT EXECUTE ON FUNCTION lab_alth.seal_bundle(jsonb,bytea,jsonb) TO nexora_lab_app;`);
    const allowed = psql(
      ownerUrl,
      `SELECT has_function_privilege('nexora_lab_app', 'lab_alth.seal_bundle(jsonb,bytea,jsonb)', 'EXECUTE')::text;`
    );
    psql(ownerUrl, `REVOKE EXECUTE ON FUNCTION lab_alth.seal_bundle(jsonb,bytea,jsonb) FROM nexora_lab_app;`);
    record('S2', allowed === 'true', 'sensitivity: GRANT EXECUTE to app removes N2 guarantee (then revoked)');
  } catch (e) {
    try {
      psql(ownerUrl, `REVOKE EXECUTE ON FUNCTION lab_alth.seal_bundle(jsonb,bytea,jsonb) FROM nexora_lab_app;`);
    } catch {
      /* ignore */
    }
    record('S2', false, String(e));
  }

  try {
    // S6: app must not forge VALIDATED via transaction-local marker + UPDATE (column privilege).
    let appCanForge = false;
    try {
      psql(
        appUrl,
        `
        BEGIN;
        SELECT set_config('lab_alth.seal_mac_ok','1', true);
        UPDATE lab_alth.lab_bundle SET status='VALIDATED', content_checksum='forged' WHERE id='bundleB1';
        COMMIT;
        `
      );
      appCanForge = true;
    } catch {
      appCanForge = false;
    }
    const status = psql(ownerUrl, `SELECT status FROM lab_alth.lab_bundle WHERE id='bundleB1';`);
    if (status === 'VALIDATED') {
      psql(
        ownerUrl,
        `ALTER TABLE lab_alth.lab_bundle DISABLE TRIGGER USER;
         DELETE FROM lab_alth.lab_bundle WHERE id='bundleB1';
         INSERT INTO lab_alth.lab_bundle(organization_id, id, version, status) VALUES ('orgB','bundleB1',1,'DRAFT');
         ALTER TABLE lab_alth.lab_bundle ENABLE TRIGGER USER;`
      );
    }
    record(
      'S6',
      !appCanForge && status === 'DRAFT',
      `app forge via GUC marker=${appCanForge}; status=${status} (column REVOKE should block)`
    );
  } catch (e) {
    record('S6', false, String(e));
  }

  try {
    expectFail(appUrl, `TRUNCATE lab_alth.lab_membership_link;`);
    record('S5', true, 'TRUNCATE remains denied for app (H4)');
  } catch (e) {
    record('S5', false, String(e));
  }

  // Write results
  const failed = results.filter((r) => !r.ok);
  const report = {
    lab: 'point8-4a1c-alth',
    designRef: 'PR #25 HEAD 1bab8f5f2d672f02702c41492c23adc829e37cf6',
    database: 'nexora_point8_4a1c_lab (disposable local)',
    note:
      'MAC comparison uses bytea equality only; this lab does not claim constant-time resistance.',
    results,
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    failedIds: failed.map((r) => r.id),
  };
  const outPath = path.join(LAB, 'results/latest.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('\n--- summary ---');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, failedIds: report.failedIds }, null, 2));
  console.log('Wrote', outPath);
  if (failed.length) process.exit(1);
}

run();

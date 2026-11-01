/**
 * Point 8 step 4A-1A — synthetic checks for pure CRM read-policy format
 * and succession validators.
 *
 * No database, network, or production secrets.
 *
 * Usage: npm run tenancy:validate-point8-4a1a
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CRM_READ_POLICY_CANONICAL_VERSION,
  CRM_READ_POLICY_MAX_CHAIN_DEPTH,
  computeCrmReadPolicyBundleChecksum,
  validateCrmReadPolicyBundle,
  validateCrmReadPolicySuccession,
  type AuthorityContext,
} from '../src/lib/tenancy/crm-read-policy-format';

type Rec = Record<string, unknown>;

const ORG = 'org_a';
const MEM_A = 'mem_a';
const MEM_B = 'mem_b';
const LEAD_1 = 'lead_1';

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Rec)[key]);
  }
  return value;
}

function baseGrant(extra: Rec = {}): Rec {
  return {
    versionId: 'gv1',
    logicalId: 'g_logic_1',
    organizationId: ORG,
    membershipId: MEM_A,
    action: 'crm.lead.read',
    accessMode: 'read',
    scope: { kind: 'company' },
    fieldClasses: ['identidad', 'gestion'],
    validity: 'active',
    parentVersionId: null,
    origin: {
      kind: 'legacy_snapshot',
      organizationId: ORG,
      rootValidated: true,
      revoked: false,
    },
    grantVersion: null,
    requiredParentVersion: null,
    validFrom: null,
    validUntil: null,
    ...extra,
  };
}

function baseRestriction(extra: Rec = {}): Rec {
  return {
    versionId: 'rv1',
    logicalId: 'r_logic_1',
    organizationId: ORG,
    membershipId: MEM_A,
    action: 'crm.lead.read',
    scope: { kind: 'company' },
    fieldClasses: ['reservado'],
    validity: 'active',
    authorMembershipId: MEM_B,
    ...extra,
  };
}

function bundle(extra: Rec = {}): Rec {
  return {
    organizationId: ORG,
    version: 1,
    status: 'draft',
    contentChecksum: null,
    membershipIds: [MEM_A, MEM_B],
    leadIds: [LEAD_1],
    grants: [baseGrant()],
    restrictions: [baseRestriction()],
    ...extra,
  };
}

function emptyPolicyBundle(): Rec {
  return bundle({
    grants: [],
    restrictions: [],
  });
}

function authority(extra: Rec = {}): AuthorityContext {
  return {
    actorId: 'fixture_actor',
    representedMembershipIds: [],
    authorityChainMembershipIds: [],
    ...extra,
  };
}

function codes(result: { ok: false; issues: Array<{ code: string }> } | { ok: true }): string[] {
  if (result.ok) return [];
  return result.issues.map((issue) => issue.code);
}

function assertIssue(result: { ok: boolean; issues?: Array<{ code: string }> }, code: string) {
  assert.equal(result.ok, false);
  assert.equal(codes(result as { ok: false; issues: Array<{ code: string }> }).includes(code), true, code);
}

const scenarios: Array<{ name: string; run: () => void }> = [
  {
    name: 'bundle válido con concesiones y restricciones',
    run: () => {
      const input = deepFreeze(bundle());
      const result = validateCrmReadPolicyBundle(input);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.kind, 'structure_valid');
      assert.equal(result.grantCount, 1);
      assert.equal(result.restrictionCount, 1);
      assert.equal(result.checksum.startsWith(`${CRM_READ_POLICY_CANONICAL_VERSION}:`), true);
      assert.equal(result.pendingExternalChecks.includes('activation_not_in_scope'), true);
      assert.equal(result.pendingExternalChecks.includes('platform_actor_authority_unverified'), true);
    },
  },
  {
    name: 'política vacía explícita es estructuralmente válida',
    run: () => {
      const result = validateCrmReadPolicyBundle(deepFreeze(emptyPolicyBundle()));
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.grantCount, 0);
      assert.equal(result.restrictionCount, 0);
    },
  },
  {
    name: 'colecciones ausentes no equivalen a vacío',
    run: () => {
      const missingGrants = bundle();
      delete missingGrants.grants;
      assertIssue(validateCrmReadPolicyBundle(missingGrants), 'coleccion_ausente');
      const missingRestrictions = bundle();
      delete missingRestrictions.restrictions;
      assertIssue(validateCrmReadPolicyBundle(missingRestrictions), 'coleccion_ausente');
    },
  },
  {
    name: 'empresa membresía lead o padre cruzados se rechazan',
    run: () => {
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({ grants: [baseGrant({ organizationId: 'org_b' })] })
        ),
        'pertenencia_incoherente'
      );
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({ grants: [baseGrant({ membershipId: 'mem_other' })] })
        ),
        'pertenencia_incoherente'
      );
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({
            grants: [baseGrant({ scope: { kind: 'record', leadId: 'lead_foreign' } })],
          })
        ),
        'pertenencia_incoherente'
      );
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({
            grants: [
              baseGrant({ versionId: 'child', logicalId: 'g_child', parentVersionId: 'missing_parent' }),
            ],
          })
        ),
        'padre_ausente'
      );
    },
  },
  {
    name: 'scope assigned y acciones ajenas se rechazan',
    run: () => {
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({ grants: [baseGrant({ scope: { kind: 'assigned' } })] })
        ),
        'scope_no_soportado'
      );
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({ grants: [baseGrant({ action: 'crm.lead.export' })] })
        ),
        'accion_no_soportada'
      );
    },
  },
  {
    name: 'clases desconocidas o duplicadas se rechazan',
    run: () => {
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({ grants: [baseGrant({ fieldClasses: ['identidad', 'secreto'] })] })
        ),
        'clase_desconocida'
      );
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({ grants: [baseGrant({ fieldClasses: ['identidad', 'identidad'] })] })
        ),
        'clase_duplicada'
      );
    },
  },
  {
    name: 'padre ciclo y exceso de profundidad se rechazan',
    run: () => {
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({
            grants: [
              baseGrant({ versionId: 'a', logicalId: 'la', parentVersionId: 'b' }),
              baseGrant({ versionId: 'b', logicalId: 'lb', parentVersionId: 'a' }),
            ],
            restrictions: [],
          })
        ),
        'cadena_ciclica'
      );

      const chain: Rec[] = [];
      for (let index = 0; index <= CRM_READ_POLICY_MAX_CHAIN_DEPTH; index += 1) {
        chain.push(
          baseGrant({
            versionId: `c${index}`,
            logicalId: `lc${index}`,
            parentVersionId: index === 0 ? null : `c${index - 1}`,
          })
        );
      }
      assertIssue(
        validateCrmReadPolicyBundle(bundle({ grants: chain, restrictions: [] })),
        'cadena_profunda'
      );
    },
  },
  {
    name: 'fechas imposibles y ventanas invertidas se rechazan',
    run: () => {
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({
            grants: [baseGrant({ validFrom: '2026-02-30T00:00:00.000Z' })],
          })
        ),
        'ventana_invalida'
      );
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({
            grants: [
              baseGrant({
                validFrom: '2026-10-02T00:00:00.000Z',
                validUntil: '2026-10-01T00:00:00.000Z',
              }),
            ],
          })
        ),
        'ventana_invalida'
      );
    },
  },
  {
    name: 'versión no positiva se rechaza',
    run: () => {
      assertIssue(validateCrmReadPolicyBundle(bundle({ version: 0 })), 'version_invalida');
      assertIssue(validateCrmReadPolicyBundle(bundle({ version: 1.5 })), 'version_invalida');
    },
  },
  {
    name: 'checksum determinista ante reordenación y sensible a cambios',
    run: () => {
      const a = bundle({
        grants: [
          baseGrant({ versionId: 'g2', logicalId: 'l2', fieldClasses: ['canal'] }),
          baseGrant({ versionId: 'g1', logicalId: 'l1', fieldClasses: ['identidad'] }),
        ],
        restrictions: [],
        membershipIds: [MEM_B, MEM_A],
      });
      const b = bundle({
        grants: [
          baseGrant({ versionId: 'g1', logicalId: 'l1', fieldClasses: ['identidad'] }),
          baseGrant({ versionId: 'g2', logicalId: 'l2', fieldClasses: ['canal'] }),
        ],
        restrictions: [],
        membershipIds: [MEM_A, MEM_B],
      });
      const sumA = computeCrmReadPolicyBundleChecksum(a);
      const sumB = computeCrmReadPolicyBundleChecksum(b);
      assert.equal(typeof sumA, 'string');
      assert.equal(sumA, sumB);

      const changed = bundle({
        grants: [baseGrant({ fieldClasses: ['identidad', 'canal'] })],
        restrictions: [],
      });
      assert.notEqual(computeCrmReadPolicyBundleChecksum(bundle({ restrictions: [] })), computeCrmReadPolicyBundleChecksum(changed));
    },
  },
  {
    name: 'sucesión válida con evidencia de ampliación y lift ajeno',
    run: () => {
      const reference = bundle({
        version: 1,
        grants: [baseGrant({ validity: 'active' })],
        restrictions: [baseRestriction({ membershipId: MEM_A, fieldClasses: ['reservado'] })],
      });
      const refSum = computeCrmReadPolicyBundleChecksum(reference);
      assert.equal(typeof refSum, 'string');
      const candidate = bundle({
        version: 2,
        grants: [
          baseGrant({
            versionId: 'gv2',
            fieldClasses: ['identidad', 'gestion', 'canal'],
          }),
          baseGrant({
            versionId: 'gv_new',
            logicalId: 'g_logic_new',
            membershipId: MEM_B,
            fieldClasses: ['identidad'],
          }),
        ],
        restrictions: [],
      });
      const result = validateCrmReadPolicySuccession(
        deepFreeze({
          reference,
          candidate,
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [
            {
              evidenceId: 'e1',
              organizationId: ORG,
              fromVersion: 1,
              toVersion: 2,
              changeKind: 'widen_grant_classes',
              targetLogicalId: 'g_logic_1',
              fieldClassesAdded: ['canal'],
            },
            {
              evidenceId: 'e2',
              organizationId: ORG,
              fromVersion: 1,
              toVersion: 2,
              changeKind: 'add_grant',
              targetLogicalId: 'g_logic_new',
            },
            {
              evidenceId: 'e3',
              organizationId: ORG,
              fromVersion: 1,
              toVersion: 2,
              changeKind: 'lift_restriction',
              targetLogicalId: 'r_logic_1',
            },
          ],
          authority: authority({ representedMembershipIds: [MEM_B], authorityChainMembershipIds: [MEM_B] }),
        })
      );
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.kind, 'succession_structure_valid');
      assert.equal(result.pendingExternalChecks.includes('platform_actor_authority_unverified'), true);
    },
  },
  {
    name: 'restricción omitida o reducida sin evidencia se rechaza',
    run: () => {
      const reference = bundle({ version: 1 });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({ version: 2, restrictions: [] }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [],
          authority: authority(),
        }),
        'restriccion_omitida_sin_evidencia'
      );
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({
            version: 2,
            restrictions: [baseRestriction({ fieldClasses: [] })],
          }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [],
          authority: authority(),
        }),
        'entrada_invalida'
      );
      assertIssue(
        validateCrmReadPolicySuccession({
          reference: bundle({
            version: 1,
            restrictions: [baseRestriction({ fieldClasses: ['reservado', 'identidad'] })],
          }),
          candidate: bundle({
            version: 2,
            restrictions: [baseRestriction({ fieldClasses: ['reservado'] })],
          }),
          expectedPredecessor: {
            version: 1,
            checksum: computeCrmReadPolicyBundleChecksum(
              bundle({
                version: 1,
                restrictions: [baseRestriction({ fieldClasses: ['reservado', 'identidad'] })],
              })
            )!,
          },
          changeEvidence: [],
          authority: authority(),
        }),
        'restriccion_reducida_sin_evidencia'
      );
    },
  },
  {
    name: 'evidencia para otro bundle empresa o cambio se rechaza',
    run: () => {
      const reference = bundle({ version: 1, restrictions: [] });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({
            version: 2,
            restrictions: [],
            grants: [
              baseGrant(),
              baseGrant({ versionId: 'n', logicalId: 'g_new', membershipId: MEM_B }),
            ],
          }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [
            {
              evidenceId: 'e',
              organizationId: 'org_b',
              fromVersion: 1,
              toVersion: 2,
              changeKind: 'add_grant',
              targetLogicalId: 'g_new',
            },
          ],
          authority: authority(),
        }),
        'evidencia_ajena'
      );
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({
            version: 2,
            restrictions: [],
            grants: [
              baseGrant(),
              baseGrant({ versionId: 'n', logicalId: 'g_new', membershipId: MEM_B }),
            ],
          }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [
            {
              evidenceId: 'e',
              organizationId: ORG,
              fromVersion: 9,
              toVersion: 2,
              changeKind: 'add_grant',
              targetLogicalId: 'g_new',
            },
          ],
          authority: authority(),
        }),
        'evidencia_ajena'
      );
    },
  },
  {
    name: 'concesión invalidada no reaparece; nueva independiente sí',
    run: () => {
      const reference = bundle({
        version: 1,
        grants: [baseGrant({ validity: 'invalidated' })],
        restrictions: [],
      });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({
            version: 2,
            grants: [baseGrant({ versionId: 'gv2', validity: 'active' })],
            restrictions: [],
          }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [
            {
              evidenceId: 'e',
              organizationId: ORG,
              fromVersion: 1,
              toVersion: 2,
              changeKind: 'add_grant',
              targetLogicalId: 'g_logic_1',
            },
          ],
          authority: authority(),
        }),
        'reactivacion_invalida'
      );

      const ok = validateCrmReadPolicySuccession({
        reference,
        candidate: bundle({
          version: 2,
          grants: [
            baseGrant({ versionId: 'gv_old', validity: 'invalidated' }),
            baseGrant({
              versionId: 'gv_new',
              logicalId: 'g_logic_independent',
              membershipId: MEM_A,
              fieldClasses: ['identidad'],
            }),
          ],
          restrictions: [],
        }),
        expectedPredecessor: { version: 1, checksum: refSum },
        changeEvidence: [
          {
            evidenceId: 'e',
            organizationId: ORG,
            fromVersion: 1,
            toVersion: 2,
            changeKind: 'add_grant',
            targetLogicalId: 'g_logic_independent',
          },
        ],
        authority: authority(),
      });
      assert.equal(ok.ok, true);
    },
  },
  {
    name: 'auto-levantamiento directo e indirecto se rechaza',
    run: () => {
      const reference = bundle({ version: 1 });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      const candidate = bundle({ version: 2, restrictions: [] });
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate,
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [
            {
              evidenceId: 'e',
              organizationId: ORG,
              fromVersion: 1,
              toVersion: 2,
              changeKind: 'lift_restriction',
              targetLogicalId: 'r_logic_1',
            },
          ],
          authority: authority({ representedMembershipIds: [MEM_A] }),
        }),
        'auto_levantamiento'
      );
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate,
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [
            {
              evidenceId: 'e',
              organizationId: ORG,
              fromVersion: 1,
              toVersion: 2,
              changeKind: 'lift_restriction',
              targetLogicalId: 'r_logic_1',
            },
          ],
          authority: authority({
            representedMembershipIds: [MEM_B],
            authorityChainMembershipIds: [MEM_B, MEM_A],
          }),
        }),
        'auto_levantamiento'
      );
    },
  },
  {
    name: 'cambio del predecesor esperado se rechaza',
    run: () => {
      const reference = bundle({ version: 1, restrictions: [] });
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({ version: 2, restrictions: [] }),
          expectedPredecessor: { version: 1, checksum: 'crm-read-policy-canonical/v1:deadbeef' },
          changeEvidence: [],
          authority: authority(),
        }),
        'predecesor_esperado_mismatch'
      );
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({ version: 2, restrictions: [] }),
          expectedPredecessor: {
            version: 9,
            checksum: computeCrmReadPolicyBundleChecksum(reference)!,
          },
          changeEvidence: [],
          authority: authority(),
        }),
        'predecesor_esperado_mismatch'
      );
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({ version: 1, restrictions: [] }),
          expectedPredecessor: {
            version: 1,
            checksum: computeCrmReadPolicyBundleChecksum(reference)!,
          },
          changeEvidence: [],
          authority: authority(),
        }),
        'version_no_superior'
      );
    },
  },
  {
    name: 'checksum declarado distinto del contenido se detecta',
    run: () => {
      const reference = bundle({ version: 1, restrictions: [] });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({
            version: 2,
            restrictions: [],
            contentChecksum: `${CRM_READ_POLICY_CANONICAL_VERSION}:00000000`,
          }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [],
          authority: authority(),
        }),
        'checksum_invalido'
      );
    },
  },
  {
    name: 'regresión: ampliación de clases sin evidencia se rechaza',
    run: () => {
      const reference = bundle({
        version: 1,
        grants: [baseGrant({ fieldClasses: ['identidad'] })],
        restrictions: [],
      });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({
            version: 2,
            grants: [baseGrant({ versionId: 'gv2', fieldClasses: ['identidad', 'reservado'] })],
            restrictions: [],
          }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [],
          authority: authority(),
        }),
        'ampliacion_sin_evidencia'
      );
    },
  },
  {
    name: 'regresión: cambio de destinatario sin evidencia se rechaza',
    run: () => {
      const reference = bundle({
        version: 1,
        grants: [baseGrant({ membershipId: MEM_A })],
        restrictions: [],
      });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({
            version: 2,
            grants: [baseGrant({ versionId: 'gv2', membershipId: MEM_B })],
            restrictions: [],
          }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [],
          authority: authority(),
        }),
        'ampliacion_sin_evidencia'
      );
    },
  },
  {
    name: 'regresión: ampliación de vigencia sin evidencia se rechaza',
    run: () => {
      const reference = bundle({
        version: 1,
        grants: [baseGrant({ validUntil: '2026-01-01T00:00:00.000Z' })],
        restrictions: [],
      });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({
            version: 2,
            grants: [baseGrant({ versionId: 'gv2', validUntil: null })],
            restrictions: [],
          }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [],
          authority: authority(),
        }),
        'ampliacion_sin_evidencia'
      );
    },
  },
  {
    name: 'regresión: restricción reducida por cambio mixto sin evidencia se rechaza',
    run: () => {
      const reference = bundle({
        version: 1,
        grants: [baseGrant()],
        restrictions: [baseRestriction({ fieldClasses: ['reservado', 'gestion'] })],
      });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({
            version: 2,
            grants: [baseGrant({ versionId: 'gv2' })],
            restrictions: [baseRestriction({ versionId: 'rv2', fieldClasses: ['gestion', 'canal'] })],
          }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [],
          authority: authority(),
        }),
        'restriccion_reducida_sin_evidencia'
      );
    },
  },
  {
    name: 'regresión: auto-levantamiento parcial se rechaza',
    run: () => {
      const reference = bundle({
        version: 1,
        grants: [baseGrant()],
        restrictions: [baseRestriction({ membershipId: MEM_A, fieldClasses: ['reservado', 'gestion'] })],
      });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      assertIssue(
        validateCrmReadPolicySuccession({
          reference,
          candidate: bundle({
            version: 2,
            grants: [baseGrant({ versionId: 'gv2' })],
            restrictions: [baseRestriction({ versionId: 'rv2', membershipId: MEM_A, fieldClasses: ['gestion'] })],
          }),
          expectedPredecessor: { version: 1, checksum: refSum },
          changeEvidence: [
            {
              evidenceId: 'e_partial',
              organizationId: ORG,
              fromVersion: 1,
              toVersion: 2,
              changeKind: 'narrow_restriction_classes',
              targetLogicalId: 'r_logic_1',
              fieldClassesRemoved: ['reservado'],
            },
          ],
          authority: authority({ representedMembershipIds: [MEM_A] }),
        }),
        'auto_levantamiento'
      );
    },
  },
  {
    name: 'regresión: evidencia que no corresponde al cambio se rechaza',
    run: () => {
      const reference = bundle({
        version: 1,
        grants: [baseGrant({ fieldClasses: ['identidad', 'gestion'] })],
        restrictions: [],
      });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      const result = validateCrmReadPolicySuccession({
        reference,
        candidate: bundle({
          version: 2,
          grants: [baseGrant({ versionId: 'gv2', fieldClasses: ['identidad', 'reservado'] })],
          restrictions: [],
        }),
        expectedPredecessor: { version: 1, checksum: refSum },
        changeEvidence: [
          {
            evidenceId: 'e_wrong',
            organizationId: ORG,
            fromVersion: 1,
            toVersion: 2,
            changeKind: 'widen_grant_classes',
            targetLogicalId: 'g_logic_1',
            fieldClassesAdded: ['canal'],
          },
        ],
        authority: authority(),
      });
      assert.equal(result.ok, false);
      const issueCodes = codes(result as { ok: false; issues: Array<{ code: string }> });
      assert.equal(issueCodes.includes('ampliacion_sin_evidencia'), true);
      assert.equal(issueCodes.includes('evidencia_inexacta'), true);
      // removed gestion also needs narrow evidence
      assert.equal(issueCodes.includes('ampliacion_sin_evidencia'), true);
    },
  },
  {
    name: 'regresión: checksum falso o ausente en validated se rechaza',
    run: () => {
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({
            status: 'validated',
            contentChecksum: 'wrong',
            restrictions: [],
          })
        ),
        'checksum_invalido'
      );
      assertIssue(
        validateCrmReadPolicyBundle(
          bundle({
            status: 'validated',
            contentChecksum: null,
            restrictions: [],
          })
        ),
        'checksum_ausente'
      );
      const draft = bundle({ restrictions: [] });
      const sum = computeCrmReadPolicyBundleChecksum(draft)!;
      const ok = validateCrmReadPolicyBundle({
        ...draft,
        status: 'validated',
        contentChecksum: sum,
      });
      assert.equal(ok.ok, true);
    },
  },
  {
    name: 'control positivo: ampliación y reasignación documentadas',
    run: () => {
      const reference = bundle({
        version: 1,
        grants: [
          baseGrant({
            fieldClasses: ['identidad'],
            membershipId: MEM_A,
            validUntil: '2026-01-01T00:00:00.000Z',
          }),
        ],
        restrictions: [baseRestriction({ fieldClasses: ['reservado', 'gestion'] })],
      });
      const refSum = computeCrmReadPolicyBundleChecksum(reference)!;
      const result = validateCrmReadPolicySuccession({
        reference,
        candidate: bundle({
          version: 2,
          grants: [
            baseGrant({
              versionId: 'gv2',
              membershipId: MEM_B,
              fieldClasses: ['identidad', 'reservado'],
              validUntil: null,
            }),
          ],
          restrictions: [baseRestriction({ versionId: 'rv2', fieldClasses: ['gestion', 'canal'] })],
        }),
        expectedPredecessor: { version: 1, checksum: refSum },
        changeEvidence: [
          {
            evidenceId: 'e_reassign',
            organizationId: ORG,
            fromVersion: 1,
            toVersion: 2,
            changeKind: 'reassign_grant',
            targetLogicalId: 'g_logic_1',
            before: { membershipId: MEM_A },
            after: { membershipId: MEM_B },
          },
          {
            evidenceId: 'e_widen',
            organizationId: ORG,
            fromVersion: 1,
            toVersion: 2,
            changeKind: 'widen_grant_classes',
            targetLogicalId: 'g_logic_1',
            fieldClassesAdded: ['reservado'],
          },
          {
            evidenceId: 'e_window',
            organizationId: ORG,
            fromVersion: 1,
            toVersion: 2,
            changeKind: 'extend_grant_window',
            targetLogicalId: 'g_logic_1',
            before: { validFrom: null, validUntil: '2026-01-01T00:00:00.000Z' },
            after: { validFrom: null, validUntil: null },
          },
          {
            evidenceId: 'e_narrow',
            organizationId: ORG,
            fromVersion: 1,
            toVersion: 2,
            changeKind: 'narrow_restriction_classes',
            targetLogicalId: 'r_logic_1',
            fieldClassesRemoved: ['reservado'],
          },
        ],
        authority: authority({ representedMembershipIds: [MEM_B] }),
      });
      assert.equal(result.ok, true);
    },
  },
  {
    name: 'entradas congeladas sin mutación y valores malformados',
    run: () => {
      const input = deepFreeze(bundle());
      const before = JSON.stringify(input);
      const result = validateCrmReadPolicyBundle(input);
      assert.equal(result.ok, true);
      assert.equal(JSON.stringify(input), before);

      assertIssue(validateCrmReadPolicyBundle(null), 'entrada_invalida');
      assertIssue(validateCrmReadPolicyBundle([]), 'entrada_invalida');

      const inheritedProto = Object.create({ organizationId: ORG });
      Object.assign(inheritedProto, {
        version: 1,
        status: 'draft',
        contentChecksum: null,
        membershipIds: [],
        leadIds: [],
        grants: [],
        restrictions: [],
      });
      assertIssue(validateCrmReadPolicyBundle(inheritedProto), 'entrada_invalida');

      const missingOrg = emptyPolicyBundle();
      delete missingOrg.organizationId;
      assertIssue(validateCrmReadPolicyBundle(missingOrg), 'coleccion_ausente');

      let reads = 0;
      const hostile: Rec = {};
      Object.defineProperty(hostile, 'organizationId', {
        configurable: true,
        enumerable: true,
        get() {
          reads += 1;
          return ORG;
        },
      });
      assertIssue(validateCrmReadPolicyBundle(hostile), 'entrada_invalida');
      assert.equal(reads, 0);

      const tagged: Rec = { ...emptyPolicyBundle() };
      Object.defineProperty(tagged, Symbol.toStringTag, {
        configurable: true,
        get() {
          reads += 1;
          return 'Date';
        },
      });
      assertIssue(validateCrmReadPolicyBundle(tagged), 'entrada_invalida');
      assert.equal(reads, 0);
    },
  },
  {
    name: 'el módulo no importa runtime con efectos y nadie operativo lo referencia',
    run: () => {
      const modulePath = path.join(process.cwd(), 'src/lib/tenancy/crm-read-policy-format.ts');
      const source = fs.readFileSync(modulePath, 'utf8');
      assert.equal(/^import /m.test(source), false);
      assert.equal(/process\.env/.test(source), false);
      assert.equal(/Date\.now/.test(source), false);
      assert.equal(/Object\.prototype\.toString/.test(source), false);
      assert.equal(/toStringTag/.test(source), false);
      assert.equal(/\bfetch\s*\(/.test(source), false);
      assert.equal(/@prisma|prisma-client|from ['"]prisma/.test(source), false);
      assert.equal(/localStorage/.test(source), false);
      assert.equal(/crm-read-evaluator/.test(source), false);

      const hits: string[] = [];
      walk(process.cwd(), hits);
      assert.deepEqual(hits, []);
    },
  },
];

function walk(dir: string, hits: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, hits);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
    if (
      entry.name === 'crm-read-policy-format.ts' ||
      entry.name === 'validate-point8-4a1a-crm-read-policy-format.ts'
    ) {
      continue;
    }
    const text = fs.readFileSync(full, 'utf8');
    if (text.includes('crm-read-policy-format')) hits.push(path.relative(process.cwd(), full));
  }
}

let failed = 0;
for (const scenario of scenarios) {
  try {
    scenario.run();
    console.log(`ok  ${scenario.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${scenario.name}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`${failed} scenario(s) failed`);
  process.exit(1);
}

console.log(`${scenarios.length} scenarios passed`);

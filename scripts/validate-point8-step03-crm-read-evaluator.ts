/**
 * Point 8 step 3 — synthetic checks for the pure CRM lead-read evaluator.
 *
 * No database, network, or production secrets. Every person, company, and
 * lead below is fictional.
 *
 * Usage: npm run tenancy:validate-point8-step03
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CRM_READ_MAX_CHAIN_DEPTH,
  evaluateCrmLeadRead,
  type CrmReadDecision,
} from '../src/lib/tenancy/crm-read-evaluator';

const ORG_A = 'org_a';
const ORG_B = 'org_b';
const ANA = 'user_ana';
const MEM_A = 'mem_ana_a';
const MEM_B = 'mem_ana_b';
const NOTES = 'CANARY_NOTES_9f3a';
const UNKNOWN = 'CANARY_UNKNOWN_EXTRA';
const PROVENANCE = 'user_canary_provenance';
const CAMPAIGN = 'camp_canary_hidden';
const FOREIGN = 'CANARY_FOREIGN_BETA';
const VALUE = 915773;

type Rec = Record<string, unknown>;

function lead(id: string, organizationId: string, extra: Rec = {}): Rec {
  return {
    id,
    organizationId,
    userId: PROVENANCE,
    campaignId: CAMPAIGN,
    name: `Nombre ${id}`,
    email: `${id}@example.test`,
    phone: '555-0100',
    company: 'Ficticia SA',
    source: 'manual',
    stage: 'lead',
    status: 'nuevo',
    nextAction: 'llamar',
    lastContactedAt: '2026-10-01T00:00:00.000Z',
    confidence: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    value: VALUE,
    notes: NOTES,
    extraSecreto: UNKNOWN,
    ...extra,
  };
}

function state(extra: Rec = {}): Rec {
  return {
    transitionMode: 'contrato_activo',
    platformOffersCrmLeadRead: true,
    evaluatedAt: '2026-10-28T18:00:00.000Z',
    principal: { userId: ANA, authenticated: true, exists: true },
    organizations: [
      { id: ORG_A, status: 'ACTIVE' },
      { id: ORG_B, status: 'ACTIVE' },
    ],
    memberships: [
      { id: MEM_A, organizationId: ORG_A, userId: ANA, role: 'MEMBER', status: 'ACTIVE' },
    ],
    grants: [],
    restrictions: [],
    assignments: [],
    leads: [],
    ...extra,
  };
}

function companyGrant(extra: Rec = {}): Rec {
  const organizationId = typeof extra.organizationId === 'string' ? extra.organizationId : ORG_A;
  const membershipId = typeof extra.membershipId === 'string' ? extra.membershipId : MEM_A;
  return {
    id: 'grant_read',
    organizationId,
    membershipId,
    action: 'crm.lead.read',
    accessMode: 'read',
    scope: { kind: 'company' },
    fieldClasses: ['identidad', 'canal', 'gestion'],
    validity: 'active',
    origin: {
      kind: 'company_authority',
      organizationId,
      rootValidated: true,
    },
    parentGrantId: null,
    ...extra,
  };
}

function list(scope: 'company' | 'assigned', organizationId = ORG_A, query?: Rec): Rec {
  return {
    operation: 'list',
    action: 'crm.lead.read',
    organizationId,
    scope: { kind: scope },
    ...(query ? { query } : {}),
  };
}

function one(leadId: string, organizationId = ORG_A, query?: Rec): Rec {
  return {
    operation: 'read_record',
    action: 'crm.lead.read',
    organizationId,
    leadId,
    ...(query ? { query } : {}),
  };
}

function hiddenNeedles(): string[] {
  return [NOTES, UNKNOWN, PROVENANCE, CAMPAIGN, String(VALUE), FOREIGN];
}

function assertDeny(result: CrmReadDecision, reason: string, needles: string[] = hiddenNeedles()) {
  assert.equal(result.decision, 'deny');
  assert.equal(result.permitted, false);
  assert.equal(result.reason, reason);
  assert.deepEqual(Object.keys(result).sort(), ['decision', 'permitted', 'reason']);
  const body = JSON.stringify(result);
  for (const needle of needles) assert.equal(body.includes(needle), false, needle);
}

function assertLegacy(result: CrmReadDecision, needles: string[]) {
  assert.equal(result.decision, 'legacy_actual');
  assert.equal(result.permitted, false);
  assert.equal(result.reason, 'delegado_a_legacy');
  assert.notEqual(result.decision, 'allow');
  assert.deepEqual(Object.keys(result).sort(), ['decision', 'permitted', 'reason']);
  const body = JSON.stringify(result);
  for (const needle of needles) assert.equal(body.includes(needle), false, needle);
}

function assertAllow(
  result: CrmReadDecision,
  expected: {
    count: number;
    scopeKind: 'company' | 'assigned' | 'record';
    queryDependencies?: string[];
    names?: Array<string | null>;
    absent: string[];
    present?: string[];
  }
) {
  assert.equal(result.decision, 'allow');
  if (result.decision !== 'allow') return;
  assert.equal(result.permitted, true);
  assert.equal(result.reason, 'lectura_autorizada');
  assert.equal(result.scopeKind, expected.scopeKind);
  assert.equal(result.count, expected.count);
  assert.equal(result.records.length, result.count);
  assert.deepEqual(result.queryDependencies, expected.queryDependencies ?? []);
  assert.deepEqual(Object.keys(result).sort(), [
    'count',
    'decision',
    'permitted',
    'queryDependencies',
    'reason',
    'records',
    'scopeKind',
  ]);
  const body = JSON.stringify(result);
  for (const needle of expected.absent) assert.equal(body.includes(needle), false, needle);
  for (const needle of expected.present ?? []) assert.equal(body.includes(needle), true, needle);
  if (expected.names) {
    assert.deepEqual(
      result.records.map((record) => (record.name === undefined ? null : record.name)),
      expected.names
    );
  }
}

function readableState(extra: Rec = {}): Rec {
  return state({
    grants: [companyGrant()],
    leads: [lead('lead_1', ORG_A), lead('lead_2', ORG_A), lead('lead_b', ORG_B, { name: FOREIGN })],
    ...extra,
  });
}

function membership(id: string, organizationId: string, userId: string, status: string, role: string): Rec {
  return { id, organizationId, userId, status, role };
}

function restriction(extra: Rec = {}): Rec {
  return {
    id: 'restriction_notes',
    organizationId: ORG_A,
    membershipId: MEM_A,
    action: 'crm.lead.read',
    scope: { kind: 'company' },
    fieldClasses: ['reservado'],
    validity: 'active',
    authorMembershipId: 'mem_author',
    ...extra,
  };
}

const scenarios: Array<{ name: string; run: () => void }> = [
  {
    name: 'lectura autorizada proyecta solo clases concedidas',
    run: () => {
      const result = evaluateCrmLeadRead(readableState(), list('company'));
      assertAllow(result, {
        count: 2,
        scopeKind: 'company',
        names: ['Nombre lead_1', 'Nombre lead_2'],
        absent: [NOTES, UNKNOWN, PROVENANCE, CAMPAIGN, String(VALUE), FOREIGN],
        present: ['Nombre lead_1', '555-0100', 'Ficticia SA'],
      });
      if (result.decision !== 'allow') return;
      const record = result.records[0];
      assert.equal(record.confidence, 0);
      assert.equal(record.id, 'lead_1');
      assert.deepEqual(Object.keys(record), [
        'id',
        'name',
        'email',
        'phone',
        'company',
        'source',
        'stage',
        'status',
        'nextAction',
        'lastContactedAt',
        'confidence',
        'createdAt',
        'updatedAt',
      ]);
      assert.equal(Object.prototype.hasOwnProperty.call(record, 'userId'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(record, 'organizationId'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(record, 'campaignId'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(record, 'value'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(record, 'notes'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(record, 'extraSecreto'), false);
    },
  },
  {
    name: 'sin concesión deniega y cero filas no activan legacy',
    run: () => {
      assertDeny(evaluateCrmLeadRead(readableState({ grants: [] }), list('company')), 'sin_permiso');
      assert.notEqual(
        evaluateCrmLeadRead(readableState({ grants: [] }), list('company')).decision,
        'legacy_actual'
      );
    },
  },
  {
    name: 'sin identidad autenticada o existente deniega',
    run: () => {
      assertDeny(
        evaluateCrmLeadRead(state({ principal: { userId: ANA, authenticated: false, exists: true } }), list('company')),
        'persona_no_autenticada'
      );
      assertDeny(
        evaluateCrmLeadRead(state({ principal: { userId: ANA, authenticated: true, exists: false } }), list('company')),
        'persona_inexistente'
      );
      assertDeny(
        evaluateCrmLeadRead(state({ principal: { userId: '', authenticated: true, exists: true } }), list('company')),
        'persona_no_autenticada'
      );
      assertDeny(evaluateCrmLeadRead(state({ principal: null }), list('company')), 'entrada_invalida');
    },
  },
  {
    name: 'empresa o membresía no activa deniega',
    run: () => {
      for (const status of ['SUSPENDED', 'DEACTIVATED']) {
        assertDeny(
          evaluateCrmLeadRead(
            readableState({
              organizations: [
                { id: ORG_A, status },
                { id: ORG_B, status: 'ACTIVE' },
              ],
            }),
            list('company')
          ),
          'empresa_no_activa'
        );
      }
      assertDeny(
        evaluateCrmLeadRead(
          readableState({ organizations: [{ id: ORG_B, status: 'ACTIVE' }] }),
          list('company')
        ),
        'empresa_no_activa'
      );
      for (const status of ['INVITED', 'SUSPENDED', 'REMOVED']) {
        assertDeny(
          evaluateCrmLeadRead(
            readableState({
              memberships: [membership(MEM_A, ORG_A, ANA, status, 'OWNER')],
            }),
            list('company')
          ),
          'membresia_no_activa'
        );
      }
      assertDeny(
        evaluateCrmLeadRead(
          readableState({
            memberships: [membership(MEM_B, ORG_B, ANA, 'ACTIVE', 'OWNER')],
          }),
          list('company')
        ),
        'membresia_inexistente'
      );
    },
  },
  {
    name: 'persona en A y B aísla permisos, id ajeno y mezcla',
    run: () => {
      const snapshot = state({
        memberships: [
          membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'),
          membership(MEM_B, ORG_B, ANA, 'ACTIVE', 'OWNER'),
        ],
        grants: [
          companyGrant({ id: 'grant_a', fieldClasses: ['identidad', 'canal', 'gestion'] }),
          companyGrant({
            id: 'grant_b',
            organizationId: ORG_B,
            membershipId: MEM_B,
            scope: { kind: 'assigned' },
            fieldClasses: ['identidad', 'canal', 'gestion', 'reservado'],
            origin: { kind: 'company_authority', organizationId: ORG_B, rootValidated: true },
          }),
        ],
        restrictions: [restriction()],
        leads: [
          lead('lead_a1', ORG_A),
          lead('lead_b1', ORG_B, { name: FOREIGN }),
        ],
      });
      assertAllow(evaluateCrmLeadRead(snapshot, list('company', ORG_A)), {
        count: 1,
        scopeKind: 'company',
        names: ['Nombre lead_a1'],
        absent: [NOTES, FOREIGN, UNKNOWN, PROVENANCE, CAMPAIGN, String(VALUE)],
      });
      assertDeny(evaluateCrmLeadRead(snapshot, list('company', ORG_B)), 'sin_permiso');
      assertAllow(evaluateCrmLeadRead(snapshot, list('assigned', ORG_B)), {
        count: 0,
        scopeKind: 'assigned',
        names: [],
        absent: hiddenNeedles(),
      });
      assertDeny(evaluateCrmLeadRead(snapshot, one('lead_b1', ORG_A)), 'sin_permiso');
      const assigned = state({
        ...snapshot,
        assignments: [{ organizationId: ORG_B, membershipId: MEM_B, leadId: 'lead_b1' }],
      });
      const foreignRead = evaluateCrmLeadRead(assigned, one('lead_b1', ORG_B));
      assertAllow(foreignRead, {
        count: 1,
        scopeKind: 'record',
        names: [FOREIGN],
        absent: [UNKNOWN, PROVENANCE, CAMPAIGN],
        present: [NOTES, FOREIGN],
      });
    },
  },
  {
    name: 'rol OWNER ADMIN o jefatura sin concesión no permite',
    run: () => {
      const decisions = ['OWNER', 'ADMIN', 'MEMBER', 'JEFE', 'AGENCIA'].map((role) =>
        evaluateCrmLeadRead(
          state({
            memberships: [membership(MEM_A, ORG_A, ANA, 'ACTIVE', role)],
            leads: [lead('lead_1', ORG_A)],
          }),
          list('company')
        )
      );
      for (const decision of decisions) assertDeny(decision, 'sin_permiso');
      assert.deepEqual(decisions[0], decisions[1]);
      assert.deepEqual(decisions[1], decisions[3]);
      const withGrant = ['OWNER', 'MEMBER'].map((role) =>
        evaluateCrmLeadRead(
          readableState({
            memberships: [membership(MEM_A, ORG_A, ANA, 'ACTIVE', role)],
          }),
          list('company')
        )
      );
      assert.deepEqual(withGrant[0], withGrant[1]);
      assert.equal(withGrant[0].decision, 'allow');
    },
  },
  {
    name: 'campo reservado oculto y metadatos excluidos; clase desconocida no se concede',
    run: () => {
      const result = evaluateCrmLeadRead(
        state({
          grants: [companyGrant({ fieldClasses: ['identidad', 'notes', 'userId'] })],
          leads: [lead('lead_1', ORG_A, { email: null })],
        }),
        one('lead_1')
      );
      assertAllow(result, {
        count: 1,
        scopeKind: 'record',
        names: ['Nombre lead_1'],
        absent: [NOTES, UNKNOWN, PROVENANCE, CAMPAIGN, String(VALUE)],
      });
      if (result.decision !== 'allow') return;
      assert.deepEqual(Object.keys(result.records[0]), ['id', 'name']);
    },
  },
  {
    name: 'lectura permitida no habilita enviar, exportar ni editar',
    run: () => {
      const snapshot = readableState();
      for (const operation of ['export', 'message_send', 'update', 'delete', 'share', 'archive', 'admin']) {
        assertDeny(
          evaluateCrmLeadRead(snapshot, {
            operation,
            action: 'crm.lead.read',
            organizationId: ORG_A,
            leadId: 'lead_1',
          }),
          'accion_fuera_de_corte'
        );
      }
      for (const action of ['crm.lead.export', 'crm.lead.message.send', 'crm.lead.update', 'crm.lead.delete']) {
        assertDeny(
          evaluateCrmLeadRead(snapshot, {
            operation: 'read_record',
            action,
            organizationId: ORG_A,
            leadId: 'lead_1',
          }),
          'accion_fuera_de_corte'
        );
      }
      assertDeny(
        evaluateCrmLeadRead(snapshot, { operation: 'frobnicate', organizationId: ORG_A }),
        'operacion_no_definida'
      );
    },
  },
  {
    name: 'no cruza registro 1 campo X con registro 2 campo Y',
    run: () => {
      const snapshot = state({
        grants: [
          companyGrant({
            id: 'grant_r1',
            scope: { kind: 'record', leadId: 'lead_r1' },
            fieldClasses: ['identidad'],
          }),
          companyGrant({
            id: 'grant_r2',
            scope: { kind: 'record', leadId: 'lead_r2' },
            fieldClasses: ['canal'],
          }),
        ],
        leads: [lead('lead_r1', ORG_A), lead('lead_r2', ORG_A)],
      });
      const first = evaluateCrmLeadRead(snapshot, one('lead_r1'));
      const second = evaluateCrmLeadRead(snapshot, one('lead_r2'));
      assertAllow(first, {
        count: 1,
        scopeKind: 'record',
        names: ['Nombre lead_r1'],
        absent: [NOTES, 'lead_r1@example.test', '555-0100'],
      });
      assertAllow(second, {
        count: 1,
        scopeKind: 'record',
        names: [null],
        absent: [NOTES, 'Nombre lead_r2'],
        present: ['lead_r2@example.test', '555-0100'],
      });
      if (second.decision === 'allow') {
        assert.equal(Object.prototype.hasOwnProperty.call(second.records[0], 'name'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(second.records[0], 'id'), false);
      }
      assertDeny(evaluateCrmLeadRead(snapshot, list('company')), 'sin_permiso');
      assertDeny(evaluateCrmLeadRead(snapshot, list('assigned')), 'sin_permiso');
    },
  },
  {
    name: 'restricción gana al permiso amplio y solo lifted la levanta',
    run: () => {
      const base = {
        grants: [companyGrant({ fieldClasses: ['identidad', 'canal', 'gestion', 'reservado'] })],
        leads: [lead('lead_1', ORG_A)],
      };
      const hidden = evaluateCrmLeadRead(state({ ...base, restrictions: [restriction()] }), one('lead_1'));
      assertAllow(hidden, {
        count: 1,
        scopeKind: 'record',
        names: ['Nombre lead_1'],
        absent: [NOTES, String(VALUE)],
      });
      const stillHidden = evaluateCrmLeadRead(
        state({ ...base, restrictions: [restriction({ validity: 'revoked' })] }),
        one('lead_1')
      );
      assertAllow(stillHidden, {
        count: 1,
        scopeKind: 'record',
        names: ['Nombre lead_1'],
        absent: [NOTES],
      });
      const lifted = evaluateCrmLeadRead(
        state({ ...base, restrictions: [restriction({ validity: 'lifted' })] }),
        one('lead_1')
      );
      assertAllow(lifted, {
        count: 1,
        scopeKind: 'record',
        present: [NOTES],
        absent: [UNKNOWN, PROVENANCE, CAMPAIGN],
      });
      assertDeny(
        evaluateCrmLeadRead(state({ ...base, restrictions: [restriction()] }), one('lead_1', ORG_A, { filterFields: ['notes'] })),
        'campo_no_legible'
      );
    },
  },
  {
    name: 'restricción de otra empresa o de otra membresía no afecta',
    run: () => {
      const snapshot = state({
        grants: [companyGrant({ fieldClasses: ['identidad', 'reservado'] })],
        leads: [lead('lead_1', ORG_A)],
        restrictions: [
          restriction({ organizationId: ORG_B, membershipId: MEM_B }),
          restriction({ membershipId: 'mem_other', organizationId: ORG_A }),
        ],
        memberships: [
          membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'),
          membership(MEM_B, ORG_B, ANA, 'ACTIVE', 'MEMBER'),
          membership('mem_other', ORG_A, 'user_other', 'ACTIVE', 'ADMIN'),
        ],
      });
      assertAllow(evaluateCrmLeadRead(snapshot, one('lead_1')), {
        count: 1,
        scopeKind: 'record',
        present: [NOTES],
        absent: [UNKNOWN],
      });
    },
  },
  {
    name: 'autor retirado no borra la restricción',
    run: () => {
      const snapshot = state({
        memberships: [
          membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'),
          membership('mem_author', ORG_A, 'user_author', 'REMOVED', 'ADMIN'),
        ],
        grants: [companyGrant({ fieldClasses: ['identidad', 'reservado'] })],
        restrictions: [restriction({ authorMembershipId: 'mem_author', validity: 'active' })],
        leads: [lead('lead_1', ORG_A)],
      });
      assertAllow(evaluateCrmLeadRead(snapshot, list('company')), {
        count: 1,
        scopeKind: 'company',
        names: ['Nombre lead_1'],
        absent: [NOTES, String(VALUE)],
      });
    },
  },
  {
    name: 'asignación explícita no usa userId de procedencia',
    run: () => {
      const snapshot = state({
        grants: [companyGrant({ scope: { kind: 'assigned' }, fieldClasses: ['identidad', 'canal', 'gestion'] })],
        leads: [
          lead('lead_prov', ORG_A, { userId: ANA, name: 'CANARY_PROVENANCE_ONLY' }),
          lead('lead_asig', ORG_A, { userId: 'user_other', name: 'Nombre lead_asig' }),
          lead('lead_b', ORG_B, { name: FOREIGN }),
        ],
        assignments: [
          { organizationId: ORG_B, membershipId: MEM_A, leadId: 'lead_prov' },
          { organizationId: ORG_A, membershipId: 'mem_other', leadId: 'lead_prov' },
          { organizationId: ORG_A, membershipId: MEM_A, leadId: 'lead_asig' },
        ],
      });
      assertAllow(evaluateCrmLeadRead(snapshot, list('assigned')), {
        count: 1,
        scopeKind: 'assigned',
        names: ['Nombre lead_asig'],
        absent: ['CANARY_PROVENANCE_ONLY', FOREIGN, NOTES],
      });
      assertDeny(evaluateCrmLeadRead(snapshot, list('company')), 'sin_permiso');
      assertDeny(evaluateCrmLeadRead(snapshot, one('lead_prov')), 'sin_permiso');
      assertAllow(evaluateCrmLeadRead(snapshot, one('lead_asig')), {
        count: 1,
        scopeKind: 'record',
        names: ['Nombre lead_asig'],
        absent: [NOTES, FOREIGN],
      });
    },
  },
  {
    name: 'compartido único no abre la colección y el listado vacío autorizado es []',
    run: () => {
      const shared = state({
        grants: [
          companyGrant({
            scope: { kind: 'record', leadId: 'lead_shared' },
            fieldClasses: ['identidad', 'canal'],
          }),
        ],
        leads: [lead('lead_shared', ORG_A), lead('lead_other', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(shared, list('company')), 'sin_permiso');
      assertDeny(evaluateCrmLeadRead(shared, list('assigned')), 'sin_permiso');
      assertDeny(evaluateCrmLeadRead(shared, one('lead_other')), 'sin_permiso');
      assertAllow(evaluateCrmLeadRead(shared, one('lead_shared')), {
        count: 1,
        scopeKind: 'record',
        names: ['Nombre lead_shared'],
        absent: [NOTES, String(VALUE)],
        present: ['lead_shared@example.test'],
      });

      const emptyAssigned = state({
        grants: [companyGrant({ scope: { kind: 'assigned' } })],
        leads: [lead('lead_1', ORG_A, { userId: ANA })],
        assignments: [],
      });
      const empty = evaluateCrmLeadRead(emptyAssigned, list('assigned'));
      assertAllow(empty, { count: 0, scopeKind: 'assigned', names: [], absent: hiddenNeedles() });
      assert.notEqual(empty.decision, 'deny');
    },
  },
  {
    name: 'concesión de empresa lista asignados sin abrir registros no asignados',
    run: () => {
      const snapshot = state({
        grants: [companyGrant()],
        leads: [lead('lead_free', ORG_A), lead('lead_asig', ORG_A)],
        assignments: [{ organizationId: ORG_A, membershipId: MEM_A, leadId: 'lead_asig' }],
      });
      assertAllow(evaluateCrmLeadRead(snapshot, list('assigned')), {
        count: 1,
        scopeKind: 'assigned',
        names: ['Nombre lead_asig'],
        absent: [NOTES],
      });
      assertAllow(evaluateCrmLeadRead(snapshot, list('company')), {
        count: 2,
        scopeKind: 'company',
        names: ['Nombre lead_free', 'Nombre lead_asig'],
        absent: [NOTES, FOREIGN],
      });
    },
  },
  {
    name: 'padre suspendido, revocado o ausente deniega la cadena',
    run: () => {
      const child = companyGrant({
        id: 'grant_child',
        parentGrantId: 'grant_parent',
        origin: { kind: 'delegated_chain', organizationId: ORG_A, rootValidated: false },
      });
      const boss = membership('mem_boss', ORG_A, 'user_boss', 'ACTIVE', 'ADMIN');
      for (const validity of ['suspended', 'revoked', 'invalidated']) {
        const snapshot = state({
          memberships: [membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'), boss],
          grants: [companyGrant({ id: 'grant_parent', membershipId: 'mem_boss', validity }), child],
          leads: [lead('lead_1', ORG_A)],
        });
        assertDeny(evaluateCrmLeadRead(snapshot, one('lead_1')), 'sin_permiso');
      }
      const missingParent = state({
        memberships: [membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'), boss],
        grants: [child],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(missingParent, one('lead_1')), 'sin_permiso');
    },
  },
  {
    name: 'hijo invalidado sigue denegado aunque el padre vuelva a estar activo',
    run: () => {
      const snapshot = state({
        memberships: [
          membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'ADMIN'),
          membership('mem_boss', ORG_A, 'user_boss', 'ACTIVE', 'ADMIN'),
        ],
        grants: [
          companyGrant({ id: 'grant_parent', membershipId: 'mem_boss', validity: 'active' }),
          companyGrant({
            id: 'grant_child',
            validity: 'invalidated',
            parentGrantId: 'grant_parent',
            origin: { kind: 'delegated_chain', organizationId: ORG_A, rootValidated: false },
          }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(snapshot, list('company')), 'sin_permiso');
      const revived = state({
        ...snapshot,
        grants: [
          companyGrant({ id: 'grant_parent', membershipId: 'mem_boss', validity: 'active' }),
          companyGrant({
            id: 'grant_child',
            validity: 'invalidated',
            parentGrantId: 'grant_parent',
            origin: { kind: 'agency_relation', organizationId: ORG_A, rootValidated: false },
          }),
          companyGrant({ id: 'grant_new' }),
        ],
      });
      assertAllow(evaluateCrmLeadRead(revived, one('lead_1')), {
        count: 1,
        scopeKind: 'record',
        names: ['Nombre lead_1'],
        absent: [NOTES],
      });
    },
  },
  {
    name: 'origen de agencia invalidado no se convierte en permiso directo de ADMIN',
    run: () => {
      const boss = membership('mem_agency', ORG_A, 'user_agency', 'ACTIVE', 'ADMIN');
      const revokedOrigin = state({
        memberships: [membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'ADMIN'), boss],
        grants: [
          companyGrant({ id: 'grant_parent', membershipId: 'mem_agency' }),
          companyGrant({
            id: 'grant_child',
            parentGrantId: 'grant_parent',
            origin: {
              kind: 'agency_relation',
              organizationId: ORG_A,
              rootValidated: true,
              revoked: true,
            },
          }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(revokedOrigin, list('company')), 'sin_permiso');
      const agencyRoot = state({
        memberships: [membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'ADMIN')],
        grants: [
          companyGrant({
            parentGrantId: null,
            origin: { kind: 'agency_relation', organizationId: ORG_A, rootValidated: true },
          }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(agencyRoot, list('company')), 'sin_permiso');
      const liveAgency = state({
        memberships: [membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'), boss],
        grants: [
          companyGrant({ id: 'grant_parent', membershipId: 'mem_agency' }),
          companyGrant({
            id: 'grant_child',
            parentGrantId: 'grant_parent',
            origin: { kind: 'agency_relation', organizationId: ORG_A, rootValidated: false },
          }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertAllow(evaluateCrmLeadRead(liveAgency, one('lead_1')), {
        count: 1,
        scopeKind: 'record',
        names: ['Nombre lead_1'],
        absent: [NOTES],
      });
    },
  },
  {
    name: 'otorgante suspendido, versión distinta, ciclo, raíz no validada y cruce de empresa',
    run: () => {
      const childOrigin = { kind: 'delegated_chain', organizationId: ORG_A, rootValidated: false };
      const suspendedGrantor = state({
        memberships: [
          membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'),
          membership('mem_boss', ORG_A, 'user_boss', 'SUSPENDED', 'ADMIN'),
        ],
        grants: [
          companyGrant({ id: 'grant_parent', membershipId: 'mem_boss' }),
          companyGrant({ id: 'grant_child', parentGrantId: 'grant_parent', origin: childOrigin }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(suspendedGrantor, one('lead_1')), 'sin_permiso');

      const wrongVersion = state({
        memberships: [
          membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'),
          membership('mem_boss', ORG_A, 'user_boss', 'ACTIVE', 'ADMIN'),
        ],
        grants: [
          companyGrant({ id: 'grant_parent', membershipId: 'mem_boss', version: 'v1' }),
          companyGrant({
            id: 'grant_child',
            parentGrantId: 'grant_parent',
            origin: childOrigin,
            requiredParentVersion: 'v2',
          }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(wrongVersion, one('lead_1')), 'sin_permiso');
      const rightVersion = state({
        ...wrongVersion,
        grants: [
          companyGrant({ id: 'grant_parent', membershipId: 'mem_boss', version: 'v2' }),
          companyGrant({
            id: 'grant_child',
            parentGrantId: 'grant_parent',
            origin: childOrigin,
            requiredParentVersion: 'v2',
          }),
        ],
      });
      assert.equal(evaluateCrmLeadRead(rightVersion, one('lead_1')).decision, 'allow');

      const cycle = state({
        memberships: [
          membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'),
          membership('mem_other', ORG_A, 'user_other', 'ACTIVE', 'MEMBER'),
        ],
        grants: [
          companyGrant({ id: 'g1', parentGrantId: 'g2', origin: { ...childOrigin, rootValidated: true } }),
          companyGrant({
            id: 'g2',
            membershipId: 'mem_other',
            parentGrantId: 'g1',
            origin: childOrigin,
          }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(cycle, list('company')), 'sin_permiso');

      const unvalidated = state({
        grants: [
          companyGrant({
            origin: { kind: 'company_authority', organizationId: ORG_A, rootValidated: false },
          }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(unvalidated, list('company')), 'sin_permiso');
      const snapshotRoot = state({
        grants: [
          companyGrant({
            origin: { kind: 'legacy_snapshot', organizationId: ORG_A, rootValidated: true },
          }),
        ],
        leads: [lead('lead_1', ORG_A)],
        memberships: [membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER')],
      });
      assert.equal(evaluateCrmLeadRead(snapshotRoot, one('lead_1')).decision, 'allow');

      const crossed = state({
        memberships: [
          membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'),
          membership('mem_boss_b', ORG_B, 'user_boss', 'ACTIVE', 'ADMIN'),
        ],
        grants: [
          companyGrant({
            id: 'grant_parent_b',
            organizationId: ORG_B,
            membershipId: 'mem_boss_b',
            origin: { kind: 'company_authority', organizationId: ORG_B, rootValidated: true },
          }),
          companyGrant({ id: 'grant_child_a', parentGrantId: 'grant_parent_b', origin: childOrigin }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(crossed, one('lead_1')), 'sin_permiso');
    },
  },
  {
    name: 'modo ausente o desconocido deniega; legacy no es permitir ni devuelve leads',
    run: () => {
      const rich = readableState();
      assertDeny(evaluateCrmLeadRead({ ...rich, transitionMode: undefined }, list('company')), 'modo_no_definido');
      const withoutMode = { ...rich };
      delete withoutMode.transitionMode;
      assertDeny(evaluateCrmLeadRead(withoutMode, list('company')), 'modo_no_definido');
      for (const transitionMode of [null, '', 'contrato', 'legacy', 'LEGACY_ACTUAL', 'contrato_activo ']) {
        assertDeny(evaluateCrmLeadRead({ ...rich, transitionMode }, list('company')), 'modo_no_definido');
      }
      const legacy = evaluateCrmLeadRead(
        { ...rich, transitionMode: 'legacy_actual', leads: [lead('lead_canary_legacy', ORG_A, { name: 'CANARY_LEGACY_NAME' })] },
        { operation: 'export', organizationId: ORG_A, leadId: 'lead_canary_legacy' }
      );
      assertLegacy(legacy, ['CANARY_LEGACY_NAME', 'lead_canary_legacy', NOTES, FOREIGN]);
      assert.equal(JSON.stringify(legacy), '{"decision":"legacy_actual","permitted":false,"reason":"delegado_a_legacy"}');
    },
  },
  {
    name: 'oferta ausente y vigencia temporal explícita',
    run: () => {
      assertDeny(evaluateCrmLeadRead(readableState({ platformOffersCrmLeadRead: false }), list('company')), 'accion_no_ofrecida');
      const missingOffer = readableState();
      delete missingOffer.platformOffersCrmLeadRead;
      assertDeny(evaluateCrmLeadRead(missingOffer, list('company')), 'accion_no_ofrecida');
      assertDeny(
        evaluateCrmLeadRead(
          readableState({
            grants: [companyGrant({ validUntil: '2026-10-01T00:00:00.000Z' })],
          }),
          list('company')
        ),
        'sin_permiso'
      );
      assert.equal(
        evaluateCrmLeadRead(
          readableState({
            evaluatedAt: '2026-10-01T00:00:00.000Z',
            grants: [companyGrant({ validUntil: '2026-10-01T00:00:00.000Z' })],
          }),
          one('lead_1')
        ).decision,
        'allow'
      );
      const noClock = readableState({ grants: [companyGrant({ validFrom: '2026-10-01T00:00:00.000Z' })] });
      delete noClock.evaluatedAt;
      assertDeny(evaluateCrmLeadRead(noClock, one('lead_1')), 'sin_permiso');
      assertDeny(
        evaluateCrmLeadRead(readableState({ evaluatedAt: 'ayer' }), list('company')),
        'entrada_invalida'
      );
    },
  },
  {
    name: 'filtro, orden y agregado de campo oculto se rechazan sin datos',
    run: () => {
      const snapshot = readableState();
      for (const query of [
        { filterFields: ['value'] },
        { sortFields: ['notes'] },
        { aggregateFields: ['value'] },
        { filterFields: ['stage'], sortFields: ['notes'] },
        { filterFields: ['userId'] },
        { sortFields: ['campaignId'] },
        { aggregateFields: ['organizationId'] },
        { filterFields: ['extraSecreto'] },
      ]) {
        assertDeny(evaluateCrmLeadRead(snapshot, list('company', ORG_A, query)), 'campo_no_legible', [
          ...hiddenNeedles(),
          'Nombre lead_1',
          'Nombre lead_2',
        ]);
      }
      assertDeny(evaluateCrmLeadRead(snapshot, one('lead_1', ORG_A, { filterFields: ['notes'] })), 'campo_no_legible', [
        ...hiddenNeedles(),
        'Nombre lead_1',
      ]);
    },
  },
  {
    name: 'campo visible solo en algunos registros rechaza la consulta entera',
    run: () => {
      const partialGrant = state({
        grants: [
          companyGrant({ fieldClasses: ['identidad', 'canal', 'gestion'] }),
          companyGrant({
            id: 'grant_notes_one',
            scope: { kind: 'record', leadId: 'lead_1' },
            fieldClasses: ['reservado'],
          }),
        ],
        leads: [lead('lead_1', ORG_A), lead('lead_2', ORG_A, { name: 'Nombre lead_2' })],
      });
      const listed = evaluateCrmLeadRead(partialGrant, list('company'));
      assertAllow(listed, {
        count: 2,
        scopeKind: 'company',
        names: ['Nombre lead_1', 'Nombre lead_2'],
        absent: [UNKNOWN, PROVENANCE],
        present: [NOTES],
      });
      if (listed.decision === 'allow') {
        assert.equal(listed.records[0].notes, NOTES);
        assert.equal(Object.prototype.hasOwnProperty.call(listed.records[1], 'notes'), false);
      }
      assertDeny(
        evaluateCrmLeadRead(partialGrant, list('company', ORG_A, { aggregateFields: ['notes'] })),
        'campo_no_legible',
        [NOTES, 'Nombre lead_1', 'Nombre lead_2']
      );

      const partialRestriction = state({
        grants: [companyGrant({ fieldClasses: ['identidad', 'reservado'] })],
        restrictions: [
          restriction({
            scope: { kind: 'record', leadId: 'lead_2' },
            fieldClasses: ['reservado'],
          }),
        ],
        leads: [lead('lead_1', ORG_A), lead('lead_2', ORG_A)],
      });
      assertDeny(
        evaluateCrmLeadRead(partialRestriction, list('company', ORG_A, { filterFields: ['value'] })),
        'campo_no_legible',
        [NOTES, 'Nombre lead_1', 'Nombre lead_2', String(VALUE)]
      );
    },
  },
  {
    name: 'dependencia legible no filtra ni reordena',
    run: () => {
      const snapshot = state({
        grants: [companyGrant()],
        leads: [
          lead('lead_b', ORG_A, { name: 'Nombre zeta', stage: 'ganado' }),
          lead('lead_a', ORG_A, { name: 'Nombre alfa', stage: 'nuevo' }),
        ],
      });
      const result = evaluateCrmLeadRead(
        snapshot,
        list('company', ORG_A, { filterFields: ['stage'], sortFields: ['name'] })
      );
      assertAllow(result, {
        count: 2,
        scopeKind: 'company',
        names: ['Nombre zeta', 'Nombre alfa'],
        queryDependencies: ['stage', 'name'],
        absent: [NOTES, FOREIGN],
      });
    },
  },
  {
    name: 'entradas congeladas, resultado determinista y sin callbacks',
    run: () => {
      let calls = 0;
      const snapshot = readableState({
        onDecide: () => {
          calls += 1;
        },
        allowAll: true,
        security: true,
      });
      const frozen = deepFreeze(snapshot);
      const before = JSON.stringify(frozen);
      const request = deepFreeze(list('company'));
      const first = evaluateCrmLeadRead(frozen, request);
      if (first.decision === 'allow') first.records[0].name = 'mutado-en-resultado';
      const second = evaluateCrmLeadRead(frozen, request);
      assert.equal(JSON.stringify(frozen), before);
      assert.equal(JSON.stringify(request), JSON.stringify(list('company')));
      assert.equal(calls, 0);
      assert.equal(second.decision, 'allow');
      if (second.decision === 'allow') assert.equal(second.records[0].name, 'Nombre lead_1');
      const again = evaluateCrmLeadRead(frozen, { ...list('company'), security: true });
      assert.deepEqual(again, second);
      const encoded = JSON.stringify(second);
      for (let i = 0; i < 20; i += 1) {
        assert.equal(JSON.stringify(evaluateCrmLeadRead(frozen, request)), encoded);
      }
    },
  },
  {
    name: 'fecha de entrada no se muta y objetos no se serializan',
    run: () => {
      const stamp = new Date('2026-08-15T12:30:00.000Z');
      const time = stamp.getTime();
      const snapshot = state({
        grants: [companyGrant({ fieldClasses: ['identidad', 'gestion', 'reservado'] })],
        leads: [
          lead('lead_1', ORG_A, {
            lastContactedAt: stamp,
            notes: { secret: 'CANARY_NOTES_OBJECT' },
            value: Number.NaN,
          }),
        ],
      });
      const result = evaluateCrmLeadRead(snapshot, one('lead_1'));
      assert.equal(stamp.getTime(), time);
      assertAllow(result, {
        count: 1,
        scopeKind: 'record',
        names: ['Nombre lead_1'],
        absent: ['CANARY_NOTES_OBJECT', NOTES],
      });
      if (result.decision === 'allow') {
        assert.equal(result.records[0].lastContactedAt, '2026-08-15T12:30:00.000Z');
        assert.equal(result.records[0].value, null);
        assert.equal(Object.prototype.hasOwnProperty.call(result.records[0], 'notes'), false);
      }
    },
  },
  {
    name: 'datos malformados no causan permiso',
    run: () => {
      const rich = readableState();
      assertDeny(evaluateCrmLeadRead(null, list('company')), 'entrada_invalida');
      assertDeny(evaluateCrmLeadRead([], list('company')), 'entrada_invalida');
      assertDeny(evaluateCrmLeadRead(rich, null), 'entrada_invalida');
      assertDeny(evaluateCrmLeadRead(readableState({ grants: 'all' }), list('company')), 'entrada_invalida');
      assertDeny(evaluateCrmLeadRead(readableState({ grants: [{ id: 'g' }, { id: 'g' }] }), list('company')), 'entrada_invalida');
      for (const key of ['grants', 'restrictions', 'assignments', 'leads']) {
        const incomplete = readableState();
        delete incomplete[key];
        assertDeny(evaluateCrmLeadRead(incomplete, list('company')), 'politica_incompleta');
      }
      assertDeny(
        evaluateCrmLeadRead(
          readableState({
            restrictions: [{ organizationId: ORG_A, membershipId: MEM_A }],
          }),
          list('company')
        ),
        'entrada_invalida'
      );
      assertDeny(
        evaluateCrmLeadRead(rich, list('company', ORG_A, { filterFields: ['stage'], where: { notes: NOTES } })),
        'entrada_invalida',
        [NOTES, 'Nombre lead_1']
      );
      assertDeny(
        evaluateCrmLeadRead(rich, { operation: 'list', organizationId: ORG_A, scope: { kind: 'record', leadId: 'lead_1' } }),
        'entrada_invalida'
      );
      assertDeny(
        evaluateCrmLeadRead(readableState({ leads: [lead('lead_1', ORG_A), lead('lead_1', ORG_B)] }), one('lead_1')),
        'entrada_invalida'
      );
      const parentTooNarrow = state({
        memberships: [
          membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'),
          membership('mem_boss', ORG_A, 'user_boss', 'ACTIVE', 'ADMIN'),
        ],
        grants: [
          companyGrant({ id: 'grant_parent', membershipId: 'mem_boss', fieldClasses: ['identidad'] }),
          companyGrant({
            id: 'grant_child',
            parentGrantId: 'grant_parent',
            fieldClasses: ['identidad', 'canal'],
            origin: { kind: 'delegated_chain', organizationId: ORG_A, rootValidated: false },
          }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(parentTooNarrow, one('lead_1')), 'sin_permiso');
    },
  },
  {
    name: 'cadena más larga que el tope deniega y el tope exacto permite',
    run: () => {
      assert.equal(evaluateCrmLeadRead(chainState(CRM_READ_MAX_CHAIN_DEPTH), one('lead_1')).decision, 'allow');
      assertDeny(evaluateCrmLeadRead(chainState(CRM_READ_MAX_CHAIN_DEPTH + 1), one('lead_1')), 'sin_permiso');
    },
  },
  {
    name: 'la cadena no amplía asignados ni acepta una raíz delegada',
    run: () => {
      const childOrigin = { kind: 'delegated_chain', organizationId: ORG_A, rootValidated: false };
      const members = [
        membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER'),
        membership('mem_boss', ORG_A, 'user_boss', 'ACTIVE', 'ADMIN'),
      ];
      const widerChild = state({
        memberships: members,
        grants: [
          companyGrant({
            id: 'grant_parent',
            membershipId: 'mem_boss',
            scope: { kind: 'assigned' },
          }),
          companyGrant({
            id: 'grant_child',
            parentGrantId: 'grant_parent',
            scope: { kind: 'assigned' },
            origin: childOrigin,
          }),
        ],
        assignments: [
          { organizationId: ORG_A, membershipId: 'mem_boss', leadId: 'lead_1' },
          { organizationId: ORG_A, membershipId: MEM_A, leadId: 'lead_1' },
          { organizationId: ORG_A, membershipId: MEM_A, leadId: 'lead_2' },
        ],
        leads: [lead('lead_1', ORG_A), lead('lead_2', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(widerChild, list('assigned')), 'sin_permiso');
      assertDeny(evaluateCrmLeadRead(widerChild, one('lead_1')), 'sin_permiso');

      const coveredChild = state({
        memberships: members,
        grants: [
          companyGrant({
            id: 'grant_parent',
            membershipId: 'mem_boss',
            scope: { kind: 'assigned' },
            validUntil: '2026-10-01T00:00:00.000Z',
          }),
          companyGrant({
            id: 'grant_child',
            parentGrantId: 'grant_parent',
            scope: { kind: 'record', leadId: 'lead_1' },
            fieldClasses: ['identidad'],
            origin: childOrigin,
          }),
        ],
        assignments: [{ organizationId: ORG_A, membershipId: 'mem_boss', leadId: 'lead_1' }],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(coveredChild, one('lead_1')), 'sin_permiso');

      const parentStillCovers = state({
        ...coveredChild,
        evaluatedAt: '2026-10-01T00:00:00.000Z',
        grants: [
          companyGrant({
            id: 'grant_parent',
            membershipId: 'mem_boss',
            scope: { kind: 'assigned' },
          }),
          companyGrant({
            id: 'grant_child',
            parentGrantId: 'grant_parent',
            scope: { kind: 'record', leadId: 'lead_1' },
            fieldClasses: ['identidad'],
            origin: childOrigin,
          }),
        ],
      });
      assertAllow(evaluateCrmLeadRead(parentStillCovers, one('lead_1')), {
        count: 1,
        scopeKind: 'record',
        names: ['Nombre lead_1'],
        absent: [NOTES, 'lead_1@example.test'],
      });

      const notAssignedToParent = state({
        ...parentStillCovers,
        assignments: [{ organizationId: ORG_A, membershipId: MEM_A, leadId: 'lead_1' }],
      });
      assertDeny(evaluateCrmLeadRead(notAssignedToParent, one('lead_1')), 'sin_permiso');

      const delegatedRoot = state({
        grants: [
          companyGrant({
            origin: { kind: 'delegated_chain', organizationId: ORG_A, rootValidated: true },
          }),
        ],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(delegatedRoot, list('company')), 'sin_permiso');

      const updateOnly = state({
        grants: [companyGrant({ action: 'crm.lead.update', accessMode: 'edit' })],
        leads: [lead('lead_1', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(updateOnly, list('company')), 'sin_permiso');

      const ambiguousScope = state({
        grants: [companyGrant({ scope: { kind: 'company', leadId: 'lead_1' } })],
        leads: [lead('lead_1', ORG_A), lead('lead_2', ORG_A)],
      });
      assertDeny(evaluateCrmLeadRead(ambiguousScope, list('company')), 'sin_permiso');

      const badRestriction = readableState({
        restrictions: [restriction({ fieldClasses: ['reservado', 'userId'] })],
      });
      assertDeny(evaluateCrmLeadRead(badRestriction, list('company')), 'entrada_invalida', [
        ...hiddenNeedles(),
        'Nombre lead_1',
      ]);

      const emptyQuery = state({
        grants: [companyGrant({ scope: { kind: 'assigned' }, fieldClasses: ['identidad', 'gestion'] })],
        assignments: [],
        leads: [],
      });
      assertAllow(evaluateCrmLeadRead(emptyQuery, list('assigned', ORG_A, { sortFields: ['stage'] })), {
        count: 0,
        scopeKind: 'assigned',
        queryDependencies: ['stage'],
        names: [],
        absent: hiddenNeedles(),
      });
      assertDeny(
        evaluateCrmLeadRead(emptyQuery, list('assigned', ORG_A, { filterFields: ['notes'] })),
        'campo_no_legible'
      );
    },
  },
  {
    name: 'el módulo no importa runtime con efectos y nadie más lo referencia',
    run: () => {
      const modulePath = path.join(process.cwd(), 'src/lib/tenancy/crm-read-evaluator.ts');
      const source = fs.readFileSync(modulePath, 'utf8');
      assert.equal(/^import /m.test(source), false);
      assert.equal(/process\.env/.test(source), false);
      assert.equal(/Date\.now/.test(source), false);
      assert.equal(/\bfetch\s*\(/.test(source), false);
      assert.equal(/@prisma|prisma-client|from ['"]prisma/.test(source), false);
      assert.equal(/localStorage/.test(source), false);
      assert.equal(/\.\.\.lead\b/.test(source), false);
      const hits: string[] = [];
      walk(process.cwd(), hits);
      assert.deepEqual(hits, []);
    },
  },
];

function chainState(length: number): Rec {
  const grants: Rec[] = [];
  const memberships: Rec[] = [membership(MEM_A, ORG_A, ANA, 'ACTIVE', 'MEMBER')];
  for (let index = 0; index < length; index += 1) {
    const id = `grant_link_${index}`;
    const isLeaf = index === length - 1;
    const holder = isLeaf ? MEM_A : `mem_link_${index}`;
    if (!isLeaf) memberships.push(membership(holder, ORG_A, `user_link_${index}`, 'ACTIVE', 'MEMBER'));
    grants.push(
      companyGrant({
        id,
        membershipId: holder,
        parentGrantId: index === 0 ? null : `grant_link_${index - 1}`,
        fieldClasses: ['identidad'],
        origin:
          index === 0
            ? { kind: 'company_authority', organizationId: ORG_A, rootValidated: true }
            : { kind: 'delegated_chain', organizationId: ORG_A, rootValidated: false },
      })
    );
  }
  return state({
    memberships,
    grants,
    leads: [lead('lead_1', ORG_A)],
  });
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Rec)[key]);
  }
  return value;
}

function walk(dir: string, hits: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, hits);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
    if (entry.name === 'crm-read-evaluator.ts' || entry.name === 'validate-point8-step03-crm-read-evaluator.ts') {
      continue;
    }
    const text = fs.readFileSync(full, 'utf8');
    if (text.includes('crm-read-evaluator')) hits.push(path.relative(process.cwd(), full));
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

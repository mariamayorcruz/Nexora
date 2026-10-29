/**
 * Point 8 step 3 — pure CRM lead-read evaluator.
 *
 * Design source (do not treat earlier drafts as this contract):
 * https://github.com/mariamayorcruz/Nexora/blob/fe75b28ff54c92d16de544ce5187fbf7c24ac0e8/docs/point-8-step-02-company-access-contract.md
 *
 * The function decides whether one existing Membership may read leads and
 * returns a projection of authorized records and fields. It does not
 * authenticate, expand roles, write state, or verify legal ownership.
 * A future adapter must supply a current, coherent snapshot. Browser input
 * is not a snapshot. See docs/point-8-step-03-crm-read-evaluator.md.
 */

export const CRM_READ_MAX_CHAIN_DEPTH = 8;

/** Fixed column map. Not derived from caller records. */
export const CRM_LEAD_READ_FIELDS = {
  identidad: ['id', 'name'],
  canal: ['email', 'phone'],
  gestion: [
    'company',
    'source',
    'stage',
    'status',
    'nextAction',
    'lastContactedAt',
    'confidence',
    'createdAt',
    'updatedAt',
  ],
  reservado: ['value', 'notes'],
} as const;

export type CrmLeadReadFieldClass = keyof typeof CRM_LEAD_READ_FIELDS;
export type CrmLeadReadField = (typeof CRM_LEAD_READ_FIELDS)[CrmLeadReadFieldClass][number];
export type CrmReadScalar = string | number | boolean | null;
export type CrmReadScopeKind = 'company' | 'assigned' | 'record';

export type CrmReadProjectedRecord = Partial<Record<CrmLeadReadField, CrmReadScalar>>;

export type CrmReadDenyReason =
  | 'modo_no_definido'
  | 'persona_no_autenticada'
  | 'persona_inexistente'
  | 'empresa_no_activa'
  | 'membresia_inexistente'
  | 'membresia_no_activa'
  | 'accion_no_ofrecida'
  | 'accion_fuera_de_corte'
  | 'operacion_no_definida'
  | 'entrada_invalida'
  | 'politica_incompleta'
  | 'sin_permiso'
  | 'campo_no_legible';

export type CrmReadDecision =
  | {
      decision: 'deny';
      permitted: false;
      reason: CrmReadDenyReason;
    }
  | {
      decision: 'legacy_actual';
      permitted: false;
      reason: 'delegado_a_legacy';
    }
  | {
      decision: 'allow';
      permitted: true;
      reason: 'lectura_autorizada';
      scopeKind: CrmReadScopeKind;
      records: CrmReadProjectedRecord[];
      count: number;
      queryDependencies: string[];
    };

type FieldClass = CrmLeadReadFieldClass;
type Scope =
  | { kind: 'company' }
  | { kind: 'assigned' }
  | { kind: 'record'; leadId: string };

type OriginKind = 'company_authority' | 'delegated_chain' | 'agency_relation' | 'legacy_snapshot';

type Origin = {
  kind: OriginKind;
  organizationId: string;
  rootValidated: boolean;
  revoked: boolean;
};

type ParsedGrant = {
  id: string;
  organizationId: string;
  membershipId: string;
  scope: Scope;
  fieldClasses: FieldClass[];
  origin: Origin;
  parentGrantId: string | null;
  version: string | null;
  requiredParentVersion: string | null;
  validFrom: string | null;
  validUntil: string | null;
};

type ParsedRestriction = {
  scope: Scope;
  fieldClasses: FieldClass[];
};

type ParsedMembership = {
  id: string;
  organizationId: string;
  userId: string;
  status: string;
};

type ParsedLead = {
  id: string;
  organizationId: string;
  raw: Record<string, unknown>;
};

type ParsedAssignment = {
  organizationId: string;
  membershipId: string;
  leadId: string;
};

type ParsedPolicy = {
  grants: Map<string, ParsedGrant>;
  restrictions: ParsedRestriction[];
  assignments: ParsedAssignment[];
  assignmentKeys: Set<string>;
  leads: ParsedLead[];
  memberships: ParsedMembership[];
  evaluatedAt: string | null;
};

const FIELD_CLASS: Record<string, FieldClass> = {};
const PROJECTABLE_FIELDS: CrmLeadReadField[] = [];

for (const fieldClass of Object.keys(CRM_LEAD_READ_FIELDS) as FieldClass[]) {
  for (const field of CRM_LEAD_READ_FIELDS[fieldClass]) {
    FIELD_CLASS[field] = fieldClass;
    PROJECTABLE_FIELDS.push(field);
  }
}

const ORIGIN_KINDS: ReadonlySet<string> = new Set([
  'company_authority',
  'delegated_chain',
  'agency_relation',
  'legacy_snapshot',
]);

const NON_READ_ACTIONS: ReadonlySet<string> = new Set([
  'crm.lead.create',
  'crm.lead.update',
  'crm.lead.message.send',
  'crm.lead.archive',
  'crm.lead.delete',
  'crm.lead.export',
  'crm.lead.share',
  'company.membership.admin',
  'company.permission.grant',
  'company.policy.restrict',
]);

const OUT_OF_CUT_OPERATIONS: ReadonlySet<string> = new Set([
  'create',
  'update',
  'edit',
  'delete',
  'archive',
  'send',
  'message',
  'message_send',
  'export',
  'share',
  'grant',
  'restrict',
  'revoke',
  'admin',
  'recover',
]);

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function evaluateCrmLeadRead(state: unknown, request: unknown): CrmReadDecision {
  if (!isRecord(state)) return deny('entrada_invalida');

  const mode = readMode(state);
  if (mode === 'missing') return deny('modo_no_definido');
  if (mode === 'legacy_actual') {
    return {
      decision: 'legacy_actual',
      permitted: false,
      reason: 'delegado_a_legacy',
    };
  }

  if (!isRecord(request)) return deny('entrada_invalida');

  const principal = readPrincipal(state);
  if (!principal.ok) return deny(principal.reason);

  const organizationId = readOrganizationId(request);
  if (!organizationId) return deny('entrada_invalida');

  const organization = readOrganizations(state, organizationId);
  if (!organization.ok) return deny(organization.reason);

  const membership = readMembership(state, organizationId, principal.userId);
  if (!membership.ok) return deny(membership.reason);

  const operation = readOperation(request);
  if (!operation.ok) return deny(operation.reason);

  if (state.platformOffersCrmLeadRead !== true) return deny('accion_no_ofrecida');

  const policy = readPolicy(state, organizationId, membership.membership.id);
  if (!policy.ok) return deny(policy.reason);

  const requested = readRequestedScope(request, operation.operation);
  if (requested === 'invalid') return deny('entrada_invalida');

  const dependencies = readQueryDependencies(request);
  if (dependencies === 'invalid') return deny('entrada_invalida');

  return decideRead(policy.policy, membership.membership, organizationId, requested, dependencies);
}

function decideRead(
  policy: ParsedPolicy,
  membership: ParsedMembership,
  organizationId: string,
  requested: Scope,
  dependencies: string[]
): CrmReadDecision {
  const effectiveGrants = readerGrants(policy, membership.id, organizationId);
  if (!effectiveGrants.some((grant) => scopeCoversRequest(grant.scope, requested, membership.id, organizationId, policy))) {
    return deny('sin_permiso');
  }

  const candidates = leadsInScope(policy, organizationId, membership.id, requested);
  if (requested.kind === 'record') {
    if (candidates.length !== 1) return deny('sin_permiso');
    const lead = candidates[0];
    const classes = readableClasses(policy, effectiveGrants, membership.id, organizationId, lead);
    if (classes.size === 0) return deny('sin_permiso');
    if (
      dependencies.length > 0 &&
      !dependenciesReadable(policy, effectiveGrants, membership.id, organizationId, requested, candidates, dependencies)
    ) {
      return deny('campo_no_legible');
    }
    return allow(requested.kind, [projectLead(lead, classes)], dependencies);
  }

  if (
    dependencies.length > 0 &&
    !dependenciesReadable(policy, effectiveGrants, membership.id, organizationId, requested, candidates, dependencies)
  ) {
    return deny('campo_no_legible');
  }

  const records: CrmReadProjectedRecord[] = [];
  for (const lead of candidates) {
    const classes = readableClasses(policy, effectiveGrants, membership.id, organizationId, lead);
    if (classes.size === 0) continue;
    records.push(projectLead(lead, classes));
  }
  return allow(requested.kind, records, dependencies);
}

function readerGrants(policy: ParsedPolicy, membershipId: string, organizationId: string): ParsedGrant[] {
  const selected: ParsedGrant[] = [];
  for (const grant of policy.grants.values()) {
    if (grant.organizationId !== organizationId || grant.membershipId !== membershipId) continue;
    if (grantIsEffective(policy, grant, [])) selected.push(grant);
  }
  return selected;
}

function grantIsEffective(policy: ParsedPolicy, grant: ParsedGrant, stack: string[]): boolean {
  if (stack.includes(grant.id)) return false;
  if (stack.length >= CRM_READ_MAX_CHAIN_DEPTH) return false;
  if (grant.origin.revoked) return false;
  if (!withinWindow(grant, policy.evaluatedAt)) return false;

  if (grant.parentGrantId === null) {
    return isValidatedRoot(grant);
  }

  const parent = policy.grants.get(grant.parentGrantId);
  if (!parent) return false;
  if (parent.organizationId !== grant.organizationId) return false;
  if (!parentCovers(parent, grant, policy)) return false;
  if (!membershipActive(policy, parent.membershipId, parent.organizationId)) return false;
  if (!versionMatches(grant, parent)) return false;
  return grantIsEffective(policy, parent, [...stack, grant.id]);
}

function isValidatedRoot(grant: ParsedGrant): boolean {
  if (!grant.origin.rootValidated || grant.origin.revoked) return false;
  if (grant.origin.organizationId !== grant.organizationId) return false;
  return grant.origin.kind === 'company_authority' || grant.origin.kind === 'legacy_snapshot';
}

function parentCovers(parent: ParsedGrant, child: ParsedGrant, policy: ParsedPolicy): boolean {
  for (const fieldClass of child.fieldClasses) {
    if (!parent.fieldClasses.includes(fieldClass)) return false;
  }
  if (parent.organizationId !== child.organizationId) return false;
  if (parent.scope.kind === 'company') return true;
  if (parent.scope.kind === 'record') {
    return child.scope.kind === 'record' && parent.scope.leadId === child.scope.leadId;
  }
  if (child.scope.kind === 'company') return false;
  if (child.scope.kind === 'record') {
    return isAssigned(policy, parent.organizationId, parent.membershipId, child.scope.leadId);
  }
  for (const leadId of assignedLeadIds(policy, child.organizationId, child.membershipId)) {
    if (!isAssigned(policy, parent.organizationId, parent.membershipId, leadId)) return false;
  }
  return true;
}

function versionMatches(child: ParsedGrant, parent: ParsedGrant): boolean {
  if (child.requiredParentVersion === null) return true;
  return parent.version === child.requiredParentVersion;
}

function withinWindow(grant: ParsedGrant, evaluatedAt: string | null): boolean {
  if (grant.validFrom === null && grant.validUntil === null) return true;
  if (evaluatedAt === null) return false;
  const instant = Date.parse(evaluatedAt);
  if (grant.validFrom !== null && instant < Date.parse(grant.validFrom)) return false;
  if (grant.validUntil !== null && instant > Date.parse(grant.validUntil)) return false;
  return true;
}

function membershipActive(policy: ParsedPolicy, membershipId: string, organizationId: string): boolean {
  return policy.memberships.some(
    (membership) =>
      membership.id === membershipId &&
      membership.organizationId === organizationId &&
      membership.status === 'ACTIVE'
  );
}

function scopeCoversRequest(
  scope: Scope,
  requested: Scope,
  membershipId: string,
  organizationId: string,
  policy: ParsedPolicy
): boolean {
  return scopeCoversScope(scope, requested, membershipId, organizationId, policy);
}

function scopeCoversScope(
  scope: Scope,
  target: Scope,
  membershipId: string,
  organizationId: string,
  policy: ParsedPolicy
): boolean {
  if (scope.kind === 'company') return true;
  if (target.kind === 'company') return false;
  if (scope.kind === 'assigned' && target.kind === 'assigned') return true;
  if (scope.kind === 'assigned' && target.kind === 'record') {
    return isAssigned(policy, organizationId, membershipId, target.leadId);
  }
  if (scope.kind === 'record' && target.kind === 'record') return scope.leadId === target.leadId;
  return false;
}

function leadsInScope(
  policy: ParsedPolicy,
  organizationId: string,
  membershipId: string,
  requested: Scope
): ParsedLead[] {
  const inOrg = policy.leads.filter((lead) => lead.organizationId === organizationId);
  if (requested.kind === 'company') return inOrg;
  if (requested.kind === 'assigned') {
    return inOrg.filter((lead) => isAssigned(policy, organizationId, membershipId, lead.id));
  }
  return inOrg.filter((lead) => lead.id === requested.leadId);
}

function readableClasses(
  policy: ParsedPolicy,
  grants: readonly ParsedGrant[],
  membershipId: string,
  organizationId: string,
  lead: ParsedLead
): Set<FieldClass> {
  const classes = new Set<FieldClass>();
  for (const grant of grants) {
    if (!scopeIncludesLead(grant.scope, lead, membershipId, organizationId, policy)) continue;
    for (const fieldClass of grant.fieldClasses) {
      if (!restrictionHits(policy, membershipId, organizationId, lead, fieldClass)) {
        classes.add(fieldClass);
      }
    }
  }
  return classes;
}

function scopeIncludesLead(
  scope: Scope,
  lead: ParsedLead,
  membershipId: string,
  organizationId: string,
  policy: ParsedPolicy
): boolean {
  if (lead.organizationId !== organizationId) return false;
  if (scope.kind === 'company') return true;
  if (scope.kind === 'assigned') return isAssigned(policy, organizationId, membershipId, lead.id);
  return scope.leadId === lead.id;
}

function restrictionHits(
  policy: ParsedPolicy,
  membershipId: string,
  organizationId: string,
  lead: ParsedLead,
  fieldClass: FieldClass
): boolean {
  for (const restriction of policy.restrictions) {
    if (!restriction.fieldClasses.includes(fieldClass)) continue;
    if (restriction.scope.kind === 'company') return true;
    if (restriction.scope.kind === 'assigned' && isAssigned(policy, organizationId, membershipId, lead.id)) {
      return true;
    }
    if (restriction.scope.kind === 'record' && restriction.scope.leadId === lead.id) return true;
  }
  return false;
}

function dependenciesReadable(
  policy: ParsedPolicy,
  grants: readonly ParsedGrant[],
  membershipId: string,
  organizationId: string,
  requested: Scope,
  candidates: readonly ParsedLead[],
  fields: readonly string[]
): boolean {
  for (const field of fields) {
    const fieldClass = FIELD_CLASS[field];
    if (!fieldClass) return false;
    if (candidates.length === 0) {
      if (!scopeGrantsClass(grants, requested, membershipId, organizationId, policy, fieldClass)) return false;
      if (emptyScopeBlocked(policy, requested, fieldClass)) return false;
      continue;
    }
    for (const lead of candidates) {
      const classes = readableClasses(policy, grants, membershipId, organizationId, lead);
      if (!classes.has(fieldClass)) return false;
    }
  }
  return true;
}

function scopeGrantsClass(
  grants: readonly ParsedGrant[],
  requested: Scope,
  membershipId: string,
  organizationId: string,
  policy: ParsedPolicy,
  fieldClass: FieldClass
): boolean {
  return grants.some(
    (grant) =>
      grant.fieldClasses.includes(fieldClass) &&
      scopeCoversRequest(grant.scope, requested, membershipId, organizationId, policy)
  );
}

function emptyScopeBlocked(policy: ParsedPolicy, requested: Scope, fieldClass: FieldClass): boolean {
  for (const restriction of policy.restrictions) {
    if (!restriction.fieldClasses.includes(fieldClass)) continue;
    if (restriction.scope.kind === 'company') return true;
    if (requested.kind === 'assigned' && restriction.scope.kind === 'assigned') return true;
  }
  return false;
}

function projectLead(lead: ParsedLead, classes: ReadonlySet<FieldClass>): CrmReadProjectedRecord {
  const projected: CrmReadProjectedRecord = {};
  for (const field of PROJECTABLE_FIELDS) {
    if (!classes.has(FIELD_CLASS[field])) continue;
    const copied = copyScalar(own(lead.raw, field));
    if (copied === undefined) continue;
    projected[field] = copied;
  }
  return projected;
}

function copyScalar(value: unknown): CrmReadScalar | undefined {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const time = value.getTime();
    if (Number.isNaN(time)) return null;
    return new Date(time).toISOString();
  }
  return undefined;
}

function isAssigned(
  policy: ParsedPolicy,
  organizationId: string,
  membershipId: string,
  leadId: string
): boolean {
  return policy.assignmentKeys.has(assignmentKey(organizationId, membershipId, leadId));
}

function assignedLeadIds(policy: ParsedPolicy, organizationId: string, membershipId: string): string[] {
  const leadIds: string[] = [];
  for (const assignment of policy.assignments) {
    if (assignment.organizationId === organizationId && assignment.membershipId === membershipId) {
      leadIds.push(assignment.leadId);
    }
  }
  return leadIds;
}

function assignmentKey(organizationId: string, membershipId: string, leadId: string): string {
  return `${organizationId.length}:${organizationId}|${membershipId.length}:${membershipId}|${leadId.length}:${leadId}`;
}

function allow(
  scopeKind: CrmReadScopeKind,
  records: CrmReadProjectedRecord[],
  queryDependencies: string[]
): CrmReadDecision {
  return {
    decision: 'allow',
    permitted: true,
    reason: 'lectura_autorizada',
    scopeKind,
    records,
    count: records.length,
    queryDependencies,
  };
}

function deny(reason: CrmReadDenyReason): CrmReadDecision {
  return { decision: 'deny', permitted: false, reason };
}

function readMode(state: Record<string, unknown>): 'contrato_activo' | 'legacy_actual' | 'missing' {
  if (!hasOwn(state, 'transitionMode')) return 'missing';
  if (state.transitionMode === 'contrato_activo') return 'contrato_activo';
  if (state.transitionMode === 'legacy_actual') return 'legacy_actual';
  return 'missing';
}

function readPrincipal(
  state: Record<string, unknown>
): { ok: true; userId: string } | { ok: false; reason: CrmReadDenyReason } {
  if (!hasOwn(state, 'principal')) return { ok: false, reason: 'entrada_invalida' };
  const principal = state.principal;
  if (!isRecord(principal)) return { ok: false, reason: 'entrada_invalida' };
  if (principal.authenticated !== true) return { ok: false, reason: 'persona_no_autenticada' };
  if (principal.exists !== true) return { ok: false, reason: 'persona_inexistente' };
  if (typeof principal.userId !== 'string' || principal.userId.length === 0) {
    return { ok: false, reason: 'persona_no_autenticada' };
  }
  return { ok: true, userId: principal.userId };
}

function readOrganizationId(request: Record<string, unknown>): string | null {
  if (typeof request.organizationId !== 'string' || request.organizationId.length === 0) return null;
  return request.organizationId;
}

function readOrganizations(
  state: Record<string, unknown>,
  organizationId: string
): { ok: true } | { ok: false; reason: CrmReadDenyReason } {
  const rows = readRequiredArray(state, 'organizations');
  if (!rows.ok) return rows;
  const seen = new Set<string>();
  let status: string | null = null;
  for (const row of rows.value) {
    if (!isRecord(row)) return { ok: false, reason: 'entrada_invalida' };
    if (typeof row.id !== 'string' || row.id.length === 0) return { ok: false, reason: 'entrada_invalida' };
    if (typeof row.status !== 'string') return { ok: false, reason: 'entrada_invalida' };
    if (seen.has(row.id)) return { ok: false, reason: 'entrada_invalida' };
    seen.add(row.id);
    if (row.id === organizationId) status = row.status;
  }
  if (status !== 'ACTIVE') return { ok: false, reason: 'empresa_no_activa' };
  return { ok: true };
}

function readMembership(
  state: Record<string, unknown>,
  organizationId: string,
  userId: string
): { ok: true; membership: ParsedMembership } | { ok: false; reason: CrmReadDenyReason } {
  const rows = readRequiredArray(state, 'memberships');
  if (!rows.ok) return rows;
  const seenIds = new Set<string>();
  const seenPairs = new Set<string>();
  let found: ParsedMembership | null = null;
  for (const row of rows.value) {
    const parsed = parseMembership(row);
    if (!parsed) return { ok: false, reason: 'entrada_invalida' };
    if (seenIds.has(parsed.id)) return { ok: false, reason: 'entrada_invalida' };
    const pair = assignmentKey(parsed.organizationId, parsed.userId, '');
    if (seenPairs.has(pair)) return { ok: false, reason: 'entrada_invalida' };
    seenIds.add(parsed.id);
    seenPairs.add(pair);
    if (parsed.organizationId === organizationId && parsed.userId === userId) found = parsed;
  }
  if (!found) return { ok: false, reason: 'membresia_inexistente' };
  if (found.status !== 'ACTIVE') return { ok: false, reason: 'membresia_no_activa' };
  return { ok: true, membership: found };
}

function readOperation(
  request: Record<string, unknown>
): { ok: true; operation: 'read_record' | 'list' } | { ok: false; reason: CrmReadDenyReason } {
  const action = hasOwn(request, 'action') ? request.action : 'crm.lead.read';
  if (action !== 'crm.lead.read') {
    if (typeof action === 'string' && NON_READ_ACTIONS.has(action)) {
      return { ok: false, reason: 'accion_fuera_de_corte' };
    }
    return { ok: false, reason: 'operacion_no_definida' };
  }
  if (request.operation === 'read_record' || request.operation === 'list') {
    return { ok: true, operation: request.operation };
  }
  if (typeof request.operation === 'string' && OUT_OF_CUT_OPERATIONS.has(request.operation)) {
    return { ok: false, reason: 'accion_fuera_de_corte' };
  }
  return { ok: false, reason: 'operacion_no_definida' };
}

function readRequestedScope(request: Record<string, unknown>, operation: 'read_record' | 'list'): Scope | 'invalid' {
  if (operation === 'read_record') {
    if (hasOwn(request, 'scope')) return 'invalid';
    if (typeof request.leadId !== 'string' || request.leadId.length === 0) return 'invalid';
    return { kind: 'record', leadId: request.leadId };
  }
  if (!hasOwn(request, 'scope') || !isRecord(request.scope)) return 'invalid';
  const scope = request.scope;
  if (Object.keys(scope).length !== 1) return 'invalid';
  if (scope.kind === 'company' || scope.kind === 'assigned') return { kind: scope.kind };
  return 'invalid';
}

function readQueryDependencies(request: Record<string, unknown>): string[] | 'invalid' {
  if (!hasOwn(request, 'query') || request.query == null) return [];
  if (!isRecord(request.query)) return 'invalid';
  for (const key of Object.keys(request.query)) {
    if (key !== 'filterFields' && key !== 'sortFields' && key !== 'aggregateFields') return 'invalid';
  }
  const fields: string[] = [];
  const seen = new Set<string>();
  for (const key of ['filterFields', 'sortFields', 'aggregateFields'] as const) {
    if (!hasOwn(request.query, key) || request.query[key] == null) continue;
    const value = request.query[key];
    if (!Array.isArray(value)) return 'invalid';
    for (const item of value) {
      if (typeof item !== 'string' || item.length === 0) return 'invalid';
      if (seen.has(item)) continue;
      seen.add(item);
      fields.push(item);
    }
  }
  return fields;
}

function readPolicy(
  state: Record<string, unknown>,
  organizationId: string,
  membershipId: string
): { ok: true; policy: ParsedPolicy } | { ok: false; reason: CrmReadDenyReason } {
  const grants = readRequiredArray(state, 'grants');
  const restrictions = readRequiredArray(state, 'restrictions');
  const assignments = readRequiredArray(state, 'assignments');
  const leads = readRequiredArray(state, 'leads');
  const memberships = readRequiredArray(state, 'memberships');
  if (!grants.ok) return grants;
  if (!restrictions.ok) return restrictions;
  if (!assignments.ok) return assignments;
  if (!leads.ok) return leads;
  if (!memberships.ok) return memberships;

  const evaluatedAt = readEvaluatedAt(state);
  if (evaluatedAt === 'invalid') return { ok: false, reason: 'entrada_invalida' };

  const parsedMemberships: ParsedMembership[] = [];
  for (const row of memberships.value) {
    const parsed = parseMembership(row);
    if (!parsed) return { ok: false, reason: 'entrada_invalida' };
    parsedMemberships.push(parsed);
  }

  const grantMap = new Map<string, ParsedGrant>();
  const seenGrantIds = new Set<string>();
  for (const row of grants.value) {
    if (!isRecord(row) || typeof row.id !== 'string' || row.id.length === 0) {
      return { ok: false, reason: 'entrada_invalida' };
    }
    if (seenGrantIds.has(row.id)) return { ok: false, reason: 'entrada_invalida' };
    seenGrantIds.add(row.id);
    const parsed = parseGrant(row);
    if (parsed) grantMap.set(parsed.id, parsed);
  }

  const parsedRestrictions: ParsedRestriction[] = [];
  for (const row of restrictions.value) {
    const classified = classifyRestriction(row, organizationId, membershipId);
    if (classified === 'invalid') return { ok: false, reason: 'entrada_invalida' };
    if (classified === 'ignore') continue;
    parsedRestrictions.push(classified);
  }

  const assignmentKeys = new Set<string>();
  const parsedAssignments: ParsedAssignment[] = [];
  for (const row of assignments.value) {
    if (!isRecord(row)) return { ok: false, reason: 'entrada_invalida' };
    const assignmentOrg = row.organizationId;
    const assignmentMembership = row.membershipId;
    const leadId = row.leadId;
    if (
      typeof assignmentOrg !== 'string' ||
      assignmentOrg.length === 0 ||
      typeof assignmentMembership !== 'string' ||
      assignmentMembership.length === 0 ||
      typeof leadId !== 'string' ||
      leadId.length === 0
    ) {
      return { ok: false, reason: 'entrada_invalida' };
    }
    assignmentKeys.add(assignmentKey(assignmentOrg, assignmentMembership, leadId));
    parsedAssignments.push({
      organizationId: assignmentOrg,
      membershipId: assignmentMembership,
      leadId,
    });
  }

  const parsedLeads: ParsedLead[] = [];
  const seenLeadIds = new Set<string>();
  for (const row of leads.value) {
    if (!isRecord(row)) return { ok: false, reason: 'entrada_invalida' };
    if (typeof row.id !== 'string' || row.id.length === 0) return { ok: false, reason: 'entrada_invalida' };
    if (typeof row.organizationId !== 'string' || row.organizationId.length === 0) {
      return { ok: false, reason: 'entrada_invalida' };
    }
    if (seenLeadIds.has(row.id)) return { ok: false, reason: 'entrada_invalida' };
    seenLeadIds.add(row.id);
    parsedLeads.push({ id: row.id, organizationId: row.organizationId, raw: row });
  }

  return {
    ok: true,
    policy: {
      grants: grantMap,
      restrictions: parsedRestrictions,
      assignments: parsedAssignments,
      assignmentKeys,
      leads: parsedLeads,
      memberships: parsedMemberships,
      evaluatedAt,
    },
  };
}

function parseMembership(value: unknown): ParsedMembership | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (typeof value.organizationId !== 'string' || value.organizationId.length === 0) return null;
  if (typeof value.userId !== 'string' || value.userId.length === 0) return null;
  if (typeof value.status !== 'string' || value.status.length === 0) return null;
  return {
    id: value.id,
    organizationId: value.organizationId,
    userId: value.userId,
    status: value.status,
  };
}

function parseGrant(value: Record<string, unknown>): ParsedGrant | null {
  if (value.action !== 'crm.lead.read' || value.accessMode !== 'read') return null;
  if (typeof value.organizationId !== 'string' || value.organizationId.length === 0) return null;
  if (typeof value.membershipId !== 'string' || value.membershipId.length === 0) return null;
  if (value.validity !== 'active') return null;
  if (!hasOwn(value, 'parentGrantId')) return null;
  const parentGrantId = value.parentGrantId;
  if (parentGrantId !== null && (typeof parentGrantId !== 'string' || parentGrantId.length === 0)) return null;
  const scope = parseScope(value.scope);
  const fieldClasses = parseGrantFieldClasses(value.fieldClasses);
  const origin = parseOrigin(value.origin, value.organizationId);
  const version = parseOptionalString(value, 'version');
  const requiredParentVersion = parseOptionalString(value, 'requiredParentVersion');
  const validFrom = parseOptionalInstant(value, 'validFrom');
  const validUntil = parseOptionalInstant(value, 'validUntil');
  if (!scope || !fieldClasses || fieldClasses.length === 0 || !origin) return null;
  if (version === 'invalid' || requiredParentVersion === 'invalid') return null;
  if (validFrom === 'invalid' || validUntil === 'invalid') return null;
  return {
    id: value.id as string,
    organizationId: value.organizationId,
    membershipId: value.membershipId,
    scope,
    fieldClasses,
    origin,
    parentGrantId,
    version,
    requiredParentVersion,
    validFrom,
    validUntil,
  };
}

function parseGrantFieldClasses(value: unknown): FieldClass[] | null {
  if (!Array.isArray(value)) return null;
  const classes: FieldClass[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    if (!isFieldClass(item) || classes.includes(item)) continue;
    classes.push(item);
  }
  return classes;
}

function classifyRestriction(
  value: unknown,
  organizationId: string,
  membershipId: string
): ParsedRestriction | 'ignore' | 'invalid' {
  if (!isRecord(value)) return 'invalid';
  if (typeof value.organizationId !== 'string' || value.organizationId.length === 0) return 'invalid';
  if (value.organizationId !== organizationId) return 'ignore';
  if (typeof value.membershipId !== 'string' || value.membershipId.length === 0) return 'invalid';
  if (value.membershipId !== membershipId) return 'ignore';
  if (typeof value.action !== 'string' || !isKnownAction(value.action)) return 'invalid';
  if (value.action !== 'crm.lead.read') return 'ignore';
  const scope = parseScope(value.scope);
  const fieldClasses = parseRestrictionFieldClasses(value.fieldClasses);
  if (!scope || !fieldClasses) return 'invalid';
  if (hasOwn(value, 'validity')) {
    if (typeof value.validity !== 'string') return 'invalid';
    if (value.validity === 'lifted') return 'ignore';
  }
  return { scope, fieldClasses };
}

function parseRestrictionFieldClasses(value: unknown): FieldClass[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const classes: FieldClass[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !isFieldClass(item)) return null;
    if (!classes.includes(item)) classes.push(item);
  }
  return classes;
}

function parseScope(value: unknown): Scope | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null;
  if (value.kind === 'company' || value.kind === 'assigned') {
    if (hasOwn(value, 'leadId')) return null;
    return { kind: value.kind };
  }
  if (value.kind === 'record' && typeof value.leadId === 'string' && value.leadId.length > 0) {
    return { kind: 'record', leadId: value.leadId };
  }
  return null;
}

function parseOrigin(value: unknown, organizationId: string): Origin | null {
  if (!isRecord(value)) return null;
  if (typeof value.kind !== 'string' || !ORIGIN_KINDS.has(value.kind)) return null;
  if (value.organizationId !== organizationId) return null;
  if (typeof value.rootValidated !== 'boolean') return null;
  if (hasOwn(value, 'revoked') && typeof value.revoked !== 'boolean') return null;
  return {
    kind: value.kind as OriginKind,
    organizationId,
    rootValidated: value.rootValidated,
    revoked: value.revoked === true,
  };
}

function parseOptionalString(value: Record<string, unknown>, key: string): string | null | 'invalid' {
  if (!hasOwn(value, key)) return null;
  if (typeof value[key] !== 'string' || (value[key] as string).length === 0) return 'invalid';
  return value[key] as string;
}

function parseOptionalInstant(value: Record<string, unknown>, key: string): string | null | 'invalid' {
  if (!hasOwn(value, key)) return null;
  if (typeof value[key] !== 'string' || !ISO_UTC.test(value[key] as string)) return 'invalid';
  return value[key] as string;
}

function readEvaluatedAt(state: Record<string, unknown>): string | null | 'invalid' {
  if (!hasOwn(state, 'evaluatedAt') || state.evaluatedAt == null) return null;
  if (typeof state.evaluatedAt !== 'string' || !ISO_UTC.test(state.evaluatedAt)) return 'invalid';
  return state.evaluatedAt;
}

function readRequiredArray(
  state: Record<string, unknown>,
  key: string
): { ok: true; value: unknown[] } | { ok: false; reason: CrmReadDenyReason } {
  if (!hasOwn(state, key)) return { ok: false, reason: 'politica_incompleta' };
  if (!Array.isArray(state[key])) return { ok: false, reason: 'entrada_invalida' };
  return { ok: true, value: state[key] as unknown[] };
}

function isKnownAction(action: string): boolean {
  return action === 'crm.lead.read' || NON_READ_ACTIONS.has(action);
}

function isFieldClass(value: string): value is FieldClass {
  return Object.prototype.hasOwnProperty.call(CRM_LEAD_READ_FIELDS, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function own(value: Record<string, unknown>, key: string): unknown {
  return hasOwn(value, key) ? value[key] : undefined;
}

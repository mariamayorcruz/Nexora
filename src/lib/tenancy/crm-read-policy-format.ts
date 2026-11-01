/**
 * Point 8 step 4A-1A — pure validators for CRM lead-read policy format
 * and bundle succession.
 *
 * No database, network, env, system clock, or product wiring.
 * Does not grant read permission, certify platform authority, or activate
 * a policy. AuthorityContext is a synthetic test/fixture input only.
 *
 * Chain depth matches the approved step-3 evaluator constant (8).
 * That evaluator lives on PR #22 and is not imported here.
 */

export const CRM_READ_POLICY_CANONICAL_VERSION = 'crm-read-policy-canonical/v1';

/** Same numeric limit as CRM_READ_MAX_CHAIN_DEPTH on the step-3 evaluator. */
export const CRM_READ_POLICY_MAX_CHAIN_DEPTH = 8;

export const CRM_READ_POLICY_FIELD_CLASSES = [
  'identidad',
  'canal',
  'gestion',
  'reservado',
] as const;

export type CrmReadPolicyFieldClass = (typeof CRM_READ_POLICY_FIELD_CLASSES)[number];

export const CRM_READ_POLICY_ORIGIN_KINDS = [
  'legacy_snapshot',
  'company_authority',
  'delegated_chain',
  'agency_relation',
] as const;

export type CrmReadPolicyOriginKind = (typeof CRM_READ_POLICY_ORIGIN_KINDS)[number];

export const CRM_READ_POLICY_GRANT_VALIDITIES = ['active', 'revoked', 'invalidated'] as const;
export type CrmReadPolicyGrantValidity = (typeof CRM_READ_POLICY_GRANT_VALIDITIES)[number];

export const CRM_READ_POLICY_RESTRICTION_VALIDITIES = ['active', 'lifted'] as const;
export type CrmReadPolicyRestrictionValidity =
  (typeof CRM_READ_POLICY_RESTRICTION_VALIDITIES)[number];

export type CrmReadPolicyFormatIssueCode =
  | 'entrada_invalida'
  | 'coleccion_ausente'
  | 'accion_no_soportada'
  | 'scope_no_soportado'
  | 'clase_desconocida'
  | 'clase_duplicada'
  | 'pertenencia_incoherente'
  | 'padre_ausente'
  | 'padre_ajeno'
  | 'cadena_ciclica'
  | 'cadena_profunda'
  | 'ventana_invalida'
  | 'version_invalida'
  | 'logical_id_duplicado'
  | 'version_id_duplicado'
  | 'origen_invalido'
  | 'predecesor_esperado_mismatch'
  | 'empresa_distinta'
  | 'version_no_superior'
  | 'restriccion_omitida_sin_evidencia'
  | 'restriccion_reducida_sin_evidencia'
  | 'reactivacion_invalida'
  | 'ampliacion_sin_evidencia'
  | 'evidencia_ajena'
  | 'evidencia_inexacta'
  | 'objeto_inexistente'
  | 'historial_retirado_omitido'
  | 'historial_retirado_incoherente'
  | 'auto_levantamiento'
  | 'contenido_mutado_tras_validacion'
  | 'checksum_invalido'
  | 'checksum_ausente'

export type CrmReadPolicyFormatIssue = {
  code: CrmReadPolicyFormatIssueCode;
  path: string;
  message: string;
};

export type CrmReadPolicyPendingExternalCheck =
  | 'platform_actor_authority_unverified'
  | 'root_validation_unverified'
  | 'activation_not_in_scope'
  | 'persistence_concurrency_unverified'
  | 'database_immutability_unverified';

export type CrmReadPolicyStructureResult =
  | {
      ok: true;
      kind: 'structure_valid';
      organizationId: string;
      version: number;
      checksum: string;
      grantCount: number;
      restrictionCount: number;
      pendingExternalChecks: CrmReadPolicyPendingExternalCheck[];
    }
  | {
      ok: false;
      kind: 'structure_invalid';
      issues: CrmReadPolicyFormatIssue[];
    };

export type CrmReadPolicySuccessionResult =
  | {
      ok: true;
      kind: 'succession_structure_valid';
      organizationId: string;
      fromVersion: number;
      toVersion: number;
      candidateChecksum: string;
      pendingExternalChecks: CrmReadPolicyPendingExternalCheck[];
    }
  | {
      ok: false;
      kind: 'succession_structure_invalid';
      issues: CrmReadPolicyFormatIssue[];
    };

/**
 * Synthetic authority fixture only. Passing validation never certifies a
 * real platform operator. Do not supply client request bodies as authority.
 */
export type AuthorityContext = {
  actorId: string;
  /** Membership ids this synthetic actor is treated as representing. */
  representedMembershipIds: string[];
  /**
   * Ordered synthetic delegation chain used only to detect indirect
   * self-lift: if the restriction target appears in this chain, lift fails.
   */
  authorityChainMembershipIds: string[];
};

export type CrmReadPolicyExpectedPredecessor = {
  version: number;
  checksum: string;
};

export type CrmReadPolicyChangeKind =
  | 'add_grant'
  | 'remove_grant'
  | 'revoke_grant'
  | 'invalidate_grant'
  | 'reassign_grant'
  | 'narrow_grant_classes'
  | 'widen_grant_classes'
  | 'widen_grant_scope'
  | 'extend_grant_window'
  | 'change_grant_parent'
  | 'change_grant_origin'
  | 'add_restriction'
  | 'lift_restriction'
  | 'narrow_restriction_classes';

/**
 * Evidence contracts (per changeKind):
 * - add_grant / add_restriction: require `after` identity fingerprint of the
 *   new object; forbid `before` and class deltas.
 * - lift_restriction / remove|revoke|invalidate_grant: require `before`
 *   fingerprint of the removed/lifted object; forbid `after` and class deltas.
 * - widen_grant_classes / narrow_*: require exact class delta sets; optional
 *   before/after may only restate fieldClasses of prior/next; other snapshot
 *   fields are not admitted.
 * - reassign / scope / window / parent / origin: require before+after fields
 *   that match the real change; extraneous snapshot fields are rejected.
 * A changeKind label + logicalId alone never certifies the content.
 */
export type CrmReadPolicyChangeEvidence = {
  evidenceId: string;
  organizationId: string;
  fromVersion: number;
  toVersion: number;
  changeKind: CrmReadPolicyChangeKind;
  /** Logical id of the grant or restriction the evidence addresses. */
  targetLogicalId: string;
  /** Exact classes added by this evidence (sorted uniqueness enforced). */
  fieldClassesAdded?: string[];
  /** Exact classes removed by this evidence. */
  fieldClassesRemoved?: string[];
  before?: CrmReadPolicyEvidenceSnapshot;
  after?: CrmReadPolicyEvidenceSnapshot;
};

export type CrmReadPolicyEvidenceSnapshot = {
  membershipId?: string;
  scopeKind?: 'company' | 'record';
  scopeLeadId?: string | null;
  fieldClasses?: string[];
  validFrom?: string | null;
  validUntil?: string | null;
  parentVersionId?: string | null;
  grantVersion?: string | null;
  requiredParentVersion?: string | null;
  originKind?: CrmReadPolicyOriginKind;
  originRootValidated?: boolean;
  originRevoked?: boolean;
  validity?: string;
};

type OwnRecord = Record<string, unknown>;

type ParsedScope =
  | { kind: 'company' }
  | { kind: 'record'; leadId: string };

type ParsedOrigin = {
  kind: CrmReadPolicyOriginKind;
  organizationId: string;
  rootValidated: boolean;
  revoked: boolean;
};

type ParsedGrant = {
  versionId: string;
  logicalId: string;
  organizationId: string;
  membershipId: string;
  action: 'crm.lead.read';
  accessMode: 'read';
  scope: ParsedScope;
  fieldClasses: CrmReadPolicyFieldClass[];
  validity: CrmReadPolicyGrantValidity;
  parentVersionId: string | null;
  origin: ParsedOrigin;
  grantVersion: string | null;
  requiredParentVersion: string | null;
  validFrom: number | null;
  validUntil: number | null;
};

type ParsedRestriction = {
  versionId: string;
  logicalId: string;
  organizationId: string;
  membershipId: string;
  action: 'crm.lead.read';
  scope: ParsedScope;
  fieldClasses: CrmReadPolicyFieldClass[];
  validity: CrmReadPolicyRestrictionValidity;
  authorMembershipId: string | null;
};

type ParsedBundle = {
  organizationId: string;
  version: number;
  status: 'draft' | 'validated';
  contentChecksum: string | null;
  membershipIds: Set<string>;
  leadIds: Set<string>;
  /**
   * Explicit retired grant logical identities. Must be present (possibly empty).
   * Absence is not an empty history. Once listed, an id cannot leave the set
   * and cannot reappear as an active grant.
   */
  retiredGrantLogicalIds: Set<string>;
  grants: ParsedGrant[];
  restrictions: ParsedRestriction[];
  grantsByVersionId: Map<string, ParsedGrant>;
  grantsByLogicalId: Map<string, ParsedGrant>;
  restrictionsByLogicalId: Map<string, ParsedRestriction>;
};

type Catalog = {
  organizationId: string;
  membershipIds: ReadonlySet<string>;
  leadIds: ReadonlySet<string>;
};

const INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/;
const NativeDate = Date;
const nativeDateUTC = Date.UTC;
const nativeGetUTCFullYear = Date.prototype.getUTCFullYear;
const nativeGetUTCMonth = Date.prototype.getUTCMonth;
const nativeGetUTCDate = Date.prototype.getUTCDate;
const nativeGetUTCHours = Date.prototype.getUTCHours;
const nativeGetUTCMinutes = Date.prototype.getUTCMinutes;
const nativeGetUTCSeconds = Date.prototype.getUTCSeconds;
const nativeGetUTCMilliseconds = Date.prototype.getUTCMilliseconds;
const OBJECT_PROTOTYPE = Object.prototype;
const ARRAY_PROTOTYPE = Array.prototype;
const nativeGetPrototypeOf = Object.getPrototypeOf;
const nativeGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const nativeGetOwnPropertyNames = Object.getOwnPropertyNames;
const nativeGetOwnPropertySymbols = Object.getOwnPropertySymbols;
const nativeArrayIsArray = Array.isArray;
const nativeHasOwn = Object.prototype.hasOwnProperty;
const FIELD_CLASS_SET: ReadonlySet<string> = new Set(CRM_READ_POLICY_FIELD_CLASSES);
const ORIGIN_KIND_SET: ReadonlySet<string> = new Set(CRM_READ_POLICY_ORIGIN_KINDS);
const GRANT_VALIDITY_SET: ReadonlySet<string> = new Set(CRM_READ_POLICY_GRANT_VALIDITIES);
const RESTRICTION_VALIDITY_SET: ReadonlySet<string> = new Set(CRM_READ_POLICY_RESTRICTION_VALIDITIES);
const CHANGE_KIND_SET: ReadonlySet<string> = new Set([
  'add_grant',
  'remove_grant',
  'revoke_grant',
  'invalidate_grant',
  'reassign_grant',
  'narrow_grant_classes',
  'widen_grant_classes',
  'widen_grant_scope',
  'extend_grant_window',
  'change_grant_parent',
  'change_grant_origin',
  'add_restriction',
  'lift_restriction',
  'narrow_restriction_classes',
]);

const STRUCTURE_PENDING: CrmReadPolicyPendingExternalCheck[] = [
  'platform_actor_authority_unverified',
  'root_validation_unverified',
  'activation_not_in_scope',
  'persistence_concurrency_unverified',
  'database_immutability_unverified',
];

/**
 * Supported input format (strict):
 * - Own plain objects: prototype Object.prototype or null, no own accessors.
 * - Own plain arrays: Array.prototype, no holes, no accessors, no symbols.
 * - Strings, finite numbers, booleans, null only as documented fields.
 * - Instants: UTC strings matching YYYY-MM-DDTHH:mm:ss[.sss]Z that form a
 *   real calendar time (same discipline as the step-3 evaluator).
 * - No Date host objects, no inherited enumerable data, no host-object brand
 *   label checks, no calling methods found on the input value.
 */

export function validateCrmReadPolicyBundle(input: unknown): CrmReadPolicyStructureResult {
  const issues: CrmReadPolicyFormatIssue[] = [];
  const parsed = parseBundle(input, issues, 'bundle');
  if (!parsed || issues.length > 0) {
    return { ok: false, kind: 'structure_invalid', issues };
  }
  const checksum = computeBundleChecksum(parsed);
  assertDeclaredChecksum(parsed, checksum, 'bundle', issues);
  if (issues.length > 0) {
    return { ok: false, kind: 'structure_invalid', issues };
  }
  return {
    ok: true,
    kind: 'structure_valid',
    organizationId: parsed.organizationId,
    version: parsed.version,
    checksum,
    grantCount: parsed.grants.length,
    restrictionCount: parsed.restrictions.length,
    pendingExternalChecks: STRUCTURE_PENDING.slice(),
  };
}

export function validateCrmReadPolicySuccession(input: unknown): CrmReadPolicySuccessionResult {
  const issues: CrmReadPolicyFormatIssue[] = [];
  const root = ownDataRecord(input);
  if (!root) {
    return {
      ok: false,
      kind: 'succession_structure_invalid',
      issues: [issue('entrada_invalida', 'succession', 'succession root must be an own plain object')],
    };
  }

  if (!hasOwn(root, 'reference') || !hasOwn(root, 'candidate')) {
    issues.push(issue('coleccion_ausente', 'succession', 'reference and candidate are required'));
  }
  if (!hasOwn(root, 'expectedPredecessor')) {
    issues.push(
      issue('coleccion_ausente', 'succession.expectedPredecessor', 'expectedPredecessor is required')
    );
  }
  if (!hasOwn(root, 'changeEvidence')) {
    issues.push(issue('coleccion_ausente', 'succession.changeEvidence', 'changeEvidence must be present'));
  }
  if (!hasOwn(root, 'authority')) {
    issues.push(issue('coleccion_ausente', 'succession.authority', 'authority fixture is required'));
  }
  if (issues.length > 0) {
    return { ok: false, kind: 'succession_structure_invalid', issues };
  }

  const reference = parseBundle(dataValue(root, 'reference'), issues, 'reference');
  const candidate = parseBundle(dataValue(root, 'candidate'), issues, 'candidate');
  const expected = parseExpectedPredecessor(dataValue(root, 'expectedPredecessor'), issues);
  const evidence = parseChangeEvidenceList(dataValue(root, 'changeEvidence'), issues);
  const authority = parseAuthority(dataValue(root, 'authority'), issues);

  if (!reference || !candidate || !expected || !evidence || !authority || issues.length > 0) {
    return { ok: false, kind: 'succession_structure_invalid', issues };
  }

  if (reference.organizationId !== candidate.organizationId) {
    issues.push(issue('empresa_distinta', 'candidate.organizationId', 'candidate organization differs'));
  }
  if (!(candidate.version > reference.version)) {
    issues.push(
      issue('version_no_superior', 'candidate.version', 'candidate version must be greater than reference')
    );
  }

  const referenceChecksum = computeBundleChecksum(reference);
  const candidateChecksum = computeBundleChecksum(candidate);
  assertDeclaredChecksum(reference, referenceChecksum, 'reference', issues);
  assertDeclaredChecksum(candidate, candidateChecksum, 'candidate', issues);

  if (expected.version !== reference.version || expected.checksum !== referenceChecksum) {
    issues.push(
      issue(
        'predecesor_esperado_mismatch',
        'expectedPredecessor',
        'expectedPredecessor does not match the reference bundle version/checksum'
      )
    );
  }

  for (const row of evidence) {
    if (row.organizationId !== candidate.organizationId) {
      issues.push(issue('evidencia_ajena', `changeEvidence.${row.evidenceId}`, 'evidence organization differs'));
    }
    if (row.fromVersion !== reference.version || row.toVersion !== candidate.version) {
      issues.push(
        issue('evidencia_ajena', `changeEvidence.${row.evidenceId}`, 'evidence versions do not match succession')
      );
    }
  }

  checkSuccessionSemantics(reference, candidate, evidence, authority, issues);

  if (issues.length > 0) {
    return { ok: false, kind: 'succession_structure_invalid', issues };
  }

  return {
    ok: true,
    kind: 'succession_structure_valid',
    organizationId: candidate.organizationId,
    fromVersion: reference.version,
    toVersion: candidate.version,
    candidateChecksum,
    pendingExternalChecks: STRUCTURE_PENDING.slice(),
  };
}

function assertDeclaredChecksum(
  bundle: ParsedBundle,
  actual: string,
  path: string,
  issues: CrmReadPolicyFormatIssue[]
) {
  if (bundle.status === 'validated') {
    if (bundle.contentChecksum === null) {
      issues.push(
        issue(
          'checksum_ausente',
          `${path}.contentChecksum`,
          'validated bundles must declare contentChecksum'
        )
      );
      return;
    }
    if (bundle.contentChecksum !== actual) {
      issues.push(
        issue(
          'checksum_invalido',
          `${path}.contentChecksum`,
          'declared contentChecksum does not match canonical content'
        )
      );
    }
    return;
  }
  if (bundle.contentChecksum !== null && bundle.contentChecksum !== actual) {
    issues.push(
      issue(
        'checksum_invalido',
        `${path}.contentChecksum`,
        'declared contentChecksum does not match canonical content'
      )
    );
  }
}

export function computeCrmReadPolicyBundleChecksum(input: unknown): string | null {
  const issues: CrmReadPolicyFormatIssue[] = [];
  const parsed = parseBundle(input, issues, 'bundle');
  if (!parsed || issues.length > 0) return null;
  return computeBundleChecksum(parsed);
}

function parseBundle(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): ParsedBundle | null {
  const record = ownDataRecord(value);
  if (!record) {
    issues.push(issue('entrada_invalida', path, 'bundle must be an own plain object'));
    return null;
  }

  const organizationId = readNonEmptyString(record, 'organizationId', issues, `${path}.organizationId`);
  const version = readPositiveInt(record, 'version', issues, `${path}.version`);
  const statusRaw = readNonEmptyString(record, 'status', issues, `${path}.status`);
  let status: 'draft' | 'validated' | null = null;
  if (statusRaw === 'draft' || statusRaw === 'validated') status = statusRaw;
  else if (statusRaw !== null) {
    issues.push(issue('entrada_invalida', `${path}.status`, 'status must be draft or validated'));
  }

  let contentChecksum: string | null = null;
  if (hasOwn(record, 'contentChecksum')) {
    const raw = dataValue(record, 'contentChecksum');
    if (raw === null) contentChecksum = null;
    else if (typeof raw === 'string' && raw.length > 0) contentChecksum = raw;
    else issues.push(issue('checksum_invalido', `${path}.contentChecksum`, 'contentChecksum must be string or null'));
  }

  if (!hasOwn(record, 'membershipIds')) {
    issues.push(issue('coleccion_ausente', `${path}.membershipIds`, 'membershipIds must be present'));
  }
  if (!hasOwn(record, 'leadIds')) {
    issues.push(issue('coleccion_ausente', `${path}.leadIds`, 'leadIds must be present'));
  }
  if (!hasOwn(record, 'retiredGrantLogicalIds')) {
    issues.push(
      issue(
        'coleccion_ausente',
        `${path}.retiredGrantLogicalIds`,
        'retiredGrantLogicalIds must be present; absence is not an empty history'
      )
    );
  }
  if (!hasOwn(record, 'grants')) {
    issues.push(issue('coleccion_ausente', `${path}.grants`, 'grants must be present'));
  }
  if (!hasOwn(record, 'restrictions')) {
    issues.push(issue('coleccion_ausente', `${path}.restrictions`, 'restrictions must be present'));
  }

  const membershipIds = readIdSet(dataValue(record, 'membershipIds'), issues, `${path}.membershipIds`);
  const leadIds = readIdSet(dataValue(record, 'leadIds'), issues, `${path}.leadIds`);
  const retiredGrantLogicalIds = readIdSet(
    dataValue(record, 'retiredGrantLogicalIds'),
    issues,
    `${path}.retiredGrantLogicalIds`
  );
  const grantsRaw = readPresentArray(dataValue(record, 'grants'), issues, `${path}.grants`);
  const restrictionsRaw = readPresentArray(
    dataValue(record, 'restrictions'),
    issues,
    `${path}.restrictions`
  );

  if (
    organizationId === null ||
    version === null ||
    status === null ||
    membershipIds === null ||
    leadIds === null ||
    retiredGrantLogicalIds === null ||
    grantsRaw === null ||
    restrictionsRaw === null
  ) {
    return null;
  }

  const catalog: Catalog = { organizationId, membershipIds, leadIds };
  const grants: ParsedGrant[] = [];
  const grantsByVersionId = new Map<string, ParsedGrant>();
  const grantsByLogicalId = new Map<string, ParsedGrant>();

  for (let index = 0; index < grantsRaw.length; index += 1) {
    const grant = parseGrant(grantsRaw[index], catalog, issues, `${path}.grants[${index}]`);
    if (!grant) continue;
    if (grantsByVersionId.has(grant.versionId)) {
      issues.push(issue('version_id_duplicado', `${path}.grants[${index}].versionId`, 'duplicate grant versionId'));
    }
    if (grantsByLogicalId.has(grant.logicalId)) {
      issues.push(issue('logical_id_duplicado', `${path}.grants[${index}].logicalId`, 'duplicate grant logicalId'));
    }
    grants.push(grant);
    grantsByVersionId.set(grant.versionId, grant);
    grantsByLogicalId.set(grant.logicalId, grant);
  }

  for (const grant of grants) {
    if (grant.validity === 'revoked' || grant.validity === 'invalidated') {
      if (!retiredGrantLogicalIds.has(grant.logicalId)) {
        issues.push(
          issue(
            'historial_retirado_incoherente',
            `${path}.retiredGrantLogicalIds`,
            `revoked/invalidated grant ${grant.logicalId} must be listed in retiredGrantLogicalIds`
          )
        );
      }
    }
    if (grant.validity === 'active' && retiredGrantLogicalIds.has(grant.logicalId)) {
      issues.push(
        issue(
          'reactivacion_invalida',
          `grant:${grant.logicalId}`,
          'active grant logicalId is listed as retired'
        )
      );
    }
  }

  for (const grant of grants) {
    if (grant.parentVersionId === null) continue;
    const parent = grantsByVersionId.get(grant.parentVersionId);
    if (!parent) {
      issues.push(issue('padre_ausente', `grant:${grant.versionId}.parentVersionId`, 'parent grant missing'));
      continue;
    }
    if (parent.organizationId !== grant.organizationId) {
      issues.push(issue('padre_ajeno', `grant:${grant.versionId}.parentVersionId`, 'parent organization differs'));
    }
  }

  validateGrantChains(grants, grantsByVersionId, issues);

  const restrictions: ParsedRestriction[] = [];
  const restrictionsByLogicalId = new Map<string, ParsedRestriction>();
  for (let index = 0; index < restrictionsRaw.length; index += 1) {
    const restriction = parseRestriction(
      restrictionsRaw[index],
      catalog,
      issues,
      `${path}.restrictions[${index}]`
    );
    if (!restriction) continue;
    if (restrictionsByLogicalId.has(restriction.logicalId)) {
      issues.push(
        issue(
          'logical_id_duplicado',
          `${path}.restrictions[${index}].logicalId`,
          'duplicate restriction logicalId'
        )
      );
    }
    restrictions.push(restriction);
    restrictionsByLogicalId.set(restriction.logicalId, restriction);
  }

  return {
    organizationId,
    version,
    status,
    contentChecksum,
    membershipIds,
    leadIds,
    retiredGrantLogicalIds,
    grants,
    restrictions,
    grantsByVersionId,
    grantsByLogicalId,
    restrictionsByLogicalId,
  };
}

function parseGrant(
  value: unknown,
  catalog: Catalog,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): ParsedGrant | null {
  const record = ownDataRecord(value);
  if (!record) {
    issues.push(issue('entrada_invalida', path, 'grant must be an own plain object'));
    return null;
  }

  const versionId = readNonEmptyString(record, 'versionId', issues, `${path}.versionId`);
  const logicalId = readNonEmptyString(record, 'logicalId', issues, `${path}.logicalId`);
  const organizationId = readNonEmptyString(record, 'organizationId', issues, `${path}.organizationId`);
  const membershipId = readNonEmptyString(record, 'membershipId', issues, `${path}.membershipId`);
  const action = readNonEmptyString(record, 'action', issues, `${path}.action`);
  const accessMode = readNonEmptyString(record, 'accessMode', issues, `${path}.accessMode`);
  const validityRaw = readNonEmptyString(record, 'validity', issues, `${path}.validity`);
  const scope = parseScope(dataValue(record, 'scope'), issues, `${path}.scope`);
  const fieldClasses = parseFieldClasses(dataValue(record, 'fieldClasses'), issues, `${path}.fieldClasses`);
  const origin = parseOrigin(dataValue(record, 'origin'), issues, `${path}.origin`);

  if (action !== null && action !== 'crm.lead.read') {
    issues.push(issue('accion_no_soportada', `${path}.action`, 'only crm.lead.read is supported'));
  }
  if (accessMode !== null && accessMode !== 'read') {
    issues.push(issue('entrada_invalida', `${path}.accessMode`, 'accessMode must be read'));
  }
  if (validityRaw !== null && !GRANT_VALIDITY_SET.has(validityRaw)) {
    issues.push(issue('entrada_invalida', `${path}.validity`, 'unknown grant validity'));
  }

  let parentVersionId: string | null = null;
  if (!hasOwn(record, 'parentVersionId')) {
    issues.push(issue('coleccion_ausente', `${path}.parentVersionId`, 'parentVersionId must be present'));
  } else {
    const parentRaw = dataValue(record, 'parentVersionId');
    if (parentRaw === null) parentVersionId = null;
    else if (typeof parentRaw === 'string' && parentRaw.length > 0) parentVersionId = parentRaw;
    else issues.push(issue('entrada_invalida', `${path}.parentVersionId`, 'parentVersionId must be string or null'));
  }

  const grantVersion = readOptionalString(record, 'grantVersion', issues, `${path}.grantVersion`);
  const requiredParentVersion = readOptionalString(
    record,
    'requiredParentVersion',
    issues,
    `${path}.requiredParentVersion`
  );
  const validFrom = readOptionalInstant(record, 'validFrom', issues, `${path}.validFrom`);
  const validUntil = readOptionalInstant(record, 'validUntil', issues, `${path}.validUntil`);

  if (
    versionId === null ||
    logicalId === null ||
    organizationId === null ||
    membershipId === null ||
    action !== 'crm.lead.read' ||
    accessMode !== 'read' ||
    validityRaw === null ||
    !GRANT_VALIDITY_SET.has(validityRaw) ||
    !scope ||
    !fieldClasses ||
    !origin ||
    grantVersion === 'invalid' ||
    requiredParentVersion === 'invalid' ||
    validFrom === 'invalid' ||
    validUntil === 'invalid'
  ) {
    return null;
  }

  if (organizationId !== catalog.organizationId) {
    issues.push(issue('pertenencia_incoherente', `${path}.organizationId`, 'grant organization mismatch'));
  }
  if (!catalog.membershipIds.has(membershipId)) {
    issues.push(issue('pertenencia_incoherente', `${path}.membershipId`, 'membership not in catalog'));
  }
  if (scope.kind === 'record' && !catalog.leadIds.has(scope.leadId)) {
    issues.push(issue('pertenencia_incoherente', `${path}.scope.leadId`, 'lead not in catalog'));
  }
  if (origin.organizationId !== organizationId) {
    issues.push(issue('pertenencia_incoherente', `${path}.origin.organizationId`, 'origin organization mismatch'));
  }
  if (
    typeof validFrom === 'number' &&
    typeof validUntil === 'number' &&
    validFrom > validUntil
  ) {
    issues.push(issue('ventana_invalida', `${path}.validFrom`, 'validFrom after validUntil'));
  }

  return {
    versionId,
    logicalId,
    organizationId,
    membershipId,
    action: 'crm.lead.read',
    accessMode: 'read',
    scope,
    fieldClasses,
    validity: validityRaw as CrmReadPolicyGrantValidity,
    parentVersionId,
    origin,
    grantVersion: grantVersion === null ? null : grantVersion,
    requiredParentVersion: requiredParentVersion === null ? null : requiredParentVersion,
    validFrom: validFrom === null ? null : validFrom,
    validUntil: validUntil === null ? null : validUntil,
  };
}

function parseRestriction(
  value: unknown,
  catalog: Catalog,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): ParsedRestriction | null {
  const record = ownDataRecord(value);
  if (!record) {
    issues.push(issue('entrada_invalida', path, 'restriction must be an own plain object'));
    return null;
  }

  const versionId = readNonEmptyString(record, 'versionId', issues, `${path}.versionId`);
  const logicalId = readNonEmptyString(record, 'logicalId', issues, `${path}.logicalId`);
  const organizationId = readNonEmptyString(record, 'organizationId', issues, `${path}.organizationId`);
  const membershipId = readNonEmptyString(record, 'membershipId', issues, `${path}.membershipId`);
  const action = readNonEmptyString(record, 'action', issues, `${path}.action`);
  const validityRaw = readNonEmptyString(record, 'validity', issues, `${path}.validity`);
  const scope = parseScope(dataValue(record, 'scope'), issues, `${path}.scope`);
  const fieldClasses = parseFieldClasses(dataValue(record, 'fieldClasses'), issues, `${path}.fieldClasses`);

  if (action !== null && action !== 'crm.lead.read') {
    issues.push(issue('accion_no_soportada', `${path}.action`, 'only crm.lead.read is supported'));
  }
  if (validityRaw !== null && !RESTRICTION_VALIDITY_SET.has(validityRaw)) {
    issues.push(issue('entrada_invalida', `${path}.validity`, 'unknown restriction validity'));
  }

  let authorMembershipId: string | null = null;
  if (!hasOwn(record, 'authorMembershipId')) {
    issues.push(issue('coleccion_ausente', `${path}.authorMembershipId`, 'authorMembershipId must be present'));
  } else {
    const raw = dataValue(record, 'authorMembershipId');
    if (raw === null) authorMembershipId = null;
    else if (typeof raw === 'string' && raw.length > 0) authorMembershipId = raw;
    else {
      issues.push(issue('entrada_invalida', `${path}.authorMembershipId`, 'authorMembershipId must be string or null'));
    }
  }

  if (
    versionId === null ||
    logicalId === null ||
    organizationId === null ||
    membershipId === null ||
    action !== 'crm.lead.read' ||
    validityRaw === null ||
    !RESTRICTION_VALIDITY_SET.has(validityRaw) ||
    !scope ||
    !fieldClasses
  ) {
    return null;
  }

  if (organizationId !== catalog.organizationId) {
    issues.push(issue('pertenencia_incoherente', `${path}.organizationId`, 'restriction organization mismatch'));
  }
  if (!catalog.membershipIds.has(membershipId)) {
    issues.push(issue('pertenencia_incoherente', `${path}.membershipId`, 'membership not in catalog'));
  }
  if (authorMembershipId !== null && !catalog.membershipIds.has(authorMembershipId)) {
    issues.push(
      issue('pertenencia_incoherente', `${path}.authorMembershipId`, 'author membership not in catalog')
    );
  }
  if (scope.kind === 'record' && !catalog.leadIds.has(scope.leadId)) {
    issues.push(issue('pertenencia_incoherente', `${path}.scope.leadId`, 'lead not in catalog'));
  }

  return {
    versionId,
    logicalId,
    organizationId,
    membershipId,
    action: 'crm.lead.read',
    scope,
    fieldClasses,
    validity: validityRaw as CrmReadPolicyRestrictionValidity,
    authorMembershipId,
  };
}

function parseScope(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): ParsedScope | null {
  const record = ownDataRecord(value);
  if (!record) {
    issues.push(issue('entrada_invalida', path, 'scope must be an own plain object'));
    return null;
  }
  const keys = ownStringKeys(record);
  if (!keys) {
    issues.push(issue('entrada_invalida', path, 'scope must not carry symbols'));
    return null;
  }
  const kind = readNonEmptyString(record, 'kind', issues, `${path}.kind`);
  if (kind === 'assigned') {
    issues.push(issue('scope_no_soportado', `${path}.kind`, 'assigned scope is not supported in this cut'));
    return null;
  }
  if (kind === 'company') {
    if (keys.some((key) => key !== 'kind')) {
      issues.push(issue('entrada_invalida', path, 'company scope must only have kind'));
      return null;
    }
    return { kind: 'company' };
  }
  if (kind === 'record') {
    const leadId = readNonEmptyString(record, 'leadId', issues, `${path}.leadId`);
    if (!leadId) return null;
    return { kind: 'record', leadId };
  }
  if (kind !== null) {
    issues.push(issue('scope_no_soportado', `${path}.kind`, 'unknown scope kind'));
  }
  return null;
}

function parseOrigin(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): ParsedOrigin | null {
  const record = ownDataRecord(value);
  if (!record) {
    issues.push(issue('entrada_invalida', path, 'origin must be an own plain object'));
    return null;
  }
  const kind = readNonEmptyString(record, 'kind', issues, `${path}.kind`);
  const organizationId = readNonEmptyString(record, 'organizationId', issues, `${path}.organizationId`);
  if (!hasOwn(record, 'rootValidated') || typeof dataValue(record, 'rootValidated') !== 'boolean') {
    issues.push(issue('origen_invalido', `${path}.rootValidated`, 'rootValidated must be boolean'));
  }
  if (!hasOwn(record, 'revoked') || typeof dataValue(record, 'revoked') !== 'boolean') {
    issues.push(issue('origen_invalido', `${path}.revoked`, 'revoked must be boolean'));
  }
  if (kind !== null && !ORIGIN_KIND_SET.has(kind)) {
    issues.push(issue('origen_invalido', `${path}.kind`, 'unknown origin kind'));
  }
  const rootValidated = dataValue(record, 'rootValidated');
  const revoked = dataValue(record, 'revoked');
  if (
    kind === null ||
    !ORIGIN_KIND_SET.has(kind) ||
    organizationId === null ||
    typeof rootValidated !== 'boolean' ||
    typeof revoked !== 'boolean'
  ) {
    return null;
  }
  return {
    kind: kind as CrmReadPolicyOriginKind,
    organizationId,
    rootValidated,
    revoked,
  };
}

function parseFieldClasses(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): CrmReadPolicyFieldClass[] | null {
  const items = copyPlainArray(value);
  if (!items) {
    issues.push(issue('entrada_invalida', path, 'fieldClasses must be a present plain array'));
    return null;
  }
  if (items.length === 0) {
    issues.push(issue('entrada_invalida', path, 'fieldClasses must be non-empty'));
    return null;
  }
  const classes: CrmReadPolicyFieldClass[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (typeof item !== 'string') {
      issues.push(issue('entrada_invalida', `${path}[${index}]`, 'field class must be string'));
      return null;
    }
    if (!FIELD_CLASS_SET.has(item)) {
      issues.push(issue('clase_desconocida', `${path}[${index}]`, 'unknown field class'));
      return null;
    }
    if (seen.has(item)) {
      issues.push(issue('clase_duplicada', `${path}[${index}]`, 'duplicate field class'));
      return null;
    }
    seen.add(item);
    classes.push(item as CrmReadPolicyFieldClass);
  }
  return classes;
}

function validateGrantChains(
  grants: ParsedGrant[],
  byVersionId: Map<string, ParsedGrant>,
  issues: CrmReadPolicyFormatIssue[]
) {
  for (const grant of grants) {
    const seen = new Set<string>();
    let current: ParsedGrant | undefined = grant;
    let depth = 0;
    while (current) {
      if (seen.has(current.versionId)) {
        issues.push(issue('cadena_ciclica', `grant:${grant.versionId}`, 'grant parent chain cycles'));
        break;
      }
      seen.add(current.versionId);
      depth += 1;
      if (depth > CRM_READ_POLICY_MAX_CHAIN_DEPTH) {
        issues.push(
          issue(
            'cadena_profunda',
            `grant:${grant.versionId}`,
            `grant parent chain exceeds ${CRM_READ_POLICY_MAX_CHAIN_DEPTH}`
          )
        );
        break;
      }
      if (current.parentVersionId === null) break;
      current = byVersionId.get(current.parentVersionId);
      if (!current) break;
    }
  }
}

function parseExpectedPredecessor(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[]
): CrmReadPolicyExpectedPredecessor | null {
  const record = ownDataRecord(value);
  if (!record) {
    issues.push(issue('entrada_invalida', 'expectedPredecessor', 'must be an own plain object'));
    return null;
  }
  const version = readPositiveInt(record, 'version', issues, 'expectedPredecessor.version');
  const checksum = readNonEmptyString(record, 'checksum', issues, 'expectedPredecessor.checksum');
  if (version === null || checksum === null) return null;
  return { version, checksum };
}

function parseAuthority(value: unknown, issues: CrmReadPolicyFormatIssue[]): AuthorityContext | null {
  const record = ownDataRecord(value);
  if (!record) {
    issues.push(issue('entrada_invalida', 'authority', 'authority must be an own plain object'));
    return null;
  }
  const actorId = readNonEmptyString(record, 'actorId', issues, 'authority.actorId');
  const represented = readIdSet(
    dataValue(record, 'representedMembershipIds'),
    issues,
    'authority.representedMembershipIds'
  );
  const chain = readIdList(
    dataValue(record, 'authorityChainMembershipIds'),
    issues,
    'authority.authorityChainMembershipIds'
  );
  if (actorId === null || represented === null || chain === null) return null;
  return {
    actorId,
    representedMembershipIds: Array.from(represented),
    authorityChainMembershipIds: chain,
  };
}

function parseChangeEvidenceList(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[]
): CrmReadPolicyChangeEvidence[] | null {
  const items = readPresentArray(value, issues, 'changeEvidence');
  if (!items) return null;
  const rows: CrmReadPolicyChangeEvidence[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const row = parseChangeEvidence(items[index], issues, `changeEvidence[${index}]`);
    if (!row) continue;
    if (seen.has(row.evidenceId)) {
      issues.push(issue('entrada_invalida', `changeEvidence[${index}].evidenceId`, 'duplicate evidenceId'));
    }
    seen.add(row.evidenceId);
    rows.push(row);
  }
  return rows;
}

function parseChangeEvidence(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): CrmReadPolicyChangeEvidence | null {
  const record = ownDataRecord(value);
  if (!record) {
    issues.push(issue('entrada_invalida', path, 'evidence must be an own plain object'));
    return null;
  }
  const evidenceId = readNonEmptyString(record, 'evidenceId', issues, `${path}.evidenceId`);
  const organizationId = readNonEmptyString(record, 'organizationId', issues, `${path}.organizationId`);
  const fromVersion = readPositiveInt(record, 'fromVersion', issues, `${path}.fromVersion`);
  const toVersion = readPositiveInt(record, 'toVersion', issues, `${path}.toVersion`);
  const changeKind = readNonEmptyString(record, 'changeKind', issues, `${path}.changeKind`);
  const targetLogicalId = readNonEmptyString(record, 'targetLogicalId', issues, `${path}.targetLogicalId`);
  if (changeKind !== null && !CHANGE_KIND_SET.has(changeKind)) {
    issues.push(issue('entrada_invalida', `${path}.changeKind`, 'unknown changeKind'));
  }

  let fieldClassesAdded: string[] | undefined;
  let fieldClassesRemoved: string[] | undefined;
  if (hasOwn(record, 'fieldClassesAdded')) {
    const parsed = parseFieldClasses(dataValue(record, 'fieldClassesAdded'), issues, `${path}.fieldClassesAdded`);
    if (!parsed) return null;
    fieldClassesAdded = parsed;
  }
  if (hasOwn(record, 'fieldClassesRemoved')) {
    const parsed = parseFieldClasses(
      dataValue(record, 'fieldClassesRemoved'),
      issues,
      `${path}.fieldClassesRemoved`
    );
    if (!parsed) return null;
    fieldClassesRemoved = parsed;
  }

  let before: CrmReadPolicyEvidenceSnapshot | undefined;
  let after: CrmReadPolicyEvidenceSnapshot | undefined;
  if (hasOwn(record, 'before')) {
    before = parseEvidenceSnapshot(dataValue(record, 'before'), issues, `${path}.before`) || undefined;
    if (!before) return null;
  }
  if (hasOwn(record, 'after')) {
    after = parseEvidenceSnapshot(dataValue(record, 'after'), issues, `${path}.after`) || undefined;
    if (!after) return null;
  }

  if (
    evidenceId === null ||
    organizationId === null ||
    fromVersion === null ||
    toVersion === null ||
    changeKind === null ||
    !CHANGE_KIND_SET.has(changeKind) ||
    targetLogicalId === null
  ) {
    return null;
  }

  if (changeKind === 'widen_grant_classes' && !fieldClassesAdded) {
    issues.push(
      issue('evidencia_inexacta', `${path}.fieldClassesAdded`, 'widen_grant_classes requires fieldClassesAdded')
    );
  }
  if (changeKind === 'narrow_restriction_classes' && !fieldClassesRemoved) {
    issues.push(
      issue(
        'evidencia_inexacta',
        `${path}.fieldClassesRemoved`,
        'narrow_restriction_classes requires fieldClassesRemoved'
      )
    );
  }
  if (changeKind === 'narrow_grant_classes' && !fieldClassesRemoved) {
    issues.push(
      issue('evidencia_inexacta', `${path}.fieldClassesRemoved`, 'narrow_grant_classes requires fieldClassesRemoved')
    );
  }

  return {
    evidenceId,
    organizationId,
    fromVersion,
    toVersion,
    changeKind: changeKind as CrmReadPolicyChangeKind,
    targetLogicalId,
    fieldClassesAdded,
    fieldClassesRemoved,
    before,
    after,
  };
}

function parseEvidenceSnapshot(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): CrmReadPolicyEvidenceSnapshot | null {
  const record = ownDataRecord(value);
  if (!record) {
    issues.push(issue('entrada_invalida', path, 'snapshot must be an own plain object'));
    return null;
  }
  const snapshot: CrmReadPolicyEvidenceSnapshot = {};
  if (hasOwn(record, 'membershipId')) {
    const membershipId = readNonEmptyString(record, 'membershipId', issues, `${path}.membershipId`);
    if (!membershipId) return null;
    snapshot.membershipId = membershipId;
  }
  if (hasOwn(record, 'scopeKind')) {
    const scopeKind = readNonEmptyString(record, 'scopeKind', issues, `${path}.scopeKind`);
    if (scopeKind !== 'company' && scopeKind !== 'record') {
      issues.push(issue('entrada_invalida', `${path}.scopeKind`, 'scopeKind must be company or record'));
      return null;
    }
    snapshot.scopeKind = scopeKind;
  }
  if (hasOwn(record, 'scopeLeadId')) {
    const raw = dataValue(record, 'scopeLeadId');
    if (raw === null) snapshot.scopeLeadId = null;
    else if (typeof raw === 'string') snapshot.scopeLeadId = raw;
    else {
      issues.push(issue('entrada_invalida', `${path}.scopeLeadId`, 'scopeLeadId must be string or null'));
      return null;
    }
  }
  if (hasOwn(record, 'fieldClasses')) {
    const parsed = parseFieldClasses(dataValue(record, 'fieldClasses'), issues, `${path}.fieldClasses`);
    if (!parsed) return null;
    snapshot.fieldClasses = parsed;
  }
  for (const key of ['validFrom', 'validUntil'] as const) {
    if (!hasOwn(record, key)) continue;
    const raw = dataValue(record, key);
    if (raw === null) snapshot[key] = null;
    else if (typeof raw === 'string') {
      if (parseInstant(raw) === null) {
        issues.push(issue('ventana_invalida', `${path}.${key}`, 'instant must be a real UTC string'));
        return null;
      }
      snapshot[key] = raw;
    } else {
      issues.push(issue('entrada_invalida', `${path}.${key}`, 'must be string or null'));
      return null;
    }
  }
  for (const key of ['parentVersionId', 'grantVersion', 'requiredParentVersion'] as const) {
    if (!hasOwn(record, key)) continue;
    const raw = dataValue(record, key);
    if (raw === null) snapshot[key] = null;
    else if (typeof raw === 'string') snapshot[key] = raw;
    else {
      issues.push(issue('entrada_invalida', `${path}.${key}`, 'must be string or null'));
      return null;
    }
  }
  if (hasOwn(record, 'originKind')) {
    const kind = readNonEmptyString(record, 'originKind', issues, `${path}.originKind`);
    if (!kind || !ORIGIN_KIND_SET.has(kind)) {
      issues.push(issue('origen_invalido', `${path}.originKind`, 'unknown origin kind'));
      return null;
    }
    snapshot.originKind = kind as CrmReadPolicyOriginKind;
  }
  if (hasOwn(record, 'originRootValidated')) {
    const raw = dataValue(record, 'originRootValidated');
    if (typeof raw !== 'boolean') {
      issues.push(issue('entrada_invalida', `${path}.originRootValidated`, 'must be boolean'));
      return null;
    }
    snapshot.originRootValidated = raw;
  }
  if (hasOwn(record, 'originRevoked')) {
    const raw = dataValue(record, 'originRevoked');
    if (typeof raw !== 'boolean') {
      issues.push(issue('entrada_invalida', `${path}.originRevoked`, 'must be boolean'));
      return null;
    }
    snapshot.originRevoked = raw;
  }
  if (hasOwn(record, 'validity')) {
    const validity = readNonEmptyString(record, 'validity', issues, `${path}.validity`);
    if (!validity) return null;
    snapshot.validity = validity;
  }
  return snapshot;
}

/**
 * Succession rules (final):
 * - Compare set differences explicitly (added = next\prior, removed = prior\next).
 * - Evidence must satisfy the per-changeKind contract (required/admitted fields)
 *   and match the real object fingerprint or delta; contradictory snapshots fail.
 * - Restriction weakening always runs auto-lift checks.
 * - Revoked/invalidated logical grants cannot become active again.
 * - Every evidence row must correspond to a real change on an existing object.
 */
function checkSuccessionSemantics(
  reference: ParsedBundle,
  candidate: ParsedBundle,
  evidence: CrmReadPolicyChangeEvidence[],
  authority: AuthorityContext,
  issues: CrmReadPolicyFormatIssue[]
) {
  const evidenceByTarget = new Map<string, CrmReadPolicyChangeEvidence[]>();
  const consumed = new Set<string>();
  for (const row of evidence) {
    const shapeIssues = evidenceContractIssues(row);
    for (const item of shapeIssues) issues.push(item);
    const list = evidenceByTarget.get(row.targetLogicalId) || [];
    list.push(row);
    evidenceByTarget.set(row.targetLogicalId, list);
  }

  for (const retiredId of reference.retiredGrantLogicalIds) {
    if (!candidate.retiredGrantLogicalIds.has(retiredId)) {
      issues.push(
        issue(
          'historial_retirado_omitido',
          'candidate.retiredGrantLogicalIds',
          `retired grant logicalId ${retiredId} cannot disappear in succession`
        )
      );
    }
  }

  for (const prior of reference.restrictions) {
    if (prior.validity !== 'active') continue;
    const next = candidate.restrictionsByLogicalId.get(prior.logicalId);
    const related = evidenceByTarget.get(prior.logicalId) || [];

    if (!next || next.validity === 'lifted') {
      const lift = related.find((row) => matchesLiftRestrictionEvidence(row, prior));
      if (!lift) {
        issues.push(
          issue(
            'restriccion_omitida_sin_evidencia',
            `restriction:${prior.logicalId}`,
            'active restriction omitted/lifted without exact lift evidence'
          )
        );
      } else {
        consumed.add(lift.evidenceId);
        assertLiftAuthority(prior.membershipId, authority, issues, prior.logicalId);
      }
      continue;
    }

    if (next.validity !== 'active') continue;

    if (prior.membershipId !== next.membershipId || !sameScope(prior.scope, next.scope)) {
      issues.push(
        issue(
          'restriccion_omitida_sin_evidencia',
          `restriction:${prior.logicalId}`,
          'active restriction recipient/scope mutated; omit+add or lift with evidence required'
        )
      );
      continue;
    }

    const removed = setDifference(prior.fieldClasses, next.fieldClasses);
    if (removed.length > 0) {
      const narrow = related.find((row) =>
        matchesNarrowRestrictionEvidence(row, prior, next, removed)
      );
      if (!narrow) {
        issues.push(
          issue(
            'restriccion_reducida_sin_evidencia',
            `restriction:${prior.logicalId}`,
            'restriction classes removed without exact narrow evidence'
          )
        );
      } else {
        consumed.add(narrow.evidenceId);
        assertLiftAuthority(prior.membershipId, authority, issues, prior.logicalId);
      }
    }
  }

  for (const prior of reference.grants) {
    const next = candidate.grantsByLogicalId.get(prior.logicalId);
    const related = evidenceByTarget.get(prior.logicalId) || [];

    if (prior.validity === 'revoked' || prior.validity === 'invalidated') {
      if (!candidate.retiredGrantLogicalIds.has(prior.logicalId)) {
        issues.push(
          issue(
            'historial_retirado_omitido',
            `grant:${prior.logicalId}`,
            'revoked/invalidated identity must remain in candidate retiredGrantLogicalIds'
          )
        );
      }
      if (next && next.validity === 'active') {
        issues.push(
          issue(
            'reactivacion_invalida',
            `grant:${prior.logicalId}`,
            'revoked or invalidated grant must not reappear as the same logical active grant'
          )
        );
      }
      continue;
    }
    if (prior.validity !== 'active') continue;

    if (!next) {
      const covered = related.find((row) => matchesGrantRemovalEvidence(row, prior));
      if (!covered) {
        issues.push(
          issue('ampliacion_sin_evidencia', `grant:${prior.logicalId}`, 'active grant removed without evidence')
        );
      } else {
        consumed.add(covered.evidenceId);
        if (!candidate.retiredGrantLogicalIds.has(prior.logicalId)) {
          issues.push(
            issue(
              'historial_retirado_incoherente',
              `grant:${prior.logicalId}`,
              'removing/revoking a grant must list its logicalId in candidate retiredGrantLogicalIds'
            )
          );
        }
      }
      continue;
    }

    if (next.validity === 'revoked' || next.validity === 'invalidated') {
      const covered = related.find(
        (row) =>
          (row.changeKind === 'revoke_grant' || row.changeKind === 'invalidate_grant') &&
          matchesGrantRemovalEvidence(row, prior)
      );
      if (!covered) {
        issues.push(
          issue(
            'ampliacion_sin_evidencia',
            `grant:${prior.logicalId}`,
            'grant validity tightened without evidence'
          )
        );
      } else {
        consumed.add(covered.evidenceId);
        if (!candidate.retiredGrantLogicalIds.has(prior.logicalId)) {
          issues.push(
            issue(
              'historial_retirado_incoherente',
              `grant:${prior.logicalId}`,
              'revoking/invalidating a grant must list its logicalId in candidate retiredGrantLogicalIds'
            )
          );
        }
      }
      continue;
    }

    if (prior.membershipId !== next.membershipId) {
      const reassign = related.find((row) => matchesReassignEvidence(row, prior, next));
      if (!reassign) {
        issues.push(
          issue(
            'ampliacion_sin_evidencia',
            `grant:${prior.logicalId}`,
            'membership change on same logicalId requires reassign_grant evidence or a new logical grant'
          )
        );
      } else {
        consumed.add(reassign.evidenceId);
      }
    }

    const addedClasses = setDifference(next.fieldClasses, prior.fieldClasses);
    const removedClasses = setDifference(prior.fieldClasses, next.fieldClasses);
    if (addedClasses.length > 0) {
      const widen = related.find((row) => matchesWidenGrantClassesEvidence(row, prior, next, addedClasses));
      if (!widen) {
        issues.push(
          issue(
            'ampliacion_sin_evidencia',
            `grant:${prior.logicalId}`,
            'grant classes added without exact widen_grant_classes evidence'
          )
        );
      } else {
        consumed.add(widen.evidenceId);
      }
      for (const row of related) {
        if (row.changeKind !== 'widen_grant_classes') continue;
        if (matchesWidenGrantClassesEvidence(row, prior, next, addedClasses)) continue;
        issues.push(
          issue(
            'evidencia_inexacta',
            `changeEvidence.${row.evidenceId}`,
            'widen_grant_classes evidence does not match the real class delta/snapshots'
          )
        );
      }
    }
    if (removedClasses.length > 0) {
      const narrow = related.find((row) => matchesNarrowGrantClassesEvidence(row, prior, next, removedClasses));
      if (!narrow) {
        issues.push(
          issue(
            'ampliacion_sin_evidencia',
            `grant:${prior.logicalId}`,
            'grant classes removed without exact narrow_grant_classes evidence'
          )
        );
      } else {
        consumed.add(narrow.evidenceId);
      }
    }

    if (scopeWidened(prior.scope, next.scope)) {
      const widen = related.find((row) => matchesWidenScopeEvidence(row, prior, next));
      if (!widen) {
        issues.push(
          issue(
            'ampliacion_sin_evidencia',
            `grant:${prior.logicalId}`,
            'grant scope widened without exact widen_grant_scope evidence'
          )
        );
      } else {
        consumed.add(widen.evidenceId);
      }
    } else if (!sameScope(prior.scope, next.scope)) {
      issues.push(
        issue(
          'ampliacion_sin_evidencia',
          `grant:${prior.logicalId}`,
          'grant scope changed without documented evidence'
        )
      );
    }

    if (windowWidened(prior, next)) {
      const extend = related.find((row) => matchesExtendWindowEvidence(row, prior, next));
      if (!extend) {
        issues.push(
          issue(
            'ampliacion_sin_evidencia',
            `grant:${prior.logicalId}`,
            'grant validity window widened without exact extend_grant_window evidence'
          )
        );
      } else {
        consumed.add(extend.evidenceId);
      }
    }

    if (prior.parentVersionId !== next.parentVersionId) {
      const change = related.find((row) => matchesChangeParentEvidence(row, prior, next));
      if (!change) {
        issues.push(
          issue(
            'ampliacion_sin_evidencia',
            `grant:${prior.logicalId}`,
            'grant parent changed without change_grant_parent evidence'
          )
        );
      } else {
        consumed.add(change.evidenceId);
      }
    }

    if (versionConditionRelaxed(prior, next)) {
      const change = related.find((row) => matchesChangeParentEvidence(row, prior, next));
      if (!change) {
        issues.push(
          issue(
            'ampliacion_sin_evidencia',
            `grant:${prior.logicalId}`,
            'grant version conditions relaxed without evidence'
          )
        );
      } else {
        consumed.add(change.evidenceId);
      }
    }

    if (originWidened(prior.origin, next.origin) || originIdentityChanged(prior.origin, next.origin)) {
      const change = related.find((row) => matchesChangeOriginEvidence(row, prior, next));
      if (!change) {
        issues.push(
          issue(
            'ampliacion_sin_evidencia',
            `grant:${prior.logicalId}`,
            'grant origin changed or widened without change_grant_origin evidence'
          )
        );
      } else {
        consumed.add(change.evidenceId);
      }
    }
  }

  for (const next of candidate.grants) {
    if (reference.grantsByLogicalId.has(next.logicalId)) continue;
    if (next.validity !== 'active') continue;
    if (
      reference.retiredGrantLogicalIds.has(next.logicalId) ||
      candidate.retiredGrantLogicalIds.has(next.logicalId)
    ) {
      issues.push(
        issue(
          'reactivacion_invalida',
          `grant:${next.logicalId}`,
          'retired grant logicalId cannot be introduced as a new active grant'
        )
      );
      continue;
    }
    const related = evidenceByTarget.get(next.logicalId) || [];
    const add = related.find((row) => matchesAddGrantEvidence(row, next));
    if (!add) {
      issues.push(
        issue(
          'ampliacion_sin_evidencia',
          `grant:${next.logicalId}`,
          'new independent active grant requires exact add_grant evidence'
        )
      );
    } else {
      consumed.add(add.evidenceId);
    }
  }

  for (const next of candidate.restrictions) {
    if (reference.restrictionsByLogicalId.has(next.logicalId)) continue;
    if (next.validity !== 'active') continue;
    const related = evidenceByTarget.get(next.logicalId) || [];
    const add = related.find((row) => matchesAddRestrictionEvidence(row, next));
    if (!add) {
      issues.push(
        issue(
          'ampliacion_sin_evidencia',
          `restriction:${next.logicalId}`,
          'new active restriction requires exact add_restriction evidence'
        )
      );
    } else {
      consumed.add(add.evidenceId);
    }
  }

  for (const row of evidence) {
    if (consumed.has(row.evidenceId)) continue;
    if (evidenceContractIssues(row).length > 0) continue;
    const existsInReference =
      reference.grantsByLogicalId.has(row.targetLogicalId) ||
      reference.restrictionsByLogicalId.has(row.targetLogicalId);
    const existsInCandidate =
      candidate.grantsByLogicalId.has(row.targetLogicalId) ||
      candidate.restrictionsByLogicalId.has(row.targetLogicalId);
    if (!existsInReference && !existsInCandidate) {
      issues.push(
        issue(
          'objeto_inexistente',
          `changeEvidence.${row.evidenceId}`,
          'evidence targets a logical id absent from reference and candidate'
        )
      );
      continue;
    }
    issues.push(
      issue(
        'evidencia_inexacta',
        `changeEvidence.${row.evidenceId}`,
        'evidence does not correspond to a real succession change'
      )
    );
  }
}

function evidenceContractIssues(row: CrmReadPolicyChangeEvidence): CrmReadPolicyFormatIssue[] {
  const path = `changeEvidence.${row.evidenceId}`;
  const issues: CrmReadPolicyFormatIssue[] = [];
  const hasAdded = row.fieldClassesAdded !== undefined;
  const hasRemoved = row.fieldClassesRemoved !== undefined;
  switch (row.changeKind) {
    case 'add_grant':
    case 'add_restriction':
      if (!row.after) issues.push(issue('evidencia_inexacta', path, `${row.changeKind} requires after fingerprint`));
      if (row.before) issues.push(issue('evidencia_inexacta', path, `${row.changeKind} forbids before`));
      if (hasAdded || hasRemoved) {
        issues.push(issue('evidencia_inexacta', path, `${row.changeKind} forbids class delta fields`));
      }
      break;
    case 'lift_restriction':
    case 'remove_grant':
    case 'revoke_grant':
    case 'invalidate_grant':
      if (!row.before) issues.push(issue('evidencia_inexacta', path, `${row.changeKind} requires before fingerprint`));
      if (row.after) issues.push(issue('evidencia_inexacta', path, `${row.changeKind} forbids after`));
      if (hasAdded || hasRemoved) {
        issues.push(issue('evidencia_inexacta', path, `${row.changeKind} forbids class delta fields`));
      }
      break;
    case 'widen_grant_classes':
      if (!hasAdded) issues.push(issue('evidencia_inexacta', path, 'widen_grant_classes requires fieldClassesAdded'));
      if (hasRemoved) issues.push(issue('evidencia_inexacta', path, 'widen_grant_classes forbids fieldClassesRemoved'));
      issues.push(...classDeltaSnapshotAdmissionIssues(row, path));
      break;
    case 'narrow_grant_classes':
    case 'narrow_restriction_classes':
      if (!hasRemoved) {
        issues.push(issue('evidencia_inexacta', path, `${row.changeKind} requires fieldClassesRemoved`));
      }
      if (hasAdded) issues.push(issue('evidencia_inexacta', path, `${row.changeKind} forbids fieldClassesAdded`));
      issues.push(...classDeltaSnapshotAdmissionIssues(row, path));
      break;
    case 'reassign_grant':
      if (!row.before?.membershipId || !row.after?.membershipId) {
        issues.push(issue('evidencia_inexacta', path, 'reassign_grant requires before/after membershipId'));
      }
      issues.push(...forbidClassDeltas(row, path));
      issues.push(...admitOnlySnapshotKeys(row.before, path + '.before', ['membershipId']));
      issues.push(...admitOnlySnapshotKeys(row.after, path + '.after', ['membershipId']));
      break;
    case 'widen_grant_scope':
      if (!row.before || !row.after) {
        issues.push(issue('evidencia_inexacta', path, 'widen_grant_scope requires before/after scope'));
      }
      issues.push(...forbidClassDeltas(row, path));
      issues.push(...admitOnlySnapshotKeys(row.before, path + '.before', ['scopeKind', 'scopeLeadId']));
      issues.push(...admitOnlySnapshotKeys(row.after, path + '.after', ['scopeKind', 'scopeLeadId']));
      break;
    case 'extend_grant_window':
      if (!row.before || !row.after) {
        issues.push(issue('evidencia_inexacta', path, 'extend_grant_window requires before/after window'));
      }
      issues.push(...forbidClassDeltas(row, path));
      issues.push(...admitOnlySnapshotKeys(row.before, path + '.before', ['validFrom', 'validUntil']));
      issues.push(...admitOnlySnapshotKeys(row.after, path + '.after', ['validFrom', 'validUntil']));
      break;
    case 'change_grant_parent':
      if (!row.before || !row.after) {
        issues.push(issue('evidencia_inexacta', path, 'change_grant_parent requires before/after'));
      }
      issues.push(...forbidClassDeltas(row, path));
      issues.push(
        ...admitOnlySnapshotKeys(row.before, path + '.before', [
          'parentVersionId',
          'grantVersion',
          'requiredParentVersion',
        ])
      );
      issues.push(
        ...admitOnlySnapshotKeys(row.after, path + '.after', [
          'parentVersionId',
          'grantVersion',
          'requiredParentVersion',
        ])
      );
      break;
    case 'change_grant_origin':
      if (!row.before || !row.after) {
        issues.push(issue('evidencia_inexacta', path, 'change_grant_origin requires before/after origin'));
      }
      issues.push(...forbidClassDeltas(row, path));
      issues.push(
        ...admitOnlySnapshotKeys(row.before, path + '.before', [
          'originKind',
          'originRootValidated',
          'originRevoked',
        ])
      );
      issues.push(
        ...admitOnlySnapshotKeys(row.after, path + '.after', [
          'originKind',
          'originRootValidated',
          'originRevoked',
        ])
      );
      break;
    default:
      break;
  }
  return issues;
}

function forbidClassDeltas(
  row: CrmReadPolicyChangeEvidence,
  path: string
): CrmReadPolicyFormatIssue[] {
  const issues: CrmReadPolicyFormatIssue[] = [];
  if (row.fieldClassesAdded !== undefined || row.fieldClassesRemoved !== undefined) {
    issues.push(issue('evidencia_inexacta', path, 'class delta fields are not admitted for this changeKind'));
  }
  return issues;
}

function classDeltaSnapshotAdmissionIssues(
  row: CrmReadPolicyChangeEvidence,
  path: string
): CrmReadPolicyFormatIssue[] {
  return [
    ...admitOnlySnapshotKeys(row.before, `${path}.before`, ['fieldClasses']),
    ...admitOnlySnapshotKeys(row.after, `${path}.after`, ['fieldClasses']),
  ];
}

function admitOnlySnapshotKeys(
  snapshot: CrmReadPolicyEvidenceSnapshot | undefined,
  path: string,
  allowed: string[]
): CrmReadPolicyFormatIssue[] {
  if (!snapshot) return [];
  const allowedSet = new Set(allowed);
  const keys = Object.keys(snapshot);
  const issues: CrmReadPolicyFormatIssue[] = [];
  for (const key of keys) {
    if (!allowedSet.has(key)) {
      issues.push(issue('evidencia_inexacta', path, `field ${key} is not admitted for this changeKind`));
    }
  }
  return issues;
}

function evidenceContractOk(row: CrmReadPolicyChangeEvidence): boolean {
  return evidenceContractIssues(row).length === 0;
}

function matchesAddGrantEvidence(row: CrmReadPolicyChangeEvidence, grant: ParsedGrant): boolean {
  if (row.changeKind !== 'add_grant' || !evidenceContractOk(row)) return false;
  return snapshotMatchesGrantFingerprint(row.after, grant);
}

function matchesAddRestrictionEvidence(
  row: CrmReadPolicyChangeEvidence,
  restriction: ParsedRestriction
): boolean {
  if (row.changeKind !== 'add_restriction' || !evidenceContractOk(row)) return false;
  return snapshotMatchesRestrictionFingerprint(row.after, restriction);
}

function matchesLiftRestrictionEvidence(
  row: CrmReadPolicyChangeEvidence,
  restriction: ParsedRestriction
): boolean {
  if (row.changeKind !== 'lift_restriction' || !evidenceContractOk(row)) return false;
  return snapshotMatchesRestrictionFingerprint(row.before, restriction);
}

function matchesGrantRemovalEvidence(row: CrmReadPolicyChangeEvidence, grant: ParsedGrant): boolean {
  if (
    row.changeKind !== 'remove_grant' &&
    row.changeKind !== 'revoke_grant' &&
    row.changeKind !== 'invalidate_grant'
  ) {
    return false;
  }
  if (!evidenceContractOk(row)) return false;
  return snapshotMatchesGrantFingerprint(row.before, grant);
}

function matchesWidenGrantClassesEvidence(
  row: CrmReadPolicyChangeEvidence,
  prior: ParsedGrant,
  next: ParsedGrant,
  added: string[]
): boolean {
  if (row.changeKind !== 'widen_grant_classes' || !evidenceContractOk(row)) return false;
  if (!sameStringSet(row.fieldClassesAdded || [], added)) return false;
  if (row.before?.fieldClasses && !sameStringSet(row.before.fieldClasses, prior.fieldClasses)) return false;
  if (row.after?.fieldClasses && !sameStringSet(row.after.fieldClasses, next.fieldClasses)) return false;
  return true;
}

function matchesNarrowGrantClassesEvidence(
  row: CrmReadPolicyChangeEvidence,
  prior: ParsedGrant,
  next: ParsedGrant,
  removed: string[]
): boolean {
  if (row.changeKind !== 'narrow_grant_classes' || !evidenceContractOk(row)) return false;
  if (!sameStringSet(row.fieldClassesRemoved || [], removed)) return false;
  if (row.before?.fieldClasses && !sameStringSet(row.before.fieldClasses, prior.fieldClasses)) return false;
  if (row.after?.fieldClasses && !sameStringSet(row.after.fieldClasses, next.fieldClasses)) return false;
  return true;
}

function matchesNarrowRestrictionEvidence(
  row: CrmReadPolicyChangeEvidence,
  prior: ParsedRestriction,
  next: ParsedRestriction,
  removed: string[]
): boolean {
  if (row.changeKind !== 'narrow_restriction_classes' || !evidenceContractOk(row)) return false;
  if (!sameStringSet(row.fieldClassesRemoved || [], removed)) return false;
  if (row.before?.fieldClasses && !sameStringSet(row.before.fieldClasses, prior.fieldClasses)) return false;
  if (row.after?.fieldClasses && !sameStringSet(row.after.fieldClasses, next.fieldClasses)) return false;
  return true;
}

function matchesReassignEvidence(
  row: CrmReadPolicyChangeEvidence,
  prior: ParsedGrant,
  next: ParsedGrant
): boolean {
  if (row.changeKind !== 'reassign_grant' || !evidenceContractOk(row)) return false;
  return row.before?.membershipId === prior.membershipId && row.after?.membershipId === next.membershipId;
}

function matchesWidenScopeEvidence(
  row: CrmReadPolicyChangeEvidence,
  prior: ParsedGrant,
  next: ParsedGrant
): boolean {
  if (row.changeKind !== 'widen_grant_scope' || !evidenceContractOk(row)) return false;
  return snapshotMatchesScope(row.before, prior.scope) && snapshotMatchesScope(row.after, next.scope);
}

function matchesExtendWindowEvidence(
  row: CrmReadPolicyChangeEvidence,
  prior: ParsedGrant,
  next: ParsedGrant
): boolean {
  if (row.changeKind !== 'extend_grant_window' || !evidenceContractOk(row)) return false;
  return snapshotMatchesWindow(row.before, prior) && snapshotMatchesWindow(row.after, next);
}

function matchesChangeParentEvidence(
  row: CrmReadPolicyChangeEvidence,
  prior: ParsedGrant,
  next: ParsedGrant
): boolean {
  if (row.changeKind !== 'change_grant_parent' || !evidenceContractOk(row)) return false;
  return (
    (row.before?.parentVersionId ?? null) === prior.parentVersionId &&
    (row.after?.parentVersionId ?? null) === next.parentVersionId &&
    (row.before?.grantVersion ?? null) === prior.grantVersion &&
    (row.after?.grantVersion ?? null) === next.grantVersion &&
    (row.before?.requiredParentVersion ?? null) === prior.requiredParentVersion &&
    (row.after?.requiredParentVersion ?? null) === next.requiredParentVersion
  );
}

function matchesChangeOriginEvidence(
  row: CrmReadPolicyChangeEvidence,
  prior: ParsedGrant,
  next: ParsedGrant
): boolean {
  if (row.changeKind !== 'change_grant_origin' || !evidenceContractOk(row)) return false;
  return snapshotMatchesOrigin(row.before, prior.origin) && snapshotMatchesOrigin(row.after, next.origin);
}

function snapshotMatchesGrantFingerprint(
  snapshot: CrmReadPolicyEvidenceSnapshot | undefined,
  grant: ParsedGrant
): boolean {
  if (!snapshot) return false;
  if (snapshot.membershipId !== grant.membershipId) return false;
  if (!snapshot.fieldClasses || !sameStringSet(snapshot.fieldClasses, grant.fieldClasses)) return false;
  if (snapshot.scopeKind !== grant.scope.kind) return false;
  if (!snapshotMatchesScope(snapshot, grant.scope)) return false;
  return true;
}

function snapshotMatchesRestrictionFingerprint(
  snapshot: CrmReadPolicyEvidenceSnapshot | undefined,
  restriction: ParsedRestriction
): boolean {
  if (!snapshot) return false;
  if (snapshot.membershipId !== restriction.membershipId) return false;
  if (!snapshot.fieldClasses || !sameStringSet(snapshot.fieldClasses, restriction.fieldClasses)) return false;
  if (snapshot.scopeKind !== restriction.scope.kind) return false;
  if (!snapshotMatchesScope(snapshot, restriction.scope)) return false;
  return true;
}

function setDifference(from: readonly string[], without: readonly string[]): string[] {
  const exclude = new Set(without);
  const out: string[] = [];
  for (const item of from) {
    if (!exclude.has(item)) out.push(item);
  }
  return out.sort(compareString);
}

function snapshotMatchesScope(
  snapshot: CrmReadPolicyEvidenceSnapshot | undefined,
  scope: ParsedScope
): boolean {
  if (!snapshot || snapshot.scopeKind !== scope.kind) return false;
  if (scope.kind === 'company') return snapshot.scopeLeadId == null;
  return snapshot.scopeLeadId === scope.leadId;
}

function snapshotMatchesWindow(
  snapshot: CrmReadPolicyEvidenceSnapshot | undefined,
  grant: ParsedGrant
): boolean {
  if (!snapshot) return false;
  if (!('validFrom' in snapshot) || !('validUntil' in snapshot)) return false;
  const from = snapshot.validFrom === null || snapshot.validFrom === undefined ? null : parseInstant(snapshot.validFrom);
  const until =
    snapshot.validUntil === null || snapshot.validUntil === undefined ? null : parseInstant(snapshot.validUntil);
  if (snapshot.validFrom !== null && snapshot.validFrom !== undefined && from === null) return false;
  if (snapshot.validUntil !== null && snapshot.validUntil !== undefined && until === null) return false;
  return from === grant.validFrom && until === grant.validUntil;
}

function snapshotMatchesOrigin(
  snapshot: CrmReadPolicyEvidenceSnapshot | undefined,
  origin: ParsedOrigin
): boolean {
  if (!snapshot) return false;
  return (
    snapshot.originKind === origin.kind &&
    snapshot.originRootValidated === origin.rootValidated &&
    snapshot.originRevoked === origin.revoked
  );
}

function windowWidened(prior: ParsedGrant, next: ParsedGrant): boolean {
  // Removing an upper bound or moving it later widens access.
  if (prior.validUntil !== null && next.validUntil === null) return true;
  if (
    prior.validUntil !== null &&
    next.validUntil !== null &&
    next.validUntil > prior.validUntil
  ) {
    return true;
  }
  // Removing a lower bound or moving it earlier widens access.
  if (prior.validFrom !== null && next.validFrom === null) return true;
  if (prior.validFrom !== null && next.validFrom !== null && next.validFrom < prior.validFrom) {
    return true;
  }
  return false;
}

function versionConditionRelaxed(prior: ParsedGrant, next: ParsedGrant): boolean {
  if (prior.requiredParentVersion !== null && next.requiredParentVersion === null) return true;
  if (
    prior.requiredParentVersion !== null &&
    next.requiredParentVersion !== null &&
    prior.requiredParentVersion !== next.requiredParentVersion
  ) {
    return true;
  }
  if (prior.grantVersion !== next.grantVersion) return true;
  return false;
}

function originWidened(prior: ParsedOrigin, next: ParsedOrigin): boolean {
  if (prior.rootValidated === false && next.rootValidated === true) return true;
  if (prior.revoked === true && next.revoked === false) return true;
  return false;
}

function originIdentityChanged(prior: ParsedOrigin, next: ParsedOrigin): boolean {
  return (
    prior.kind !== next.kind ||
    prior.organizationId !== next.organizationId ||
    prior.rootValidated !== next.rootValidated ||
    prior.revoked !== next.revoked
  );
}

function assertLiftAuthority(
  targetMembershipId: string,
  authority: AuthorityContext,
  issues: CrmReadPolicyFormatIssue[],
  logicalId: string
) {
  if (authority.representedMembershipIds.includes(targetMembershipId)) {
    issues.push(
      issue('auto_levantamiento', `restriction:${logicalId}`, 'direct self-lift is rejected')
    );
    return;
  }
  if (authority.authorityChainMembershipIds.includes(targetMembershipId)) {
    issues.push(
      issue('auto_levantamiento', `restriction:${logicalId}`, 'indirect self-lift via authority chain is rejected')
    );
  }
}

function computeBundleChecksum(bundle: ParsedBundle): string {
  const grants = bundle.grants
    .slice()
    .sort((a, b) => compareString(a.logicalId, b.logicalId) || compareString(a.versionId, b.versionId))
    .map((grant) => ({
      logicalId: grant.logicalId,
      versionId: grant.versionId,
      organizationId: grant.organizationId,
      membershipId: grant.membershipId,
      action: grant.action,
      accessMode: grant.accessMode,
      scope: scopeCanonical(grant.scope),
      fieldClasses: grant.fieldClasses.slice().sort(compareString),
      validity: grant.validity,
      parentVersionId: grant.parentVersionId,
      origin: {
        kind: grant.origin.kind,
        organizationId: grant.origin.organizationId,
        rootValidated: grant.origin.rootValidated,
        revoked: grant.origin.revoked,
      },
      grantVersion: grant.grantVersion,
      requiredParentVersion: grant.requiredParentVersion,
      validFrom: grant.validFrom,
      validUntil: grant.validUntil,
    }));

  const restrictions = bundle.restrictions
    .slice()
    .sort((a, b) => compareString(a.logicalId, b.logicalId) || compareString(a.versionId, b.versionId))
    .map((restriction) => ({
      logicalId: restriction.logicalId,
      versionId: restriction.versionId,
      organizationId: restriction.organizationId,
      membershipId: restriction.membershipId,
      action: restriction.action,
      scope: scopeCanonical(restriction.scope),
      fieldClasses: restriction.fieldClasses.slice().sort(compareString),
      validity: restriction.validity,
      authorMembershipId: restriction.authorMembershipId,
    }));

  const canonical = {
    canonicalVersion: CRM_READ_POLICY_CANONICAL_VERSION,
    organizationId: bundle.organizationId,
    version: bundle.version,
    membershipIds: Array.from(bundle.membershipIds).sort(compareString),
    leadIds: Array.from(bundle.leadIds).sort(compareString),
    retiredGrantLogicalIds: Array.from(bundle.retiredGrantLogicalIds).sort(compareString),
    grants,
    restrictions,
  };

  return `${CRM_READ_POLICY_CANONICAL_VERSION}:${fnv1aHex(canonicalizeJson(canonical))}`;
}

function scopeCanonical(scope: ParsedScope): { kind: string; leadId?: string } {
  if (scope.kind === 'company') return { kind: 'company' };
  return { kind: 'record', leadId: scope.leadId };
}

function canonicalizeJson(value: unknown): string {
  if (value === null) return 'null';
  const valueType = typeof value;
  if (valueType === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonical number must be finite');
    return String(value);
  }
  if (valueType === 'boolean') return value ? 'true' : 'false';
  if (valueType === 'string') return JSON.stringify(value);
  if (nativeArrayIsArray(value)) {
    const parts: string[] = ['['];
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) parts.push(',');
      parts.push(canonicalizeJson(value[index]));
    }
    parts.push(']');
    return parts.join('');
  }
  if (valueType === 'object') {
    const record = value as OwnRecord;
    const keys = nativeGetOwnPropertyNames(record).sort(compareString);
    const parts: string[] = ['{'];
    for (let index = 0; index < keys.length; index += 1) {
      if (index > 0) parts.push(',');
      const key = keys[index];
      parts.push(JSON.stringify(key));
      parts.push(':');
      parts.push(canonicalizeJson(record[key]));
    }
    parts.push('}');
    return parts.join('');
  }
  throw new Error('unsupported canonical value');
}

function fnv1aHex(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function readPresentArray(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): unknown[] | null {
  if (value === undefined) {
    issues.push(issue('coleccion_ausente', path, 'collection is absent'));
    return null;
  }
  const copy = copyPlainArray(value);
  if (!copy) {
    issues.push(issue('entrada_invalida', path, 'collection must be a plain dense array'));
    return null;
  }
  return copy;
}

function readIdSet(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): Set<string> | null {
  const items = readPresentArray(value, issues, path);
  if (!items) return null;
  const set = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (typeof item !== 'string' || item.length === 0) {
      issues.push(issue('entrada_invalida', `${path}[${index}]`, 'id must be non-empty string'));
      return null;
    }
    if (set.has(item)) {
      issues.push(issue('entrada_invalida', `${path}[${index}]`, 'duplicate id'));
      return null;
    }
    set.add(item);
  }
  return set;
}

function readIdList(
  value: unknown,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): string[] | null {
  const items = readPresentArray(value, issues, path);
  if (!items) return null;
  const list: string[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (typeof item !== 'string' || item.length === 0) {
      issues.push(issue('entrada_invalida', `${path}[${index}]`, 'id must be non-empty string'));
      return null;
    }
    list.push(item);
  }
  return list;
}

function readNonEmptyString(
  record: object,
  key: string,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): string | null {
  if (!hasOwn(record, key)) {
    issues.push(issue('coleccion_ausente', path, `${key} is absent`));
    return null;
  }
  const value = dataValue(record, key);
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(issue('entrada_invalida', path, `${key} must be a non-empty string`));
    return null;
  }
  return value;
}

function readPositiveInt(
  record: object,
  key: string,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): number | null {
  if (!hasOwn(record, key)) {
    issues.push(issue('coleccion_ausente', path, `${key} is absent`));
    return null;
  }
  const value = dataValue(record, key);
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    issues.push(issue('version_invalida', path, `${key} must be an integer >= 1`));
    return null;
  }
  return value;
}

function readOptionalString(
  record: object,
  key: string,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): string | null | 'invalid' {
  if (!hasOwn(record, key)) return null;
  const value = dataValue(record, key);
  if (value === null) return null;
  if (typeof value !== 'string') {
    issues.push(issue('entrada_invalida', path, `${key} must be string or null`));
    return 'invalid';
  }
  return value;
}

function readOptionalInstant(
  record: object,
  key: string,
  issues: CrmReadPolicyFormatIssue[],
  path: string
): number | null | 'invalid' {
  if (!hasOwn(record, key)) return null;
  const value = dataValue(record, key);
  if (value === null) return null;
  const parsed = parseInstant(value);
  if (parsed === null) {
    issues.push(issue('ventana_invalida', path, `${key} must be a real UTC instant string`));
    return 'invalid';
  }
  return parsed;
}

function parseInstant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = INSTANT_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = match[7] === undefined ? 0 : Number(match[7]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const time = nativeDateUTC(year, month - 1, day, hour, minute, second, millisecond);
  if (!Number.isFinite(time)) return null;
  const date = new NativeDate(time);
  if (nativeGetUTCFullYear.call(date) !== year) return null;
  if (nativeGetUTCMonth.call(date) !== month - 1) return null;
  if (nativeGetUTCDate.call(date) !== day) return null;
  if (nativeGetUTCHours.call(date) !== hour) return null;
  if (nativeGetUTCMinutes.call(date) !== minute) return null;
  if (nativeGetUTCSeconds.call(date) !== second) return null;
  if (nativeGetUTCMilliseconds.call(date) !== millisecond) return null;
  return time;
}

function sameScope(a: ParsedScope, b: ParsedScope): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'company' && b.kind === 'company') return true;
  if (a.kind === 'record' && b.kind === 'record') return a.leadId === b.leadId;
  return false;
}

function scopeWidened(prior: ParsedScope, next: ParsedScope): boolean {
  if (prior.kind === 'record' && next.kind === 'company') return true;
  if (prior.kind === 'record' && next.kind === 'record' && prior.leadId !== next.leadId) return true;
  return false;
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  for (const item of b) if (!set.has(item)) return false;
  return true;
}

function isSubset(subset: readonly string[], of: readonly string[]): boolean {
  const set = new Set(of);
  for (const item of subset) if (!set.has(item)) return false;
  return true;
}

function compareString(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function issue(code: CrmReadPolicyFormatIssueCode, path: string, message: string): CrmReadPolicyFormatIssue {
  return { code, path, message };
}

function isRecord(value: unknown): value is OwnRecord {
  if (value === null || typeof value !== 'object') return false;
  if (nativeArrayIsArray(value)) return false;
  const proto = nativeGetPrototypeOf(value);
  if (proto !== OBJECT_PROTOTYPE && proto !== null) return false;
  return !hasAccessor(value);
}

function ownDataRecord(value: unknown): OwnRecord | null {
  return isRecord(value) ? value : null;
}

function hasAccessor(value: object): boolean {
  const names = nativeGetOwnPropertyNames(value);
  for (let index = 0; index < names.length; index += 1) {
    const descriptor = nativeGetOwnPropertyDescriptor(value, names[index]);
    if (descriptor && (descriptor.get || descriptor.set)) return true;
  }
  const symbols = nativeGetOwnPropertySymbols(value);
  for (let index = 0; index < symbols.length; index += 1) {
    const descriptor = nativeGetOwnPropertyDescriptor(value, symbols[index]);
    if (descriptor && (descriptor.get || descriptor.set)) return true;
  }
  return false;
}

function copyPlainArray(value: unknown): unknown[] | null {
  if (!nativeArrayIsArray(value)) return null;
  if (nativeGetPrototypeOf(value) !== ARRAY_PROTOTYPE) return null;
  if (hasAccessor(value)) return null;
  const lengthDescriptor = nativeGetOwnPropertyDescriptor(value, 'length');
  if (!lengthDescriptor || typeof lengthDescriptor.value !== 'number') return null;
  const length = lengthDescriptor.value;
  if (!Number.isInteger(length) || length < 0) return null;
  const copy: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = nativeGetOwnPropertyDescriptor(value, String(index));
    if (!descriptor || descriptor.get || descriptor.set || !('value' in descriptor)) return null;
    copy.push(descriptor.value);
  }
  return copy;
}

function ownStringKeys(value: object): string[] | null {
  if (nativeGetOwnPropertySymbols(value).length > 0) return null;
  return nativeGetOwnPropertyNames(value);
}

function hasOwn(value: object, key: string): boolean {
  return nativeHasOwn.call(value, key);
}

function dataValue(record: object, key: string): unknown {
  const descriptor = nativeGetOwnPropertyDescriptor(record, key);
  if (!descriptor || descriptor.get || descriptor.set) return undefined;
  return descriptor.value;
}

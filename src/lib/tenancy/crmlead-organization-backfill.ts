/**
 * Point 8B-3 — pure planners for historical CrmLead.organizationId backfill.
 *
 * Authorized mapping for NULL rows only:
 *   CrmLead.userId → Organization.id = legacy_org_<userId>
 *
 * Never repairs Organization/Membership.
 * Never mutates non-null organizationId rows.
 * Not runtime authorization.
 */

import {
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
} from '@prisma/client';
import { buildLegacyOrganizationId } from './legacy-organization-backfill';

export type CrmLeadBackfillBlockReason =
  | 'user_missing'
  | 'organization_missing'
  | 'organization_inactive'
  | 'membership_missing'
  | 'membership_inactive'
  | 'mapping_inconsistent'
  | 'mapping_ambiguous';

export type CrmLeadOrgBackfillPlan =
  | {
      action: 'would_update';
      leadId: string;
      userId: string;
      organizationId: string;
    }
  | {
      action: 'blocked';
      leadId: string;
      userId: string;
      organizationId: string | null;
      reason: CrmLeadBackfillBlockReason;
    }
  | {
      action: 'skip_already_assigned';
      leadId: string;
      userId: string;
      organizationId: string;
    };

export type CrmLeadOrgSnapshot = {
  id: string;
  userId: string;
  organizationId: string | null;
};

export type OrgSnapshot = {
  id: string;
  status: OrganizationStatus;
} | null;

export type MembershipSnapshot = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
} | null;

/**
 * Plan a single historical NULL lead. Non-null leads must use skip_already_assigned
 * via planCrmLeadOrganizationBackfillRow (never overwritten).
 */
export function planNullCrmLeadOrganizationBackfill(params: {
  lead: CrmLeadOrgSnapshot;
  userExists: boolean;
  organization: OrgSnapshot;
  membership: MembershipSnapshot;
}): CrmLeadOrgBackfillPlan {
  const { lead } = params;
  if (lead.organizationId != null && String(lead.organizationId).trim() !== '') {
    return {
      action: 'skip_already_assigned',
      leadId: lead.id,
      userId: lead.userId,
      organizationId: String(lead.organizationId),
    };
  }

  const userId = String(lead.userId || '').trim();
  if (!userId || !params.userExists) {
    return {
      action: 'blocked',
      leadId: lead.id,
      userId: lead.userId,
      organizationId: null,
      reason: 'user_missing',
    };
  }

  let expectedOrganizationId: string;
  try {
    expectedOrganizationId = buildLegacyOrganizationId(userId);
  } catch {
    return {
      action: 'blocked',
      leadId: lead.id,
      userId,
      organizationId: null,
      reason: 'mapping_ambiguous',
    };
  }

  if (!params.organization) {
    return {
      action: 'blocked',
      leadId: lead.id,
      userId,
      organizationId: expectedOrganizationId,
      reason: 'organization_missing',
    };
  }

  if (params.organization.id !== expectedOrganizationId) {
    return {
      action: 'blocked',
      leadId: lead.id,
      userId,
      organizationId: expectedOrganizationId,
      reason: 'mapping_inconsistent',
    };
  }

  if (params.organization.status !== OrganizationStatus.ACTIVE) {
    return {
      action: 'blocked',
      leadId: lead.id,
      userId,
      organizationId: expectedOrganizationId,
      reason: 'organization_inactive',
    };
  }

  if (!params.membership) {
    return {
      action: 'blocked',
      leadId: lead.id,
      userId,
      organizationId: expectedOrganizationId,
      reason: 'membership_missing',
    };
  }

  if (
    params.membership.organizationId !== expectedOrganizationId ||
    params.membership.userId !== userId
  ) {
    return {
      action: 'blocked',
      leadId: lead.id,
      userId,
      organizationId: expectedOrganizationId,
      reason: 'mapping_inconsistent',
    };
  }

  if (params.membership.status !== MembershipStatus.ACTIVE) {
    return {
      action: 'blocked',
      leadId: lead.id,
      userId,
      organizationId: expectedOrganizationId,
      reason: 'membership_inactive',
    };
  }

  return {
    action: 'would_update',
    leadId: lead.id,
    userId,
    organizationId: expectedOrganizationId,
  };
}

export type CrmLeadOrgBackfillSummary = {
  totalCrmLeads: number;
  nullOrganizationId: number;
  alreadyAssigned: number;
  rowsWouldUpdate: number;
  missingOrganization: number;
  inactiveOrganization: number;
  missingMembership: number;
  inactiveMembership: number;
  userMissing: number;
  ambiguousInconsistentMapping: number;
  /** Non-null rows with legacy_org_* != legacy_org_<userId> */
  alreadyAssignedLegacyInconsistent: number;
  /** Non-null rows whose user lacks ACTIVE membership on lead org */
  alreadyAssignedMissingActiveMembership: number;
  /** Non-null rows whose Organization is missing (orphan) */
  alreadyAssignedOrphanOrganization: number;
  appliedUpdates: number;
};

export function emptyCrmLeadOrgBackfillSummary(): CrmLeadOrgBackfillSummary {
  return {
    totalCrmLeads: 0,
    nullOrganizationId: 0,
    alreadyAssigned: 0,
    rowsWouldUpdate: 0,
    missingOrganization: 0,
    inactiveOrganization: 0,
    missingMembership: 0,
    inactiveMembership: 0,
    userMissing: 0,
    ambiguousInconsistentMapping: 0,
    alreadyAssignedLegacyInconsistent: 0,
    alreadyAssignedMissingActiveMembership: 0,
    alreadyAssignedOrphanOrganization: 0,
    appliedUpdates: 0,
  };
}

export function recordNullPlan(summary: CrmLeadOrgBackfillSummary, plan: CrmLeadOrgBackfillPlan) {
  if (plan.action === 'would_update') {
    summary.rowsWouldUpdate += 1;
    return;
  }
  if (plan.action === 'skip_already_assigned') {
    summary.alreadyAssigned += 1;
    return;
  }
  switch (plan.reason) {
    case 'organization_missing':
      summary.missingOrganization += 1;
      break;
    case 'organization_inactive':
      summary.inactiveOrganization += 1;
      break;
    case 'membership_missing':
      summary.missingMembership += 1;
      break;
    case 'membership_inactive':
      summary.inactiveMembership += 1;
      break;
    case 'user_missing':
      summary.userMissing += 1;
      break;
    case 'mapping_inconsistent':
    case 'mapping_ambiguous':
      summary.ambiguousInconsistentMapping += 1;
      break;
    default:
      summary.ambiguousInconsistentMapping += 1;
  }
}

export type CrmLeadOrgBackfillGate = {
  pass: boolean;
  failures: string[];
};

/**
 * Apply is allowed only when every NULL row is would_update and the table has
 * no pre-existing non-null integrity blockers (so 8B-6 preflight can pass after apply).
 */
export function evaluateCrmLeadOrgBackfillGate(
  summary: CrmLeadOrgBackfillSummary
): CrmLeadOrgBackfillGate {
  const failures: string[] = [];
  const blockedNulls =
    summary.missingOrganization +
    summary.inactiveOrganization +
    summary.missingMembership +
    summary.inactiveMembership +
    summary.userMissing +
    summary.ambiguousInconsistentMapping;

  if (summary.nullOrganizationId !== summary.rowsWouldUpdate + blockedNulls) {
    failures.push('internal_count_mismatch_for_null_rows');
  }
  if (blockedNulls > 0) {
    failures.push(`blocked_null_rows=${blockedNulls}`);
  }
  if (summary.rowsWouldUpdate !== summary.nullOrganizationId) {
    failures.push(
      `not_all_null_rows_eligible wouldUpdate=${summary.rowsWouldUpdate} nulls=${summary.nullOrganizationId}`
    );
  }
  if (summary.alreadyAssignedOrphanOrganization > 0) {
    failures.push(`alreadyAssignedOrphanOrganization=${summary.alreadyAssignedOrphanOrganization}`);
  }
  if (summary.alreadyAssignedLegacyInconsistent > 0) {
    failures.push(
      `alreadyAssignedLegacyInconsistent=${summary.alreadyAssignedLegacyInconsistent}`
    );
  }
  if (summary.alreadyAssignedMissingActiveMembership > 0) {
    failures.push(
      `alreadyAssignedMissingActiveMembership=${summary.alreadyAssignedMissingActiveMembership}`
    );
  }
  return { pass: failures.length === 0, failures };
}

/** Same gates Point 8B-6 preflight requires after successful 8B-3. */
export function evaluatePoint8b6ReadinessFromCounts(counts: {
  nullOrganizationId: number;
  orphanOrganizationId: number;
  legacyMappingInconsistent: number;
  missingActiveMembership: number;
}): CrmLeadOrgBackfillGate {
  const failures: string[] = [];
  if (counts.nullOrganizationId !== 0) {
    failures.push(`nullOrganizationId=${counts.nullOrganizationId}`);
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

/**
 * Meta ad account id normalization + unique tenant resolution helpers.
 * Used by the Meta lead webhook under the current User-as-tenant model.
 * Does not introduce Organization / Membership.
 */

/** Canonical form: act_<digits-or-id> */
export function normalizeMetaAdAccountId(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

/**
 * Equivalent stored forms for the same logical Meta ad account.
 * Example: "123", "act_123" → ["123", "act_123"] (order not significant).
 */
export function metaAdAccountIdLookupValues(value: string): string[] {
  const trimmed = String(value || '').trim();
  if (!trimmed) return [];

  const withAct = normalizeMetaAdAccountId(trimmed);
  const bare = withAct.replace(/^act_/, '');

  return Array.from(new Set([trimmed, withAct, bare].filter((entry) => entry.length > 0)));
}

/**
 * True when two stored account id strings refer to the same logical Meta account.
 */
export function isSameLogicalMetaAdAccountId(a: string, b: string): boolean {
  const left = normalizeMetaAdAccountId(a);
  const right = normalizeMetaAdAccountId(b);
  return Boolean(left) && left === right;
}

export type MetaTenantConfigMatch = {
  id: string;
  userId: string;
  metaAdsAccountId: string | null;
};

/**
 * From DB candidates matching any lookup form, resolve exactly one logical tenant.
 * - Multiple rows for the SAME user/config id collapse to one.
 * - Multiple DISTINCT userIds for the same logical account → ambiguous.
 */
export function resolveUniqueMetaTenantFromCandidates(
  candidates: MetaTenantConfigMatch[],
  incomingAccountId: string
):
  | { status: 'ok'; config: MetaTenantConfigMatch }
  | { status: 'not_found' }
  | { status: 'ambiguous'; matchCount: number; configIds: string[]; userIds: string[] } {
  const logicalIncoming = normalizeMetaAdAccountId(incomingAccountId);
  if (!logicalIncoming) {
    return { status: 'not_found' };
  }

  const matching = candidates.filter((candidate) => {
    const stored = String(candidate.metaAdsAccountId || '').trim();
    if (!stored) return false;
    return isSameLogicalMetaAdAccountId(stored, logicalIncoming);
  });

  if (matching.length === 0) {
    return { status: 'not_found' };
  }

  const byUserId = new Map<string, MetaTenantConfigMatch>();
  for (const candidate of matching) {
    if (!byUserId.has(candidate.userId)) {
      byUserId.set(candidate.userId, candidate);
    }
  }

  if (byUserId.size === 1) {
    return { status: 'ok', config: byUserId.values().next().value as MetaTenantConfigMatch };
  }

  return {
    status: 'ambiguous',
    matchCount: byUserId.size,
    configIds: Array.from(byUserId.values()).map((entry) => entry.id),
    userIds: Array.from(byUserId.keys()),
  };
}

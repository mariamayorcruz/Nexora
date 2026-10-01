# Point 8B-4 — CRM organization read cutover

## Scope

Authorized in Draft PR only. Tenant-facing `CrmLead` **reads** authorize by:

`organizationId = trusted TenantContext.organizationId`

Not authorized: merge, production mutation, new migration, backfill, Point 8B-5 multi-org writes, `organizationId` NOT NULL, `userId` removal.

## Behavior

- Resolve TenantContext via JWT + optional `X-Nexora-Organization-Id`.
- CrmLead list/detail/stats/me CRM counts/followup lead lookup use `organizationId`.
- Shared-organization members see org CRM data regardless of creator `userId`.
- No `userId` read fallback. No `organizationId IS NULL` fallback.
- Writes remain legacy-only via `resolveLegacyCrmWriteOrganization`.
- Mutation row targeting uses `writeOrg.organizationId` after write-org validation.
- Meta duplicate detection is organization-scoped; discovery remains `config.userId` → legacy org.
- `/api/admin/stats` remains an intentional platform-admin global aggregate.

## API shape

Continue omitting `organizationId` from public CRM responses (`omitCrmLeadOrganizationId` / explicit selects).

## Validator notes

Point 8B-2 disposable validator retired the temporal assertion that CRM reads remain userId-scoped. Enduring 8B-2 write dual-write tests remain. Read cutover coverage lives in `tenancy:validate-point8b4`.

# Point 8B-2 — CRM runtime dual-write

## Scope

Authorized in Draft PR only. Runtime dual-write of `CrmLead.organizationId` on **CREATE** paths.

Not authorized: merge, production deploy/migration, backfill, read cutover, multi-org CRM writes, 8B-3/4/5.

## Behavior

- New `CrmLead` rows write both `userId` and deterministic `organizationId = legacy_org_<userId>`.
- Ownership is validated server-side via `resolveLegacyCrmWriteOrganization`.
- Client/body `organizationId` is never trusted.
- CRM **reads** remain `userId`-scoped.
- PATCH / message / update routes apply the transitional write guard but **do not** set `organizationId` (no opportunistic backfill).
- Meta webhook derives write org from `TenantAutomationConfig.userId` (no browser org header).

## API compatibility

Authenticated CRM responses that previously spread full Prisma rows now strip `organizationId` via `omitCrmLeadOrganizationId` so clients remain unaware of ownership assignment.

Routes using explicit field selects (`/api/leads`) are unchanged.

## Fail-closed codes

- `legacy_crm_organization_missing` / `_inactive`
- `legacy_crm_membership_missing` / `_inactive`
- `legacy_crm_mapping_inconsistent`
- `crm_multi_org_write_not_ready` (HTTP 409)
- TenantContext codes when a spoofed/unowned org header is supplied

## Schema

Active `prisma/schema.prisma` aligned to Point 8B-1 physical column/indexes/FK. **No new migration.**

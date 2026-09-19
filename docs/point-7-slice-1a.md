# Point 7 — Slice 1A (Tenant Context foundation + new User tenant lifecycle)

## Objective

Build the safe transitional tenant foundation **before** any business-table `organizationId` migration.

Slice 1A has two responsibilities:

1. Guarantee deterministic Organization + OWNER/ACTIVE Membership for every newly created User.
2. Introduce server-side `TenantContext` resolution without changing existing business-data authorization from `userId`.

**Slice 1A introduces trusted tenant resolution but business entities remain userId-owned until later slices.**

## Architecture

| Concept | Role in Slice 1A |
|---------|------------------|
| User | Human identity (JWT subject) |
| Organization | Future tenant / security boundary |
| Membership | Links User ↔ Organization |
| JWT | Identity-only (`userId`, optional `email`/`sid`) — **no** `organizationId` / role claims |
| TenantContext | Server-resolved trusted tenant view |

Client-supplied organization IDs are **never** authoritative unless Membership + Organization status checks pass server-side.

## Lifecycle guarantee

Helper: `src/lib/tenancy/ensure-user-organization.ts`

Uses Slice 0 deterministic mapping from `legacy-organization-backfill.ts`:

- `Organization.id = legacy_org_<userId>`
- Membership `OWNER` + `ACTIVE`
- Organization `ACTIVE`

Behavior (fail closed):

| Case | Result |
|------|--------|
| A Org + Membership absent | Create both |
| B Expected org + OWNER/ACTIVE present | Idempotent success |
| C Expected org exists, zero memberships | Create OWNER/ACTIVE Membership |
| D Org has memberships but expected owner missing | Fail closed |
| E Incompatible membership role/status/ids | Fail closed |
| F Deterministic slug owned by another Organization | Fail closed |

User creation paths wire this helper **inside the same Prisma transaction** as User create (where applicable) so tenant failure rolls back the User.

## TenantContext contract

Module: `src/lib/tenancy/tenant-context.ts`

```ts
type TenantContext = {
  userId: string;
  organizationId: string;
  membershipId: string;
  role: MembershipRole;
};
```

Resolver: `resolveTenantContext({ authorizationHeader, organizationIdHeader? })`

Optional header: `X-Nexora-Organization-Id`

### Organization selection rules

1. Validate JWT → `userId`.
2. If header present: require ACTIVE Membership for that org + ACTIVE Organization; else deny.
3. If header absent:
   - exactly one ACTIVE Membership on an ACTIVE Organization → select it
   - zero → deny (`NO_ACTIVE_MEMBERSHIP`)
   - more than one → do **not** guess (`ORGANIZATION_SELECTION_REQUIRED`)

Never select by name, email, localStorage, “first row”, oldest membership, or JWT org claim.

### Error codes

| Code | HTTP (API) | Meaning |
|------|------------|---------|
| `UNAUTHENTICATED` | 401 | Missing/invalid JWT |
| `NO_ACTIVE_MEMBERSHIP` | 403 | No usable ACTIVE membership |
| `ORGANIZATION_SELECTION_REQUIRED` | 409 | Multiple valid tenants; header required |
| `ORGANIZATION_ACCESS_DENIED` | 403 | No membership for requested org |
| `ORGANIZATION_INACTIVE` | 403 | Org SUSPENDED/DEACTIVATED |
| `MEMBERSHIP_INACTIVE` | 403 | Membership not ACTIVE |

## API

`GET /api/tenant/context`

Returns:

```json
{
  "organization": { "id": "...", "name": "...", "slug": "..." },
  "membership": { "role": "OWNER" }
}
```

Does **not** migrate other APIs onto TenantContext in this slice.

## Backward compatibility

- CRM / campaigns / AI / billing queries remain `where: { userId }`.
- Existing JWT clients continue to work.
- No Prisma schema migration in Slice 1A.

## Explicitly NOT implemented

- `organizationId` columns on business tables
- Replacing business API authorization with TenantContext
- Full RBAC policy engine (role is exposed; policies later)
- SEC-07 / SEC-08
- Organization switching UI
- Claiming full multi-tenant isolation
- Production deploy / merge as part of this slice alone

## Migration path (later slices)

1. Add `organizationId` to business tables + backfill from `legacy_org_<userId>`.
2. Dual-read / dual-write transition if needed.
3. Cut business APIs over to TenantContext + `organizationId` filters.
4. Only then claim organization-scoped isolation.

## Security assumptions

- Default deny / fail closed.
- JWT is identity-only.
- Membership and Organization status checked server-side every resolution.
- Do not log JWTs or secrets.
- Do not trust client org selection without Membership validation.

## Testing evidence

```bash
FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-slice1a
```

Covers TenantContext selection cases 1–9 and lifecycle cases 10–17 on disposable Postgres only.

## User-creation path audit

| Path | Updated |
|------|---------|
| `src/app/api/auth/register/route.ts` | Yes (same txn) |
| `src/app/api/auth/google/route.ts` | Yes (new user atomic; existing idempotent ensure) |
| `src/app/api/v1/integrations/gotnexora/provision/route.ts` | Yes (same txn) |
| `src/app/api/admin/create-demo-user/route.ts` | Yes (same txn) |
| `scripts/create-demo-user.ts` | Yes |
| `prisma/seed.js` | Documented only (dev seed; not production) |

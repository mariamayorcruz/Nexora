# Point 8B-1 — CrmLead organization DB foundation

## Architectural freeze

Point 8A APPROVED v1.0 (with amendments).  
Point 8B design APPROVED v1.0 / ARCHITECTURALLY FROZEN.

Frozen rollout:

1. **8B-1** Database foundation artifact ← **this slice**
2. Separate explicit Production DB authorization
3. Production migration apply + physical verification
4. **8B-2** Runtime dual-write (legacy org only)
5. **8B-3** Backfill
6. **8B-4** Read cutover
7. **8B-5** Multi-org writes
8. **8B-6** NOT NULL hardening later

## Base SHA

Implemented from `origin/main` exactly:

`09f277e47ecdf89dbc9fa6805ba127142ebc3d48`

## Scope implemented

- Append-only Prisma migration adding nullable `CrmLead.organizationId`
- FK → `Organization.id` with `ON DELETE RESTRICT`
- Approved indexes
- Disposable DB validation script
- FR-004 active-migration list updated for the third migration
- Documentation

## Explicit non-actions

- NO production migration / DB mutation
- NO backfill of `organizationId`
- NO runtime dual-write
- NO `organizationId` reads / filters in application code
- NO read cutover
- NO multi-org CRM writes
- NO Company / Contact rename / Conversation / Message / Integration / Point 9 / Cleaning Pack / RBAC / RLS
- NO `userId` removal
- NO `organizationId NOT NULL`

## Database-first safety — active Prisma schema deferred

**Active `prisma/schema.prisma` is intentionally NOT modified in 8B-1.**

Reason (fail-safe):

- `package.json` `build` / `postinstall` run `prisma generate`.
- If the active schema exposed `CrmLead.organizationId`, generated Prisma Client would SELECT that column on ordinary `crmLead` queries.
- Vercel PR preview / shared `DATABASE_URL` environments may point at a database that does **not** yet have the physical column.
- That would break CRM routes before production migration authorization.

Therefore:

- **Authoritative 8B-1 deliverable** = SQL migration artifact under `prisma/migrations/`
- Active Prisma schema alignment belongs immediately after production DB migration verification / start of **8B-2**

### Deferred Prisma schema patch (for 8B-2 alignment — do not apply in 8B-1)

```prisma
model Organization {
  // ...existing fields...
  memberships Membership[]
  crmLeads    CrmLead[]
}

model CrmLead {
  // ...existing fields unchanged...
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Restrict)

  // ...campaign relation unchanged...

  @@index([organizationId, updatedAt])
  @@index([organizationId, stage])
  @@index([userId])
}
```

## Migration

**Filename:** `20260930011200_add_crmlead_organization_tenancy_foundation`

**SQL summary:**

1. `ALTER TABLE "CrmLead" ADD COLUMN "organizationId" TEXT;` (nullable; no default fill / no backfill)
2. Indexes:
   - `CrmLead_organizationId_updatedAt_idx` on (`organizationId`, `updatedAt`)
   - `CrmLead_organizationId_stage_idx` on (`organizationId`, `stage`)
   - `CrmLead_userId_idx` on (`userId`)
3. FK `CrmLead_organizationId_fkey` → `Organization`(`id`)  
   `ON DELETE RESTRICT`  
   `ON UPDATE CASCADE`

`userId` remains `NOT NULL` with existing cascade to `User`.

## Resulting transitional DB shape

```
CrmLead.userId              NOT NULL   (runtime authoritative until later cutover)
CrmLead.organizationId      NULLABLE  (foundation only; unused by runtime in 8B-1)
```

## Validation

Disposable DB only:

```bash
FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b1
```

Also:

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
```

FR-004 disposable suites updated for the third active migration:

```bash
FR004_DATABASE_URL=postgresql://... npm run fr004:greenfield
FR004_DATABASE_URL=postgresql://... npm run fr004:prodsim
```

## Production boundary

Production migration remains **separately blocked** pending architectural review and explicit authorization.

Current read-only production gate (when a read-only URL is authorized later):

```bash
FR004_DATABASE_URL=... npm run fr004:pending-proof -- --before-point8b1 --allow-hosted-readonly
```

Expected pending: **exactly** `20260930011200_add_crmlead_organization_tenancy_foundation`.

Historical `--after-auth-a` is **not** the current Point 8B-1 gate (Point 7 Auth A/B are completed).

See `docs/database/fr-004-migration-integrity-runbook.md` → **POINT 8B-1 PRODUCTION MIGRATION GATE**.

**8B-2 cannot begin** until the physical production column/indexes/FK are verified after that authorized migration.

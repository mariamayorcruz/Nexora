-- CreateEnum
CREATE TYPE "CrmReadPolicyBundleStatus" AS ENUM ('DRAFT', 'VALIDATED');

-- CreateEnum
CREATE TYPE "CrmReadPolicyScopeKind" AS ENUM ('COMPANY', 'RECORD');

-- CreateEnum
CREATE TYPE "CrmReadPolicyFieldClass" AS ENUM ('IDENTIDAD', 'CANAL', 'GESTION', 'RESERVADO');

-- CreateEnum
CREATE TYPE "CrmReadPolicyGrantValidity" AS ENUM ('ACTIVE', 'REVOKED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "CrmReadPolicyRestrictionValidity" AS ENUM ('ACTIVE', 'LIFTED');

-- CreateEnum
CREATE TYPE "CrmReadPolicyOriginKind" AS ENUM ('LEGACY_SNAPSHOT', 'COMPANY_AUTHORITY', 'DELEGATED_CHAIN', 'AGENCY_RELATION');

-- CreateEnum
CREATE TYPE "CrmReadPolicyChangeKind" AS ENUM ('ADD_GRANT', 'REMOVE_GRANT', 'REVOKE_GRANT', 'INVALIDATE_GRANT', 'REASSIGN_GRANT', 'NARROW_GRANT_CLASSES', 'WIDEN_GRANT_CLASSES', 'WIDEN_GRANT_SCOPE', 'EXTEND_GRANT_WINDOW', 'CHANGE_GRANT_PARENT', 'CHANGE_GRANT_ORIGIN', 'ADD_RESTRICTION', 'LIFT_RESTRICTION', 'NARROW_RESTRICTION_CLASSES');

-- CreateEnum
CREATE TYPE "CrmReadPolicyEvidenceClassDirection" AS ENUM ('ADDED', 'REMOVED');

-- CreateTable
CREATE TABLE "CrmReadPolicyBundle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CrmReadPolicyBundleStatus" NOT NULL DEFAULT 'DRAFT',
    "canonicalVersion" TEXT NOT NULL,
    "contentChecksum" TEXT,
    "predecessorOrganizationId" TEXT,
    "predecessorVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmReadPolicyBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmReadPolicyBundleMembershipLink" (
    "organizationId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,

    CONSTRAINT "CrmReadPolicyBundleMembershipLink_pkey" PRIMARY KEY ("organizationId","bundleId","membershipId")
);

-- CreateTable
CREATE TABLE "CrmReadPolicyBundleLeadLink" (
    "organizationId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,

    CONSTRAINT "CrmReadPolicyBundleLeadLink_pkey" PRIMARY KEY ("organizationId","bundleId","leadId")
);

-- CreateTable
CREATE TABLE "CrmReadPolicyRetiredGrantLogicalId" (
    "organizationId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "logicalId" TEXT NOT NULL,

    CONSTRAINT "CrmReadPolicyRetiredGrantLogicalId_pkey" PRIMARY KEY ("organizationId","bundleId","logicalId")
);

-- CreateTable
CREATE TABLE "CrmReadPolicyGrant" (
    "organizationId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "logicalId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'crm.lead.read',
    "accessMode" TEXT NOT NULL DEFAULT 'read',
    "scopeKind" "CrmReadPolicyScopeKind" NOT NULL,
    "scopeLeadId" TEXT,
    "validity" "CrmReadPolicyGrantValidity" NOT NULL DEFAULT 'ACTIVE',
    "parentVersionId" TEXT,
    "originKind" "CrmReadPolicyOriginKind" NOT NULL,
    "originOrganizationId" TEXT NOT NULL,
    "originRootValidated" BOOLEAN NOT NULL,
    "originRevoked" BOOLEAN NOT NULL DEFAULT false,
    "grantVersion" TEXT,
    "requiredParentVersion" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmReadPolicyGrant_pkey" PRIMARY KEY ("organizationId","bundleId","versionId")
);

-- CreateTable
CREATE TABLE "CrmReadPolicyGrantFieldClass" (
    "organizationId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "grantVersionId" TEXT NOT NULL,
    "fieldClass" "CrmReadPolicyFieldClass" NOT NULL,

    CONSTRAINT "CrmReadPolicyGrantFieldClass_pkey" PRIMARY KEY ("organizationId","bundleId","grantVersionId","fieldClass")
);

-- CreateTable
CREATE TABLE "CrmReadPolicyRestriction" (
    "organizationId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "logicalId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'crm.lead.read',
    "scopeKind" "CrmReadPolicyScopeKind" NOT NULL,
    "scopeLeadId" TEXT,
    "validity" "CrmReadPolicyRestrictionValidity" NOT NULL DEFAULT 'ACTIVE',
    "authorMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmReadPolicyRestriction_pkey" PRIMARY KEY ("organizationId","bundleId","versionId")
);

-- CreateTable
CREATE TABLE "CrmReadPolicyRestrictionFieldClass" (
    "organizationId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "restrictionVersionId" TEXT NOT NULL,
    "fieldClass" "CrmReadPolicyFieldClass" NOT NULL,

    CONSTRAINT "CrmReadPolicyRestrictionFieldClass_pkey" PRIMARY KEY ("organizationId","bundleId","restrictionVersionId","fieldClass")
);

-- CreateTable
CREATE TABLE "CrmReadPolicyChangeEvidence" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromVersion" INTEGER NOT NULL,
    "toVersion" INTEGER NOT NULL,
    "changeKind" "CrmReadPolicyChangeKind" NOT NULL,
    "targetLogicalId" TEXT NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmReadPolicyChangeEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmReadPolicyChangeEvidenceFieldClass" (
    "organizationId" TEXT NOT NULL,
    "evidenceRowId" TEXT NOT NULL,
    "direction" "CrmReadPolicyEvidenceClassDirection" NOT NULL,
    "fieldClass" "CrmReadPolicyFieldClass" NOT NULL,

    CONSTRAINT "CrmReadPolicyChangeEvidenceFieldClass_pkey" PRIMARY KEY ("organizationId","evidenceRowId","direction","fieldClass")
);

-- CreateIndex
CREATE INDEX "CrmReadPolicyBundle_organizationId_status_idx" ON "CrmReadPolicyBundle"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CrmReadPolicyBundle_organizationId_id_key" ON "CrmReadPolicyBundle"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CrmReadPolicyBundle_organizationId_version_key" ON "CrmReadPolicyBundle"("organizationId", "version");

-- CreateIndex
CREATE INDEX "CrmReadPolicyGrant_organizationId_membershipId_idx" ON "CrmReadPolicyGrant"("organizationId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmReadPolicyGrant_organizationId_bundleId_logicalId_key" ON "CrmReadPolicyGrant"("organizationId", "bundleId", "logicalId");

-- CreateIndex
CREATE INDEX "CrmReadPolicyRestriction_organizationId_membershipId_idx" ON "CrmReadPolicyRestriction"("organizationId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmReadPolicyRestriction_organizationId_bundleId_logicalId_key" ON "CrmReadPolicyRestriction"("organizationId", "bundleId", "logicalId");

-- CreateIndex
CREATE INDEX "CrmReadPolicyChangeEvidence_organizationId_fromVersion_toVe_idx" ON "CrmReadPolicyChangeEvidence"("organizationId", "fromVersion", "toVersion");

-- CreateIndex
CREATE UNIQUE INDEX "CrmReadPolicyChangeEvidence_organizationId_id_key" ON "CrmReadPolicyChangeEvidence"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CrmReadPolicyChangeEvidence_organizationId_evidenceId_key" ON "CrmReadPolicyChangeEvidence"("organizationId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmLead_organizationId_id_key" ON "CrmLead"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_id_key" ON "Membership"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "CrmReadPolicyBundle" ADD CONSTRAINT "CrmReadPolicyBundle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyBundle" ADD CONSTRAINT "CrmReadPolicyBundle_predecessorOrganizationId_predecessorV_fkey" FOREIGN KEY ("predecessorOrganizationId", "predecessorVersion") REFERENCES "CrmReadPolicyBundle"("organizationId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyBundleMembershipLink" ADD CONSTRAINT "CrmReadPolicyBundleMembershipLink_organizationId_bundleId_fkey" FOREIGN KEY ("organizationId", "bundleId") REFERENCES "CrmReadPolicyBundle"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyBundleMembershipLink" ADD CONSTRAINT "CrmReadPolicyBundleMembershipLink_organizationId_membershi_fkey" FOREIGN KEY ("organizationId", "membershipId") REFERENCES "Membership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyBundleLeadLink" ADD CONSTRAINT "CrmReadPolicyBundleLeadLink_organizationId_bundleId_fkey" FOREIGN KEY ("organizationId", "bundleId") REFERENCES "CrmReadPolicyBundle"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyBundleLeadLink" ADD CONSTRAINT "CrmReadPolicyBundleLeadLink_organizationId_leadId_fkey" FOREIGN KEY ("organizationId", "leadId") REFERENCES "CrmLead"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyRetiredGrantLogicalId" ADD CONSTRAINT "CrmReadPolicyRetiredGrantLogicalId_organizationId_bundleId_fkey" FOREIGN KEY ("organizationId", "bundleId") REFERENCES "CrmReadPolicyBundle"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyGrant" ADD CONSTRAINT "CrmReadPolicyGrant_organizationId_bundleId_fkey" FOREIGN KEY ("organizationId", "bundleId") REFERENCES "CrmReadPolicyBundle"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyGrant" ADD CONSTRAINT "CrmReadPolicyGrant_organizationId_membershipId_fkey" FOREIGN KEY ("organizationId", "membershipId") REFERENCES "Membership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyGrant" ADD CONSTRAINT "CrmReadPolicyGrant_organizationId_scopeLeadId_fkey" FOREIGN KEY ("organizationId", "scopeLeadId") REFERENCES "CrmLead"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyGrant" ADD CONSTRAINT "CrmReadPolicyGrant_organizationId_bundleId_parentVersionId_fkey" FOREIGN KEY ("organizationId", "bundleId", "parentVersionId") REFERENCES "CrmReadPolicyGrant"("organizationId", "bundleId", "versionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyGrantFieldClass" ADD CONSTRAINT "CrmReadPolicyGrantFieldClass_organizationId_bundleId_grant_fkey" FOREIGN KEY ("organizationId", "bundleId", "grantVersionId") REFERENCES "CrmReadPolicyGrant"("organizationId", "bundleId", "versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyRestriction" ADD CONSTRAINT "CrmReadPolicyRestriction_organizationId_bundleId_fkey" FOREIGN KEY ("organizationId", "bundleId") REFERENCES "CrmReadPolicyBundle"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyRestriction" ADD CONSTRAINT "CrmReadPolicyRestriction_organizationId_membershipId_fkey" FOREIGN KEY ("organizationId", "membershipId") REFERENCES "Membership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyRestriction" ADD CONSTRAINT "CrmReadPolicyRestriction_organizationId_authorMembershipId_fkey" FOREIGN KEY ("organizationId", "authorMembershipId") REFERENCES "Membership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyRestriction" ADD CONSTRAINT "CrmReadPolicyRestriction_organizationId_scopeLeadId_fkey" FOREIGN KEY ("organizationId", "scopeLeadId") REFERENCES "CrmLead"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyRestrictionFieldClass" ADD CONSTRAINT "CrmReadPolicyRestrictionFieldClass_organizationId_bundleId_fkey" FOREIGN KEY ("organizationId", "bundleId", "restrictionVersionId") REFERENCES "CrmReadPolicyRestriction"("organizationId", "bundleId", "versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyChangeEvidence" ADD CONSTRAINT "CrmReadPolicyChangeEvidence_organizationId_fromVersion_fkey" FOREIGN KEY ("organizationId", "fromVersion") REFERENCES "CrmReadPolicyBundle"("organizationId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyChangeEvidence" ADD CONSTRAINT "CrmReadPolicyChangeEvidence_organizationId_toVersion_fkey" FOREIGN KEY ("organizationId", "toVersion") REFERENCES "CrmReadPolicyBundle"("organizationId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmReadPolicyChangeEvidenceFieldClass" ADD CONSTRAINT "CrmReadPolicyChangeEvidenceFieldClass_organizationId_evide_fkey" FOREIGN KEY ("organizationId", "evidenceRowId") REFERENCES "CrmReadPolicyChangeEvidence"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Point 8 4A-1B: CHECK constraints (DB-enforced structural invariants)

ALTER TABLE "CrmReadPolicyBundle"
  ADD CONSTRAINT "CrmReadPolicyBundle_version_positive"
  CHECK ("version" >= 1);

ALTER TABLE "CrmReadPolicyBundle"
  ADD CONSTRAINT "CrmReadPolicyBundle_canonicalVersion_nonempty"
  CHECK (char_length("canonicalVersion") > 0);

ALTER TABLE "CrmReadPolicyBundle"
  ADD CONSTRAINT "CrmReadPolicyBundle_validated_requires_checksum"
  CHECK (
    "status" <> 'VALIDATED'::"CrmReadPolicyBundleStatus"
    OR ("contentChecksum" IS NOT NULL AND char_length("contentChecksum") > 0)
  );

ALTER TABLE "CrmReadPolicyBundle"
  ADD CONSTRAINT "CrmReadPolicyBundle_predecessor_pair"
  CHECK (
    ("predecessorOrganizationId" IS NULL AND "predecessorVersion" IS NULL)
    OR (
      "predecessorOrganizationId" IS NOT NULL
      AND "predecessorVersion" IS NOT NULL
      AND "predecessorOrganizationId" = "organizationId"
      AND "predecessorVersion" < "version"
    )
  );

ALTER TABLE "CrmReadPolicyGrant"
  ADD CONSTRAINT "CrmReadPolicyGrant_action_read_only"
  CHECK ("action" = 'crm.lead.read');

ALTER TABLE "CrmReadPolicyGrant"
  ADD CONSTRAINT "CrmReadPolicyGrant_access_mode_read"
  CHECK ("accessMode" = 'read');

ALTER TABLE "CrmReadPolicyGrant"
  ADD CONSTRAINT "CrmReadPolicyGrant_scope_shape"
  CHECK (
    ("scopeKind" = 'COMPANY'::"CrmReadPolicyScopeKind" AND "scopeLeadId" IS NULL)
    OR ("scopeKind" = 'RECORD'::"CrmReadPolicyScopeKind" AND "scopeLeadId" IS NOT NULL)
  );

ALTER TABLE "CrmReadPolicyGrant"
  ADD CONSTRAINT "CrmReadPolicyGrant_window_order"
  CHECK ("validFrom" IS NULL OR "validUntil" IS NULL OR "validFrom" <= "validUntil");

ALTER TABLE "CrmReadPolicyGrant"
  ADD CONSTRAINT "CrmReadPolicyGrant_origin_same_org"
  CHECK ("originOrganizationId" = "organizationId");

ALTER TABLE "CrmReadPolicyGrant"
  ADD CONSTRAINT "CrmReadPolicyGrant_ids_nonempty"
  CHECK (char_length("versionId") > 0 AND char_length("logicalId") > 0);

ALTER TABLE "CrmReadPolicyRestriction"
  ADD CONSTRAINT "CrmReadPolicyRestriction_action_read_only"
  CHECK ("action" = 'crm.lead.read');

ALTER TABLE "CrmReadPolicyRestriction"
  ADD CONSTRAINT "CrmReadPolicyRestriction_scope_shape"
  CHECK (
    ("scopeKind" = 'COMPANY'::"CrmReadPolicyScopeKind" AND "scopeLeadId" IS NULL)
    OR ("scopeKind" = 'RECORD'::"CrmReadPolicyScopeKind" AND "scopeLeadId" IS NOT NULL)
  );

ALTER TABLE "CrmReadPolicyRestriction"
  ADD CONSTRAINT "CrmReadPolicyRestriction_ids_nonempty"
  CHECK (char_length("versionId") > 0 AND char_length("logicalId") > 0);

ALTER TABLE "CrmReadPolicyRetiredGrantLogicalId"
  ADD CONSTRAINT "CrmReadPolicyRetiredGrantLogicalId_nonempty"
  CHECK (char_length("logicalId") > 0);

ALTER TABLE "CrmReadPolicyChangeEvidence"
  ADD CONSTRAINT "CrmReadPolicyChangeEvidence_version_order"
  CHECK ("fromVersion" < "toVersion");

ALTER TABLE "CrmReadPolicyChangeEvidence"
  ADD CONSTRAINT "CrmReadPolicyChangeEvidence_ids_nonempty"
  CHECK (char_length("evidenceId") > 0 AND char_length("targetLogicalId") > 0);

-- Defer grant parent FK so draft bundle CASCADE deletes can remove an entire tree in one statement.
ALTER TABLE "CrmReadPolicyGrant" DROP CONSTRAINT "CrmReadPolicyGrant_organizationId_bundleId_parentVersionId_fkey";
ALTER TABLE "CrmReadPolicyGrant"
  ADD CONSTRAINT "CrmReadPolicyGrant_organizationId_bundleId_parentVersionId_fkey"
  FOREIGN KEY ("organizationId", "bundleId", "parentVersionId")
  REFERENCES "CrmReadPolicyGrant"("organizationId", "bundleId", "versionId")
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- Immutability: VALIDATED candidate content cannot be mutated or deleted.
-- DRAFT → VALIDATED via UPDATE is blocked until a transactional service exists.
-- Direct INSERT of VALIDATED (complete snapshot with checksum) is allowed for historical storage.

CREATE OR REPLACE FUNCTION crm_read_policy_bundle_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus" THEN
      RAISE EXCEPTION 'crm_read_policy: VALIDATED bundle % is immutable', OLD."id"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus" THEN
    RAISE EXCEPTION 'crm_read_policy: VALIDATED bundle % is immutable', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
     AND OLD."status" = 'DRAFT'::"CrmReadPolicyBundleStatus" THEN
    RAISE EXCEPTION 'crm_read_policy: DRAFT to VALIDATED transition blocked pending transactional service'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_read_policy_bundle_immutability
  BEFORE UPDATE OR DELETE ON "CrmReadPolicyBundle"
  FOR EACH ROW
  EXECUTE FUNCTION crm_read_policy_bundle_immutability();

CREATE OR REPLACE FUNCTION crm_read_policy_allow_validated_snapshot_write()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(nullif(current_setting('crm_read_policy.allow_validated_snapshot_write', true), ''), 'off'))
    IN ('1', 'on', 'true', 'yes');
$$;

CREATE OR REPLACE FUNCTION crm_read_policy_child_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bundle_status "CrmReadPolicyBundleStatus";
  org_id TEXT;
  bundle_id TEXT;
  validated_hit boolean := false;
BEGIN
  IF TG_TABLE_NAME IN ('CrmReadPolicyChangeEvidence', 'CrmReadPolicyChangeEvidenceFieldClass') THEN
    IF TG_OP = 'DELETE' THEN
      IF TG_TABLE_NAME = 'CrmReadPolicyChangeEvidence' THEN
        validated_hit := EXISTS (
          SELECT 1 FROM "CrmReadPolicyBundle" b
          WHERE b."organizationId" = OLD."organizationId"
            AND b."version" IN (OLD."fromVersion", OLD."toVersion")
            AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
        );
      ELSE
        validated_hit := EXISTS (
          SELECT 1
          FROM "CrmReadPolicyChangeEvidence" e
          JOIN "CrmReadPolicyBundle" b
            ON b."organizationId" = e."organizationId"
           AND b."version" IN (e."fromVersion", e."toVersion")
          WHERE e."organizationId" = OLD."organizationId"
            AND e."id" = OLD."evidenceRowId"
            AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
        );
      END IF;
      IF validated_hit THEN
        RAISE EXCEPTION 'crm_read_policy: evidence tied to VALIDATED bundle is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      RETURN OLD;
    END IF;

    IF TG_TABLE_NAME = 'CrmReadPolicyChangeEvidence' THEN
      validated_hit := EXISTS (
        SELECT 1 FROM "CrmReadPolicyBundle" b
        WHERE b."organizationId" = NEW."organizationId"
          AND b."version" IN (NEW."fromVersion", NEW."toVersion")
          AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
      );
    ELSE
      validated_hit := EXISTS (
        SELECT 1
        FROM "CrmReadPolicyChangeEvidence" e
        JOIN "CrmReadPolicyBundle" b
          ON b."organizationId" = e."organizationId"
         AND b."version" IN (e."fromVersion", e."toVersion")
        WHERE e."organizationId" = NEW."organizationId"
          AND e."id" = NEW."evidenceRowId"
          AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
      );
    END IF;

    IF validated_hit THEN
      IF TG_OP = 'INSERT' AND crm_read_policy_allow_validated_snapshot_write() THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'crm_read_policy: evidence tied to VALIDATED bundle is immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    org_id := OLD."organizationId";
    bundle_id := OLD."bundleId";
  ELSE
    org_id := NEW."organizationId";
    bundle_id := NEW."bundleId";
  END IF;

  SELECT b."status" INTO bundle_status
  FROM "CrmReadPolicyBundle" b
  WHERE b."organizationId" = org_id AND b."id" = bundle_id;

  IF bundle_status = 'VALIDATED'::"CrmReadPolicyBundleStatus" THEN
    IF TG_OP = 'INSERT' AND crm_read_policy_allow_validated_snapshot_write() THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'crm_read_policy: child rows of VALIDATED bundle % are immutable', bundle_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_read_policy_grant_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "CrmReadPolicyGrant"
  FOR EACH ROW EXECUTE FUNCTION crm_read_policy_child_immutability();

CREATE TRIGGER trg_crm_read_policy_grant_fc_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "CrmReadPolicyGrantFieldClass"
  FOR EACH ROW EXECUTE FUNCTION crm_read_policy_child_immutability();

CREATE TRIGGER trg_crm_read_policy_restriction_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "CrmReadPolicyRestriction"
  FOR EACH ROW EXECUTE FUNCTION crm_read_policy_child_immutability();

CREATE TRIGGER trg_crm_read_policy_restriction_fc_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "CrmReadPolicyRestrictionFieldClass"
  FOR EACH ROW EXECUTE FUNCTION crm_read_policy_child_immutability();

CREATE TRIGGER trg_crm_read_policy_retired_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "CrmReadPolicyRetiredGrantLogicalId"
  FOR EACH ROW EXECUTE FUNCTION crm_read_policy_child_immutability();

CREATE TRIGGER trg_crm_read_policy_memlink_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "CrmReadPolicyBundleMembershipLink"
  FOR EACH ROW EXECUTE FUNCTION crm_read_policy_child_immutability();

CREATE TRIGGER trg_crm_read_policy_leadlink_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "CrmReadPolicyBundleLeadLink"
  FOR EACH ROW EXECUTE FUNCTION crm_read_policy_child_immutability();

CREATE TRIGGER trg_crm_read_policy_evidence_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "CrmReadPolicyChangeEvidence"
  FOR EACH ROW EXECUTE FUNCTION crm_read_policy_child_immutability();

CREATE TRIGGER trg_crm_read_policy_evidence_fc_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "CrmReadPolicyChangeEvidenceFieldClass"
  FOR EACH ROW EXECUTE FUNCTION crm_read_policy_child_immutability();

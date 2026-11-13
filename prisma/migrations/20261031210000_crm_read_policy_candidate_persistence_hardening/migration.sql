-- Point 8 4A-1B corrective hardening (product migration).
-- Applied after 20261031200000_add_crm_read_policy_candidate_persistence.
-- Does not rewrite prior migration history.
--
-- Changes:
-- 1. Remove crm_read_policy.allow_validated_snapshot_write bypass.
-- 2. Block INSERT of VALIDATED bundles and DRAFT→VALIDATED updates.
-- 3. Child/evidence immutability checks BOTH origin (OLD) and destination (NEW).
-- 4. Enable RLS on new tables; revoke client/PUBLIC Data API style access.
--    Supabase-specific roles are revoked only when present (disposable-safe).

-- ---------------------------------------------------------------------------
-- 1) Bundle trigger: also fire on INSERT; no VALIDATED writes in this cut
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_crm_read_policy_bundle_immutability ON "CrmReadPolicyBundle";

CREATE OR REPLACE FUNCTION crm_read_policy_bundle_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus" THEN
      RAISE EXCEPTION 'crm_read_policy: INSERT of VALIDATED bundle blocked pending transactional sealing service'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus" THEN
      RAISE EXCEPTION 'crm_read_policy: VALIDATED bundle % is immutable', OLD."id"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus" THEN
    RAISE EXCEPTION 'crm_read_policy: VALIDATED bundle % is immutable', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
     AND OLD."status" = 'DRAFT'::"CrmReadPolicyBundleStatus" THEN
    RAISE EXCEPTION 'crm_read_policy: DRAFT to VALIDATED transition blocked pending transactional sealing service'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_read_policy_bundle_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "CrmReadPolicyBundle"
  FOR EACH ROW
  EXECUTE FUNCTION crm_read_policy_bundle_immutability();

-- ---------------------------------------------------------------------------
-- 2) Child/evidence immutability: OLD + NEW, no GUC bypass
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION crm_read_policy_bundle_is_validated(p_org_id text, p_bundle_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "CrmReadPolicyBundle" b
    WHERE b."organizationId" = p_org_id
      AND b."id" = p_bundle_id
      AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
  );
$$;

CREATE OR REPLACE FUNCTION crm_read_policy_evidence_touches_validated(
  p_org_id text,
  p_from_version integer,
  p_to_version integer
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "CrmReadPolicyBundle" b
    WHERE b."organizationId" = p_org_id
      AND b."version" IN (p_from_version, p_to_version)
      AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
  );
$$;

CREATE OR REPLACE FUNCTION crm_read_policy_evidence_row_touches_validated(
  p_org_id text,
  p_evidence_row_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "CrmReadPolicyChangeEvidence" e
    JOIN "CrmReadPolicyBundle" b
      ON b."organizationId" = e."organizationId"
     AND b."version" IN (e."fromVersion", e."toVersion")
    WHERE e."organizationId" = p_org_id
      AND e."id" = p_evidence_row_id
      AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
  );
$$;

CREATE OR REPLACE FUNCTION crm_read_policy_child_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'CrmReadPolicyChangeEvidence' THEN
    IF TG_OP = 'DELETE' THEN
      IF crm_read_policy_evidence_touches_validated(
        OLD."organizationId", OLD."fromVersion", OLD."toVersion"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence tied to VALIDATED bundle is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF crm_read_policy_evidence_touches_validated(
        OLD."organizationId", OLD."fromVersion", OLD."toVersion"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence origin tied to VALIDATED bundle is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    END IF;

    IF crm_read_policy_evidence_touches_validated(
      NEW."organizationId", NEW."fromVersion", NEW."toVersion"
    ) THEN
      RAISE EXCEPTION 'crm_read_policy: evidence destination tied to VALIDATED bundle is immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'CrmReadPolicyChangeEvidenceFieldClass' THEN
    IF TG_OP = 'DELETE' THEN
      IF crm_read_policy_evidence_row_touches_validated(
        OLD."organizationId", OLD."evidenceRowId"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence field classes on VALIDATED succession are immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF crm_read_policy_evidence_row_touches_validated(
        OLD."organizationId", OLD."evidenceRowId"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence field-class origin on VALIDATED succession is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    END IF;

    IF crm_read_policy_evidence_row_touches_validated(
      NEW."organizationId", NEW."evidenceRowId"
    ) THEN
      RAISE EXCEPTION 'crm_read_policy: evidence field-class destination on VALIDATED succession is immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Bundle-scoped children (grants, restrictions, catalogs, retired ids, field classes)
  IF TG_OP = 'DELETE' THEN
    IF crm_read_policy_bundle_is_validated(OLD."organizationId", OLD."bundleId") THEN
      RAISE EXCEPTION 'crm_read_policy: child rows of VALIDATED bundle % are immutable', OLD."bundleId"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF crm_read_policy_bundle_is_validated(OLD."organizationId", OLD."bundleId") THEN
      RAISE EXCEPTION 'crm_read_policy: child origin on VALIDATED bundle % is immutable', OLD."bundleId"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  IF crm_read_policy_bundle_is_validated(NEW."organizationId", NEW."bundleId") THEN
    RAISE EXCEPTION 'crm_read_policy: child destination on VALIDATED bundle % is immutable', NEW."bundleId"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Remove product bypass introduced in the prior migration.
DROP FUNCTION IF EXISTS crm_read_policy_allow_validated_snapshot_write();

-- ---------------------------------------------------------------------------
-- 3) RLS + revoke client / PUBLIC privileges on NEW objects only
-- ---------------------------------------------------------------------------

ALTER TABLE "CrmReadPolicyBundle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmReadPolicyBundleMembershipLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmReadPolicyBundleLeadLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmReadPolicyRetiredGrantLogicalId" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmReadPolicyGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmReadPolicyGrantFieldClass" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmReadPolicyRestriction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmReadPolicyRestrictionFieldClass" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmReadPolicyChangeEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmReadPolicyChangeEvidenceFieldClass" ENABLE ROW LEVEL SECURITY;

-- No permissive policies for anon/authenticated are created.
-- Table owner / BYPASSRLS roles retain internal access without FORCE RLS.

REVOKE ALL ON TABLE
  "CrmReadPolicyBundle",
  "CrmReadPolicyBundleMembershipLink",
  "CrmReadPolicyBundleLeadLink",
  "CrmReadPolicyRetiredGrantLogicalId",
  "CrmReadPolicyGrant",
  "CrmReadPolicyGrantFieldClass",
  "CrmReadPolicyRestriction",
  "CrmReadPolicyRestrictionFieldClass",
  "CrmReadPolicyChangeEvidence",
  "CrmReadPolicyChangeEvidenceFieldClass"
FROM PUBLIC;

REVOKE ALL ON FUNCTION crm_read_policy_bundle_immutability() FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_child_immutability() FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_bundle_is_validated(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_evidence_touches_validated(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_evidence_row_touches_validated(text, text) FROM PUBLIC;

DO $$
DECLARE
  client_role text;
  tbl text;
  tables text[] := ARRAY[
    'CrmReadPolicyBundle',
    'CrmReadPolicyBundleMembershipLink',
    'CrmReadPolicyBundleLeadLink',
    'CrmReadPolicyRetiredGrantLogicalId',
    'CrmReadPolicyGrant',
    'CrmReadPolicyGrantFieldClass',
    'CrmReadPolicyRestriction',
    'CrmReadPolicyRestrictionFieldClass',
    'CrmReadPolicyChangeEvidence',
    'CrmReadPolicyChangeEvidenceFieldClass'
  ];
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'authenticator']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      FOREACH tbl IN ARRAY tables
      LOOP
        EXECUTE format(
          'REVOKE ALL ON TABLE %I FROM %I',
          tbl,
          client_role
        );
      END LOOP;

      EXECUTE format('REVOKE ALL ON FUNCTION crm_read_policy_bundle_immutability() FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON FUNCTION crm_read_policy_child_immutability() FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON FUNCTION crm_read_policy_bundle_is_validated(text, text) FROM %I', client_role);
      EXECUTE format(
        'REVOKE ALL ON FUNCTION crm_read_policy_evidence_touches_validated(text, integer, integer) FROM %I',
        client_role
      );
      EXECUTE format(
        'REVOKE ALL ON FUNCTION crm_read_policy_evidence_row_touches_validated(text, text) FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END;
$$;

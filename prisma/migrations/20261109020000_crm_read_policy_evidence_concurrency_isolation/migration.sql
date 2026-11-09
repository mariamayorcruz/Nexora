-- Point 8 / 4A-1C-0c: evidence parent locks + cross-org freeze (additive).
-- After 20261109010000_crm_read_policy_evidence_candidate_anchor.
-- Does NOT rewrite prior migrations.
--
-- 1) contentRevision on CrmReadPolicyBundle — bumped on evidence DML against a
--    candidate so overlapping seal/attestation paths can detect content drift
--    (experimental; seal service still out of scope).
-- 2) FOR UPDATE on candidate bundle(s) for evidence / field-class DML.
-- 3) Forbid organizationId rewrite on evidence and field-class rows.
-- Preserves 0b candidate-anchor (toVersion VALIDATED ⇒ immutable).
-- No GUC / session markers / product bypasses.

ALTER TABLE "CrmReadPolicyBundle"
  ADD COLUMN IF NOT EXISTS "contentRevision" BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION crm_read_policy_lock_bundle_by_version(
  p_org_id text,
  p_version integer
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_id text;
BEGIN
  SELECT b."id" INTO v_id
  FROM "CrmReadPolicyBundle" b
  WHERE b."organizationId" = p_org_id
    AND b."version" = p_version
  FOR UPDATE;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'crm_read_policy: cannot lock candidate bundle %.%', p_org_id, p_version
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION crm_read_policy_lock_two_candidates(
  p_org1 text,
  p_ver1 integer,
  p_org2 text,
  p_ver2 integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  a_org text;
  a_ver integer;
  b_org text;
  b_ver integer;
BEGIN
  IF p_org2 IS NULL OR p_ver2 IS NULL OR (p_org1 = p_org2 AND p_ver1 = p_ver2) THEN
    PERFORM crm_read_policy_lock_bundle_by_version(p_org1, p_ver1);
    RETURN;
  END IF;
  IF (p_org1 < p_org2) OR (p_org1 = p_org2 AND p_ver1 <= p_ver2) THEN
    a_org := p_org1; a_ver := p_ver1; b_org := p_org2; b_ver := p_ver2;
  ELSE
    a_org := p_org2; a_ver := p_ver2; b_org := p_org1; b_ver := p_ver1;
  END IF;
  PERFORM crm_read_policy_lock_bundle_by_version(a_org, a_ver);
  PERFORM crm_read_policy_lock_bundle_by_version(b_org, b_ver);
END;
$$;

CREATE OR REPLACE FUNCTION crm_read_policy_bump_content_revision(
  p_org_id text,
  p_version integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "CrmReadPolicyBundle"
  SET "contentRevision" = "contentRevision" + 1
  WHERE "organizationId" = p_org_id
    AND "version" = p_version;
END;
$$;

CREATE OR REPLACE FUNCTION crm_read_policy_evidence_to_version(
  p_org_id text,
  p_evidence_row_id text
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT e."toVersion"
  FROM "CrmReadPolicyChangeEvidence" e
  WHERE e."organizationId" = p_org_id
    AND e."id" = p_evidence_row_id;
$$;

-- Replace child immutability body: evidence path gains locks + org freeze;
-- non-evidence children unchanged in spirit.
CREATE OR REPLACE FUNCTION crm_read_policy_child_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_to integer;
  new_to integer;
BEGIN
  IF TG_TABLE_NAME = 'CrmReadPolicyChangeEvidence' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM crm_read_policy_lock_bundle_by_version(OLD."organizationId", OLD."toVersion");
      IF crm_read_policy_evidence_touches_validated(
        OLD."organizationId", OLD."fromVersion", OLD."toVersion"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence tied to VALIDATED bundle is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      PERFORM crm_read_policy_bump_content_revision(OLD."organizationId", OLD."toVersion");
      RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" THEN
        RAISE EXCEPTION 'crm_read_policy: evidence organizationId is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      PERFORM crm_read_policy_lock_two_candidates(
        OLD."organizationId", OLD."toVersion",
        NEW."organizationId", NEW."toVersion"
      );
      IF crm_read_policy_evidence_touches_validated(
        OLD."organizationId", OLD."fromVersion", OLD."toVersion"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence origin tied to VALIDATED bundle is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      IF crm_read_policy_evidence_touches_validated(
        NEW."organizationId", NEW."fromVersion", NEW."toVersion"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence destination tied to VALIDATED bundle is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      PERFORM crm_read_policy_bump_content_revision(OLD."organizationId", OLD."toVersion");
      IF NEW."toVersion" IS DISTINCT FROM OLD."toVersion" THEN
        PERFORM crm_read_policy_bump_content_revision(NEW."organizationId", NEW."toVersion");
      END IF;
      RETURN NEW;
    END IF;

    -- INSERT
    PERFORM crm_read_policy_lock_bundle_by_version(NEW."organizationId", NEW."toVersion");
    IF crm_read_policy_evidence_touches_validated(
      NEW."organizationId", NEW."fromVersion", NEW."toVersion"
    ) THEN
      RAISE EXCEPTION 'crm_read_policy: evidence destination tied to VALIDATED bundle is immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    PERFORM crm_read_policy_bump_content_revision(NEW."organizationId", NEW."toVersion");
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'CrmReadPolicyChangeEvidenceFieldClass' THEN
    IF TG_OP = 'DELETE' THEN
      old_to := crm_read_policy_evidence_to_version(OLD."organizationId", OLD."evidenceRowId");
      PERFORM crm_read_policy_lock_bundle_by_version(OLD."organizationId", old_to);
      IF crm_read_policy_evidence_row_touches_validated(
        OLD."organizationId", OLD."evidenceRowId"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence field classes on VALIDATED succession are immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      PERFORM crm_read_policy_bump_content_revision(OLD."organizationId", old_to);
      RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" THEN
        RAISE EXCEPTION 'crm_read_policy: evidence field-class organizationId is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      old_to := crm_read_policy_evidence_to_version(OLD."organizationId", OLD."evidenceRowId");
      new_to := crm_read_policy_evidence_to_version(NEW."organizationId", NEW."evidenceRowId");
      PERFORM crm_read_policy_lock_two_candidates(
        OLD."organizationId", old_to,
        NEW."organizationId", new_to
      );
      IF crm_read_policy_evidence_row_touches_validated(
        OLD."organizationId", OLD."evidenceRowId"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence field-class origin on VALIDATED succession is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      IF crm_read_policy_evidence_row_touches_validated(
        NEW."organizationId", NEW."evidenceRowId"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence field-class destination on VALIDATED succession is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      PERFORM crm_read_policy_bump_content_revision(OLD."organizationId", old_to);
      IF new_to IS DISTINCT FROM old_to THEN
        PERFORM crm_read_policy_bump_content_revision(NEW."organizationId", new_to);
      END IF;
      RETURN NEW;
    END IF;

    -- INSERT
    new_to := crm_read_policy_evidence_to_version(NEW."organizationId", NEW."evidenceRowId");
    PERFORM crm_read_policy_lock_bundle_by_version(NEW."organizationId", new_to);
    IF crm_read_policy_evidence_row_touches_validated(
      NEW."organizationId", NEW."evidenceRowId"
    ) THEN
      RAISE EXCEPTION 'crm_read_policy: evidence field-class destination on VALIDATED succession is immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    PERFORM crm_read_policy_bump_content_revision(NEW."organizationId", new_to);
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

REVOKE ALL ON FUNCTION crm_read_policy_lock_bundle_by_version(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_lock_two_candidates(text, integer, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_bump_content_revision(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_evidence_to_version(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_child_immutability() FROM PUBLIC;

DO $$
DECLARE
  client_role text;
  fn text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'authenticator']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      FOREACH fn IN ARRAY ARRAY[
        'crm_read_policy_lock_bundle_by_version(text, integer)',
        'crm_read_policy_lock_two_candidates(text, integer, text, integer)',
        'crm_read_policy_bump_content_revision(text, integer)',
        'crm_read_policy_evidence_to_version(text, text)',
        'crm_read_policy_child_immutability()'
      ]
      LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, client_role);
      END LOOP;
    END IF;
  END LOOP;
END $$;

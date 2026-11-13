-- Point 8 / 4A-1C-1A: full content stability on the real CRM read-policy schema.
-- Additive on top of 4A-1B + 4A-1C-0b/0c. No operational seal, no HMAC,
-- no HTTP/runtime activation, and no production grant to a sealer.
--
-- Goals:
-- 1) Every DML path that changes candidate content takes the parent bundle lock(s).
-- 2) Every such mutation bumps contentRevision on the affected DRAFT candidate(s).
-- 3) Moves lock OLD+NEW deterministically to avoid lock-order inversion.
-- 4) Evidence keeps candidate-anchor semantics: a VALIDATED predecessor alone does
--    not block preparation of evidence for a DRAFT candidate.
-- 5) Bundle identity is frozen after INSERT; DRAFT canonical/predecessor edits bump
--    contentRevision. Direct revision writes may only advance by exactly one.
-- 6) Ordinary/client roles do not receive helper EXECUTE or TRUNCATE capability.

-- ---------------------------------------------------------------------------
-- Parent-lock helpers for bundle-scoped children
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION crm_read_policy_lock_bundle_by_id(
  p_org_id text,
  p_bundle_id text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_version integer;
BEGIN
  SELECT b."version" INTO v_version
  FROM "CrmReadPolicyBundle" b
  WHERE b."organizationId" = p_org_id
    AND b."id" = p_bundle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_read_policy: cannot lock bundle %.%', p_org_id, p_bundle_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN v_version;
END;
$$;

CREATE OR REPLACE FUNCTION crm_read_policy_lock_two_bundles(
  p_org1 text,
  p_bundle1 text,
  p_org2 text,
  p_bundle2 text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  a_org text;
  a_bundle text;
  b_org text;
  b_bundle text;
BEGIN
  IF p_org2 IS NULL OR p_bundle2 IS NULL
     OR (p_org1 = p_org2 AND p_bundle1 = p_bundle2) THEN
    PERFORM crm_read_policy_lock_bundle_by_id(p_org1, p_bundle1);
    RETURN;
  END IF;

  IF (p_org1 < p_org2) OR (p_org1 = p_org2 AND p_bundle1 <= p_bundle2) THEN
    a_org := p_org1; a_bundle := p_bundle1;
    b_org := p_org2; b_bundle := p_bundle2;
  ELSE
    a_org := p_org2; a_bundle := p_bundle2;
    b_org := p_org1; b_bundle := p_bundle1;
  END IF;

  PERFORM crm_read_policy_lock_bundle_by_id(a_org, a_bundle);
  PERFORM crm_read_policy_lock_bundle_by_id(b_org, b_bundle);
END;
$$;

CREATE OR REPLACE FUNCTION crm_read_policy_bump_content_revision_by_id(
  p_org_id text,
  p_bundle_id text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "CrmReadPolicyBundle"
  SET "contentRevision" = "contentRevision" + 1
  WHERE "organizationId" = p_org_id
    AND "id" = p_bundle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_read_policy: cannot bump bundle %.%', p_org_id, p_bundle_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
END;
$$;

-- Lock every distinct from/to bundle implicated by OLD/NEW evidence state.
CREATE OR REPLACE FUNCTION crm_read_policy_lock_evidence_parent_versions(
  p_old_org text,
  p_old_from integer,
  p_old_to integer,
  p_new_org text,
  p_new_from integer,
  p_new_to integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT x.org_id, x.version_id
    FROM (
      VALUES
        (p_old_org, p_old_from),
        (p_old_org, p_old_to),
        (p_new_org, p_new_from),
        (p_new_org, p_new_to)
    ) AS x(org_id, version_id)
    WHERE x.org_id IS NOT NULL
      AND x.version_id IS NOT NULL
    ORDER BY x.org_id, x.version_id
  LOOP
    PERFORM crm_read_policy_lock_bundle_by_version(r.org_id, r.version_id);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Bundle trigger: immutable identity + revision discipline
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION crm_read_policy_bundle_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_changed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus" THEN
      RAISE EXCEPTION 'crm_read_policy: INSERT of VALIDATED bundle blocked pending transactional sealing service'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW."contentRevision" <> 0 THEN
      RAISE EXCEPTION 'crm_read_policy: new DRAFT bundle must start at contentRevision 0'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus" THEN
      RAISE EXCEPTION 'crm_read_policy: VALIDATED bundle % is immutable', OLD."id"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    -- DELETE itself owns the row lock. Cascaded child deletes must not try to
    -- revise a parent that is disappearing.
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

  -- Identity is structural, not editable candidate content.
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."version" IS DISTINCT FROM OLD."version" THEN
    RAISE EXCEPTION 'crm_read_policy: bundle identity (id, organizationId, version) is immutable'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  canonical_changed :=
       NEW."canonicalVersion" IS DISTINCT FROM OLD."canonicalVersion"
    OR NEW."predecessorOrganizationId" IS DISTINCT FROM OLD."predecessorOrganizationId"
    OR NEW."predecessorVersion" IS DISTINCT FROM OLD."predecessorVersion";

  IF canonical_changed THEN
    -- Override caller input: one canonical/succession mutation => one revision.
    NEW."contentRevision" := OLD."contentRevision" + 1;
  ELSIF NEW."contentRevision" IS DISTINCT FROM OLD."contentRevision" THEN
    -- Internal child helpers bump exactly one step. Reject rollback/jumps that
    -- could make a previously issued attestation current again.
    IF NEW."contentRevision" <> OLD."contentRevision" + 1 THEN
      RAISE EXCEPTION 'crm_read_policy: contentRevision must advance exactly one step'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Child/evidence trigger: lock -> immutability -> revision bump
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION crm_read_policy_child_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_from integer;
  old_to integer;
  new_from integer;
  new_to integer;
BEGIN
  -- Evidence row itself. Candidate-anchor semantics remain based on toVersion,
  -- but both predecessor and candidate rows are locked for succession stability.
  IF TG_TABLE_NAME = 'CrmReadPolicyChangeEvidence' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM crm_read_policy_lock_evidence_parent_versions(
        OLD."organizationId", OLD."fromVersion", OLD."toVersion",
        NULL, NULL, NULL
      );
      IF crm_read_policy_evidence_touches_validated(
        OLD."organizationId", OLD."fromVersion", OLD."toVersion"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence tied to VALIDATED candidate is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      PERFORM crm_read_policy_bump_content_revision(
        OLD."organizationId", OLD."toVersion"
      );
      RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" THEN
        RAISE EXCEPTION 'crm_read_policy: evidence organizationId is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;

      PERFORM crm_read_policy_lock_evidence_parent_versions(
        OLD."organizationId", OLD."fromVersion", OLD."toVersion",
        NEW."organizationId", NEW."fromVersion", NEW."toVersion"
      );

      IF crm_read_policy_evidence_touches_validated(
        OLD."organizationId", OLD."fromVersion", OLD."toVersion"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence origin tied to VALIDATED candidate is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      IF crm_read_policy_evidence_touches_validated(
        NEW."organizationId", NEW."fromVersion", NEW."toVersion"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence destination tied to VALIDATED candidate is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;

      PERFORM crm_read_policy_bump_content_revision(
        OLD."organizationId", OLD."toVersion"
      );
      IF NEW."toVersion" IS DISTINCT FROM OLD."toVersion" THEN
        PERFORM crm_read_policy_bump_content_revision(
          NEW."organizationId", NEW."toVersion"
        );
      END IF;
      RETURN NEW;
    END IF;

    -- INSERT
    PERFORM crm_read_policy_lock_evidence_parent_versions(
      NULL, NULL, NULL,
      NEW."organizationId", NEW."fromVersion", NEW."toVersion"
    );
    IF crm_read_policy_evidence_touches_validated(
      NEW."organizationId", NEW."fromVersion", NEW."toVersion"
    ) THEN
      RAISE EXCEPTION 'crm_read_policy: evidence destination tied to VALIDATED candidate is immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    PERFORM crm_read_policy_bump_content_revision(
      NEW."organizationId", NEW."toVersion"
    );
    RETURN NEW;
  END IF;

  -- Evidence field classes resolve their parent evidence row to succession
  -- versions, lock all affected bundles, then bump only candidate toVersion.
  IF TG_TABLE_NAME = 'CrmReadPolicyChangeEvidenceFieldClass' THEN
    IF TG_OP = 'DELETE' THEN
      -- FK cascade from evidence DELETE is already covered/bumped by the parent.
      IF pg_trigger_depth() > 1 THEN
        RETURN OLD;
      END IF;

      SELECT e."fromVersion", e."toVersion"
      INTO old_from, old_to
      FROM "CrmReadPolicyChangeEvidence" e
      WHERE e."organizationId" = OLD."organizationId"
        AND e."id" = OLD."evidenceRowId";

      IF NOT FOUND THEN
        RAISE EXCEPTION 'crm_read_policy: evidence row %.% not found',
          OLD."organizationId", OLD."evidenceRowId"
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      PERFORM crm_read_policy_lock_evidence_parent_versions(
        OLD."organizationId", old_from, old_to,
        NULL, NULL, NULL
      );
      IF crm_read_policy_evidence_row_touches_validated(
        OLD."organizationId", OLD."evidenceRowId"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence field classes on VALIDATED candidate are immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      PERFORM crm_read_policy_bump_content_revision(
        OLD."organizationId", old_to
      );
      RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" THEN
        RAISE EXCEPTION 'crm_read_policy: evidence field-class organizationId is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;

      SELECT e."fromVersion", e."toVersion"
      INTO old_from, old_to
      FROM "CrmReadPolicyChangeEvidence" e
      WHERE e."organizationId" = OLD."organizationId"
        AND e."id" = OLD."evidenceRowId";

      IF NOT FOUND THEN
        RAISE EXCEPTION 'crm_read_policy: old evidence row %.% not found',
          OLD."organizationId", OLD."evidenceRowId"
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      SELECT e."fromVersion", e."toVersion"
      INTO new_from, new_to
      FROM "CrmReadPolicyChangeEvidence" e
      WHERE e."organizationId" = NEW."organizationId"
        AND e."id" = NEW."evidenceRowId";

      IF NOT FOUND THEN
        RAISE EXCEPTION 'crm_read_policy: new evidence row %.% not found',
          NEW."organizationId", NEW."evidenceRowId"
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      PERFORM crm_read_policy_lock_evidence_parent_versions(
        OLD."organizationId", old_from, old_to,
        NEW."organizationId", new_from, new_to
      );

      IF crm_read_policy_evidence_row_touches_validated(
        OLD."organizationId", OLD."evidenceRowId"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence field-class origin on VALIDATED candidate is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      IF crm_read_policy_evidence_row_touches_validated(
        NEW."organizationId", NEW."evidenceRowId"
      ) THEN
        RAISE EXCEPTION 'crm_read_policy: evidence field-class destination on VALIDATED candidate is immutable'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;

      PERFORM crm_read_policy_bump_content_revision(
        OLD."organizationId", old_to
      );
      -- If the row moves to another evidence row for the same candidate,
      -- this is still one mutation of one candidate: bump once, not twice.
      -- A second bump is required only when the candidate toVersion changes.
      IF new_to IS DISTINCT FROM old_to THEN
        PERFORM crm_read_policy_bump_content_revision(
          NEW."organizationId", new_to
        );
      END IF;
      RETURN NEW;
    END IF;

    -- INSERT
    SELECT e."fromVersion", e."toVersion"
    INTO new_from, new_to
    FROM "CrmReadPolicyChangeEvidence" e
    WHERE e."organizationId" = NEW."organizationId"
      AND e."id" = NEW."evidenceRowId";

    IF NOT FOUND THEN
      RAISE EXCEPTION 'crm_read_policy: evidence row %.% not found',
        NEW."organizationId", NEW."evidenceRowId"
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    PERFORM crm_read_policy_lock_evidence_parent_versions(
      NULL, NULL, NULL,
      NEW."organizationId", new_from, new_to
    );
    IF crm_read_policy_evidence_row_touches_validated(
      NEW."organizationId", NEW."evidenceRowId"
    ) THEN
      RAISE EXCEPTION 'crm_read_policy: evidence field-class destination on VALIDATED candidate is immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    PERFORM crm_read_policy_bump_content_revision(
      NEW."organizationId", new_to
    );
    RETURN NEW;
  END IF;

  -- Bundle-scoped children:
  -- MembershipLink, LeadLink, RetiredGrantLogicalId, Grant, GrantFieldClass,
  -- Restriction, RestrictionFieldClass.
  IF TG_OP = 'DELETE' THEN
    -- Parent/grant cascade deletes are already covered by the originating row
    -- or by deletion of the DRAFT bundle itself. Avoid touching a disappearing
    -- parent row and avoid redundant revision bumps in nested cascades.
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;

    PERFORM crm_read_policy_lock_bundle_by_id(
      OLD."organizationId", OLD."bundleId"
    );
    IF crm_read_policy_bundle_is_validated(
      OLD."organizationId", OLD."bundleId"
    ) THEN
      RAISE EXCEPTION 'crm_read_policy: child rows of VALIDATED bundle % are immutable', OLD."bundleId"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    PERFORM crm_read_policy_bump_content_revision_by_id(
      OLD."organizationId", OLD."bundleId"
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" THEN
      RAISE EXCEPTION 'crm_read_policy: child organizationId is immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    PERFORM crm_read_policy_lock_two_bundles(
      OLD."organizationId", OLD."bundleId",
      NEW."organizationId", NEW."bundleId"
    );

    IF crm_read_policy_bundle_is_validated(
      OLD."organizationId", OLD."bundleId"
    ) THEN
      RAISE EXCEPTION 'crm_read_policy: child origin on VALIDATED bundle % is immutable', OLD."bundleId"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF crm_read_policy_bundle_is_validated(
      NEW."organizationId", NEW."bundleId"
    ) THEN
      RAISE EXCEPTION 'crm_read_policy: child destination on VALIDATED bundle % is immutable', NEW."bundleId"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    PERFORM crm_read_policy_bump_content_revision_by_id(
      OLD."organizationId", OLD."bundleId"
    );
    IF NEW."bundleId" IS DISTINCT FROM OLD."bundleId" THEN
      PERFORM crm_read_policy_bump_content_revision_by_id(
        NEW."organizationId", NEW."bundleId"
      );
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT
  PERFORM crm_read_policy_lock_bundle_by_id(
    NEW."organizationId", NEW."bundleId"
  );
  IF crm_read_policy_bundle_is_validated(
    NEW."organizationId", NEW."bundleId"
  ) THEN
    RAISE EXCEPTION 'crm_read_policy: child destination on VALIDATED bundle % is immutable', NEW."bundleId"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  PERFORM crm_read_policy_bump_content_revision_by_id(
    NEW."organizationId", NEW."bundleId"
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Least privilege for helper functions and content tables
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION crm_read_policy_lock_bundle_by_id(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_lock_two_bundles(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_bump_content_revision_by_id(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_lock_evidence_parent_versions(text, integer, integer, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_bundle_immutability() FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_child_immutability() FROM PUBLIC;

DO $$
DECLARE
  client_role text;
  fn text;
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
  FOREACH client_role IN ARRAY ARRAY[
    'anon', 'authenticated', 'authenticator', 'service_role',
    'nexora_app', 'nexora_sealer'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      FOREACH fn IN ARRAY ARRAY[
        'crm_read_policy_lock_bundle_by_id(text, text)',
        'crm_read_policy_lock_two_bundles(text, text, text, text)',
        'crm_read_policy_bump_content_revision_by_id(text, text)',
        'crm_read_policy_lock_evidence_parent_versions(text, integer, integer, text, integer, integer)',
        'crm_read_policy_lock_bundle_by_version(text, integer)',
        'crm_read_policy_lock_two_candidates(text, integer, text, integer)',
        'crm_read_policy_bump_content_revision(text, integer)',
        'crm_read_policy_evidence_to_version(text, text)',
        'crm_read_policy_bundle_immutability()',
        'crm_read_policy_child_immutability()'
      ]
      LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, client_role);
      END LOOP;

      FOREACH tbl IN ARRAY tables
      LOOP
        -- Existing client roles were already restricted in 4A-1B. Repeat the
        -- explicit boundary here, now including service/future app roles.
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', tbl, client_role);
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- Locks, content_revision bumps, immutability, and ALT-H seal function (lab only).

CREATE OR REPLACE FUNCTION lab_alth.lock_bundle(p_org text, p_bundle_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1
  FROM lab_alth.lab_bundle b
  WHERE b.organization_id = p_org AND b.id = p_bundle_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lab_alth: bundle %.% not found for lock', p_org, p_bundle_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION lab_alth.lock_bundle_by_version(p_org text, p_version integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_id text;
BEGIN
  SELECT b.id INTO v_id
  FROM lab_alth.lab_bundle b
  WHERE b.organization_id = p_org AND b.version = p_version
  FOR UPDATE;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'lab_alth: bundle version %.% not found for lock', p_org, p_version
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION lab_alth.bump_revision(p_org text, p_bundle_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE lab_alth.lab_bundle
  SET content_revision = content_revision + 1
  WHERE organization_id = p_org AND id = p_bundle_id;
END;
$$;

CREATE OR REPLACE FUNCTION lab_alth.bundle_is_validated(p_org text, p_bundle_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lab_alth.lab_bundle b
    WHERE b.organization_id = p_org AND b.id = p_bundle_id AND b.status = 'VALIDATED'
  );
$$;

-- Deterministic lock of up to two bundle parents (org,id) pairs.
CREATE OR REPLACE FUNCTION lab_alth.lock_two_bundles(
  p_org1 text, p_id1 text,
  p_org2 text, p_id2 text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_org1 IS NULL OR p_id1 IS NULL THEN
    PERFORM lab_alth.lock_bundle(p_org2, p_id2);
    RETURN;
  END IF;
  IF p_org2 IS NULL OR p_id2 IS NULL OR (p_org1 = p_org2 AND p_id1 = p_id2) THEN
    PERFORM lab_alth.lock_bundle(p_org1, p_id1);
    RETURN;
  END IF;
  IF (p_org1 < p_org2) OR (p_org1 = p_org2 AND p_id1 < p_id2) THEN
    PERFORM lab_alth.lock_bundle(p_org1, p_id1);
    PERFORM lab_alth.lock_bundle(p_org2, p_id2);
  ELSE
    PERFORM lab_alth.lock_bundle(p_org2, p_id2);
    PERFORM lab_alth.lock_bundle(p_org1, p_id1);
  END IF;
END;
$$;

-- Bundle immutability + canonical self-bump
CREATE OR REPLACE FUNCTION lab_alth.trg_bundle_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'VALIDATED' THEN
      RAISE EXCEPTION 'lab_alth: INSERT VALIDATED blocked';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'VALIDATED' THEN
      RAISE EXCEPTION 'lab_alth: VALIDATED bundle immutable';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.status = 'VALIDATED' THEN
    RAISE EXCEPTION 'lab_alth: VALIDATED bundle immutable';
  END IF;

  IF NEW.status = 'VALIDATED' AND OLD.status = 'DRAFT' THEN
    -- Only allowed when seal function set a transaction-local marker after MAC OK.
    IF current_setting('lab_alth.seal_mac_ok', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'lab_alth: DRAFT→VALIDATED blocked without seal MAC path';
    END IF;
    -- Minimal column change enforced loosely: status must flip; content_checksum required.
    IF NEW.content_checksum IS NULL OR length(NEW.content_checksum) = 0 THEN
      RAISE EXCEPTION 'lab_alth: VALIDATED requires content_checksum';
    END IF;
    RETURN NEW;
  END IF;

  -- Content-affecting draft updates bump revision (not seal-only fields alone).
  IF NEW.canonical_version IS DISTINCT FROM OLD.canonical_version
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.predecessor_organization_id IS DISTINCT FROM OLD.predecessor_organization_id
     OR NEW.predecessor_version IS DISTINCT FROM OLD.predecessor_version
  THEN
    NEW.content_revision := OLD.content_revision + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lab_bundle_guard ON lab_alth.lab_bundle;
CREATE TRIGGER trg_lab_bundle_guard
  BEFORE INSERT OR UPDATE OR DELETE ON lab_alth.lab_bundle
  FOR EACH ROW EXECUTE FUNCTION lab_alth.trg_bundle_guard();

-- Child tables with bundle_id
CREATE OR REPLACE FUNCTION lab_alth.trg_child_bundle_scoped()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM lab_alth.lock_bundle(OLD.organization_id, OLD.bundle_id);
    IF lab_alth.bundle_is_validated(OLD.organization_id, OLD.bundle_id) THEN
      RAISE EXCEPTION 'lab_alth: child of VALIDATED immutable';
    END IF;
    PERFORM lab_alth.bump_revision(OLD.organization_id, OLD.bundle_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM lab_alth.lock_two_bundles(
      OLD.organization_id, OLD.bundle_id,
      NEW.organization_id, NEW.bundle_id
    );
    IF lab_alth.bundle_is_validated(OLD.organization_id, OLD.bundle_id)
       OR lab_alth.bundle_is_validated(NEW.organization_id, NEW.bundle_id) THEN
      RAISE EXCEPTION 'lab_alth: child transfer touching VALIDATED blocked';
    END IF;
    PERFORM lab_alth.bump_revision(OLD.organization_id, OLD.bundle_id);
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.bundle_id IS DISTINCT FROM OLD.bundle_id THEN
      PERFORM lab_alth.bump_revision(NEW.organization_id, NEW.bundle_id);
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT
  PERFORM lab_alth.lock_bundle(NEW.organization_id, NEW.bundle_id);
  IF lab_alth.bundle_is_validated(NEW.organization_id, NEW.bundle_id) THEN
    RAISE EXCEPTION 'lab_alth: child insert on VALIDATED blocked';
  END IF;
  PERFORM lab_alth.bump_revision(NEW.organization_id, NEW.bundle_id);
  RETURN NEW;
END;
$$;

-- Evidence: lock from/to version bundles; bump to_version candidate always
CREATE OR REPLACE FUNCTION lab_alth.trg_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  from_id text;
  to_id text;
  old_from_id text;
  old_to_id text;
BEGIN
  -- Lab policy (4A-1C intent): allow evidence while candidate (to_version) is DRAFT
  -- even if predecessor (from_version) is already VALIDATED. Block once candidate is VALIDATED.
  -- NOTE: literal PR #24 touches-validated-on-either-endpoint would block this path;
  -- that product gap is recorded as a lab finding for 4A-1C-1 planning.
  IF TG_OP = 'DELETE' THEN
    old_from_id := lab_alth.lock_bundle_by_version(OLD.organization_id, OLD.from_version);
    old_to_id := lab_alth.lock_bundle_by_version(OLD.organization_id, OLD.to_version);
    IF lab_alth.bundle_is_validated(OLD.organization_id, old_to_id) THEN
      RAISE EXCEPTION 'lab_alth: evidence on VALIDATED candidate immutable';
    END IF;
    PERFORM lab_alth.bump_revision(OLD.organization_id, old_to_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_from_id := lab_alth.lock_bundle_by_version(OLD.organization_id, OLD.from_version);
    old_to_id := lab_alth.lock_bundle_by_version(OLD.organization_id, OLD.to_version);
    from_id := lab_alth.lock_bundle_by_version(NEW.organization_id, NEW.from_version);
    to_id := lab_alth.lock_bundle_by_version(NEW.organization_id, NEW.to_version);
    PERFORM lab_alth.lock_two_bundles(OLD.organization_id, old_to_id, NEW.organization_id, to_id);
    IF lab_alth.bundle_is_validated(OLD.organization_id, old_to_id)
       OR lab_alth.bundle_is_validated(NEW.organization_id, to_id) THEN
      RAISE EXCEPTION 'lab_alth: evidence update on VALIDATED candidate blocked';
    END IF;
    PERFORM lab_alth.bump_revision(OLD.organization_id, old_to_id);
    IF to_id IS DISTINCT FROM old_to_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      PERFORM lab_alth.bump_revision(NEW.organization_id, to_id);
    END IF;
    RETURN NEW;
  END IF;

  from_id := lab_alth.lock_bundle_by_version(NEW.organization_id, NEW.from_version);
  to_id := lab_alth.lock_bundle_by_version(NEW.organization_id, NEW.to_version);
  IF lab_alth.bundle_is_validated(NEW.organization_id, to_id) THEN
    RAISE EXCEPTION 'lab_alth: evidence insert on VALIDATED candidate blocked';
  END IF;
  PERFORM lab_alth.bump_revision(NEW.organization_id, to_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION lab_alth.trg_evidence_fc()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  org text;
  evid text;
  from_v integer;
  to_v integer;
  to_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    org := OLD.organization_id; evid := OLD.evidence_row_id;
  ELSE
    org := NEW.organization_id; evid := NEW.evidence_row_id;
  END IF;

  SELECT e.from_version, e.to_version INTO from_v, to_v
  FROM lab_alth.lab_change_evidence e
  WHERE e.organization_id = org AND e.id = evid;

  PERFORM lab_alth.lock_bundle_by_version(org, from_v);
  to_id := lab_alth.lock_bundle_by_version(org, to_v);

  IF lab_alth.bundle_is_validated(org, to_id) THEN
    RAISE EXCEPTION 'lab_alth: evidence field-class on VALIDATED blocked';
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM lab_alth.bump_revision(org, to_id);
    RETURN OLD;
  END IF;

  PERFORM lab_alth.bump_revision(org, to_id);
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lab_membership_link',
    'lab_lead_link',
    'lab_retired_logical_id',
    'lab_grant',
    'lab_grant_field_class',
    'lab_restriction',
    'lab_restriction_field_class'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_lab_child ON lab_alth.%I; CREATE TRIGGER trg_lab_child BEFORE INSERT OR UPDATE OR DELETE ON lab_alth.%I FOR EACH ROW EXECUTE FUNCTION lab_alth.trg_child_bundle_scoped();',
      t, t
    );
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_lab_evidence ON lab_alth.lab_change_evidence;
CREATE TRIGGER trg_lab_evidence
  BEFORE INSERT OR UPDATE OR DELETE ON lab_alth.lab_change_evidence
  FOR EACH ROW EXECUTE FUNCTION lab_alth.trg_evidence();

DROP TRIGGER IF EXISTS trg_lab_evidence_fc ON lab_alth.lab_change_evidence_field_class;
CREATE TRIGGER trg_lab_evidence_fc
  BEFORE INSERT OR UPDATE OR DELETE ON lab_alth.lab_change_evidence_field_class
  FOR EACH ROW EXECUTE FUNCTION lab_alth.trg_evidence_fc();

-- Canonical attestation bytes: fixed field order as text (lab contract).
CREATE OR REPLACE FUNCTION lab_alth.attestation_canonical(p jsonb)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT convert_to(
    concat_ws('|',
      coalesce(p->>'v', ''),
      coalesce(p->>'keyId', ''),
      coalesce(p->>'organizationId', ''),
      coalesce(p->>'bundleId', ''),
      coalesce(p->>'version', ''),
      coalesce(p->>'canonicalVersion', ''),
      coalesce(p->>'contentChecksum', ''),
      coalesce(p->>'contentRevision', ''),
      coalesce(p->>'predecessorVersion', ''),
      coalesce(p->>'predecessorChecksum', ''),
      coalesce(p->>'issuedAt', ''),
      coalesce(p->>'nonce', '')
    ),
    'UTF8'
  );
$$;

-- Seal function: verifies HMAC then flips DRAFT→VALIDATED.
-- NOTE: equality compare only — lab does NOT claim constant-time resistance.
CREATE OR REPLACE FUNCTION lab_alth.seal_bundle(p_attestation jsonb, p_mac bytea, p_audit jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, lab_alth, lab_alth_internal, public
AS $$
DECLARE
  v_key_id text := p_attestation->>'keyId';
  v_secret bytea;
  v_status text;
  v_expected bytea;
  v_org text := p_attestation->>'organizationId';
  v_bundle text := p_attestation->>'bundleId';
  v_version integer := (p_attestation->>'version')::integer;
  v_revision bigint := (p_attestation->>'contentRevision')::bigint;
  v_checksum text := p_attestation->>'contentChecksum';
  v_issued timestamptz := (p_attestation->>'issuedAt')::timestamptz;
  v_nonce text := p_attestation->>'nonce';
  v_row lab_alth.lab_bundle%ROWTYPE;
  v_pred lab_alth.lab_bundle%ROWTYPE;
BEGIN
  IF p_mac IS NULL OR length(p_mac) = 0 THEN
    RAISE EXCEPTION 'lab_alth: mac required';
  END IF;
  IF v_key_id IS NULL OR v_org IS NULL OR v_bundle IS NULL OR v_checksum IS NULL OR v_nonce IS NULL THEN
    RAISE EXCEPTION 'lab_alth: attestation incomplete';
  END IF;
  IF v_issued IS NULL OR v_issued < now() - interval '60 seconds' OR v_issued > now() + interval '5 seconds' THEN
    RAISE EXCEPTION 'lab_alth: attestation expired or skew';
  END IF;

  SELECT k.secret, k.status INTO v_secret, v_status
  FROM lab_alth_internal.seal_hmac_key k
  WHERE k.key_id = v_key_id;

  IF v_secret IS NULL OR v_status NOT IN ('active', 'verify_only') THEN
    RAISE EXCEPTION 'lab_alth: unknown or revoked keyId';
  END IF;

  -- pgcrypto hmac (lab DB installs extension into public/search_path).
  v_expected := hmac(lab_alth.attestation_canonical(p_attestation), v_secret, 'sha256');

  -- Explicit length check + equality (no timing claim).
  IF length(p_mac) <> length(v_expected) OR p_mac IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'lab_alth: mac mismatch';
  END IF;

  SELECT * INTO v_row
  FROM lab_alth.lab_bundle
  WHERE organization_id = v_org AND id = v_bundle
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lab_alth: bundle not found';
  END IF;

  IF v_row.status = 'VALIDATED' THEN
    IF v_row.content_checksum = v_checksum AND v_row.version = v_version THEN
      RETURN jsonb_build_object('kind', 'already_sealed', 'organizationId', v_org, 'bundleId', v_bundle);
    END IF;
    RAISE EXCEPTION 'lab_alth: conflict_immutable';
  END IF;

  IF v_row.status <> 'DRAFT' OR v_row.version <> v_version OR v_row.content_revision <> v_revision THEN
    RAISE EXCEPTION 'lab_alth: revision or draft precondition failed';
  END IF;

  IF v_version > 1 THEN
    SELECT * INTO v_pred
    FROM lab_alth.lab_bundle
    WHERE organization_id = v_org AND version = (p_attestation->>'predecessorVersion')::integer
    FOR UPDATE;
    IF NOT FOUND OR v_pred.status <> 'VALIDATED' THEN
      RAISE EXCEPTION 'lab_alth: predecessor must be VALIDATED';
    END IF;
    IF v_pred.content_checksum IS DISTINCT FROM (p_attestation->>'predecessorChecksum') THEN
      RAISE EXCEPTION 'lab_alth: predecessor checksum mismatch';
    END IF;
  END IF;

  PERFORM set_config('lab_alth.seal_mac_ok', '1', true);

  UPDATE lab_alth.lab_bundle
  SET status = 'VALIDATED',
      content_checksum = v_checksum,
      sealed_at = now(),
      sealed_by_actor_id = p_audit->>'actorId',
      seal_key_id = v_key_id,
      seal_nonce = v_nonce
  WHERE organization_id = v_org AND id = v_bundle;

  PERFORM set_config('lab_alth.seal_mac_ok', '0', true);

  RETURN jsonb_build_object('kind', 'sealed', 'organizationId', v_org, 'bundleId', v_bundle, 'version', v_version);
END;
$$;

REVOKE ALL ON FUNCTION lab_alth.seal_bundle(jsonb, bytea, jsonb) FROM PUBLIC;

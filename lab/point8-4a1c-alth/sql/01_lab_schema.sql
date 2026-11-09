-- Point 8 / 4A-1C ALT-H security lab (DISPOSABLE ONLY).
-- Synthetic tables mirroring the ten PR #25 inventory categories.
-- Does NOT touch product migrations or CrmReadPolicy* tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP SCHEMA IF EXISTS lab_alth CASCADE;
DROP SCHEMA IF EXISTS lab_alth_internal CASCADE;

CREATE SCHEMA lab_alth_internal AUTHORIZATION CURRENT_USER;
CREATE SCHEMA lab_alth AUTHORIZATION CURRENT_USER;

REVOKE ALL ON SCHEMA lab_alth_internal FROM PUBLIC;
REVOKE ALL ON SCHEMA lab_alth FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- HMAC key registry (H-OWNER-TABLE lab analogue)
-- ---------------------------------------------------------------------------
CREATE TABLE lab_alth_internal.seal_hmac_key (
  key_id text PRIMARY KEY,
  secret bytea NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'verify_only', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz
);

CREATE UNIQUE INDEX seal_hmac_key_one_active
  ON lab_alth_internal.seal_hmac_key ((status))
  WHERE status = 'active';

REVOKE ALL ON TABLE lab_alth_internal.seal_hmac_key FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 1) Bundle
-- ---------------------------------------------------------------------------
CREATE TABLE lab_alth.lab_bundle (
  organization_id text NOT NULL,
  id text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL CHECK (status IN ('DRAFT', 'VALIDATED')) DEFAULT 'DRAFT',
  content_checksum text,
  content_revision bigint NOT NULL DEFAULT 0,
  predecessor_organization_id text,
  predecessor_version integer,
  canonical_version text NOT NULL DEFAULT 'lab-canonical/v1',
  sealed_at timestamptz,
  sealed_by_actor_id text,
  seal_key_id text,
  seal_nonce text,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, version)
);

-- ---------------------------------------------------------------------------
-- 2–4) Catalog / retired
-- ---------------------------------------------------------------------------
CREATE TABLE lab_alth.lab_membership_link (
  organization_id text NOT NULL,
  bundle_id text NOT NULL,
  membership_id text NOT NULL,
  PRIMARY KEY (organization_id, bundle_id, membership_id),
  FOREIGN KEY (organization_id, bundle_id)
    REFERENCES lab_alth.lab_bundle (organization_id, id) ON DELETE CASCADE
);

CREATE TABLE lab_alth.lab_lead_link (
  organization_id text NOT NULL,
  bundle_id text NOT NULL,
  lead_id text NOT NULL,
  PRIMARY KEY (organization_id, bundle_id, lead_id),
  FOREIGN KEY (organization_id, bundle_id)
    REFERENCES lab_alth.lab_bundle (organization_id, id) ON DELETE CASCADE
);

CREATE TABLE lab_alth.lab_retired_logical_id (
  organization_id text NOT NULL,
  bundle_id text NOT NULL,
  logical_id text NOT NULL,
  PRIMARY KEY (organization_id, bundle_id, logical_id),
  FOREIGN KEY (organization_id, bundle_id)
    REFERENCES lab_alth.lab_bundle (organization_id, id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- 5–8) Grants / restrictions + field classes
-- ---------------------------------------------------------------------------
CREATE TABLE lab_alth.lab_grant (
  organization_id text NOT NULL,
  bundle_id text NOT NULL,
  version_id text NOT NULL,
  logical_id text NOT NULL,
  payload text NOT NULL DEFAULT '',
  PRIMARY KEY (organization_id, bundle_id, version_id),
  UNIQUE (organization_id, bundle_id, logical_id),
  FOREIGN KEY (organization_id, bundle_id)
    REFERENCES lab_alth.lab_bundle (organization_id, id) ON DELETE CASCADE
);

CREATE TABLE lab_alth.lab_grant_field_class (
  organization_id text NOT NULL,
  bundle_id text NOT NULL,
  grant_version_id text NOT NULL,
  field_class text NOT NULL,
  PRIMARY KEY (organization_id, bundle_id, grant_version_id, field_class),
  FOREIGN KEY (organization_id, bundle_id, grant_version_id)
    REFERENCES lab_alth.lab_grant (organization_id, bundle_id, version_id) ON DELETE CASCADE
);

CREATE TABLE lab_alth.lab_restriction (
  organization_id text NOT NULL,
  bundle_id text NOT NULL,
  version_id text NOT NULL,
  logical_id text NOT NULL,
  payload text NOT NULL DEFAULT '',
  PRIMARY KEY (organization_id, bundle_id, version_id),
  UNIQUE (organization_id, bundle_id, logical_id),
  FOREIGN KEY (organization_id, bundle_id)
    REFERENCES lab_alth.lab_bundle (organization_id, id) ON DELETE CASCADE
);

CREATE TABLE lab_alth.lab_restriction_field_class (
  organization_id text NOT NULL,
  bundle_id text NOT NULL,
  restriction_version_id text NOT NULL,
  field_class text NOT NULL,
  PRIMARY KEY (organization_id, bundle_id, restriction_version_id, field_class),
  FOREIGN KEY (organization_id, bundle_id, restriction_version_id)
    REFERENCES lab_alth.lab_restriction (organization_id, bundle_id, version_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- 9–10) Evidence
-- ---------------------------------------------------------------------------
CREATE TABLE lab_alth.lab_change_evidence (
  organization_id text NOT NULL,
  id text NOT NULL,
  from_version integer NOT NULL,
  to_version integer NOT NULL,
  change_kind text NOT NULL,
  target_logical_id text NOT NULL,
  PRIMARY KEY (organization_id, id),
  CHECK (from_version < to_version),
  FOREIGN KEY (organization_id, from_version)
    REFERENCES lab_alth.lab_bundle (organization_id, version),
  FOREIGN KEY (organization_id, to_version)
    REFERENCES lab_alth.lab_bundle (organization_id, version)
);

CREATE TABLE lab_alth.lab_change_evidence_field_class (
  organization_id text NOT NULL,
  evidence_row_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('ADDED', 'REMOVED')),
  field_class text NOT NULL,
  PRIMARY KEY (organization_id, evidence_row_id, direction, field_class),
  FOREIGN KEY (organization_id, evidence_row_id)
    REFERENCES lab_alth.lab_change_evidence (organization_id, id) ON DELETE CASCADE
);

REVOKE ALL ON ALL TABLES IN SCHEMA lab_alth FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA lab_alth FROM PUBLIC;

-- Privilege matrix for disposable lab roles (synthetic passwords only).

GRANT USAGE ON SCHEMA lab_alth TO nexora_lab_app, nexora_lab_sealer;

-- App: DRAFT content DML, no status→VALIDATED, no secret, no seal EXECUTE.
-- Child tables: full DML. Bundle: SELECT/INSERT/DELETE + column UPDATE without status.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  lab_alth.lab_membership_link,
  lab_alth.lab_lead_link,
  lab_alth.lab_retired_logical_id,
  lab_alth.lab_grant,
  lab_alth.lab_grant_field_class,
  lab_alth.lab_restriction,
  lab_alth.lab_restriction_field_class,
  lab_alth.lab_change_evidence,
  lab_alth.lab_change_evidence_field_class
TO nexora_lab_app;

GRANT SELECT, INSERT, DELETE ON lab_alth.lab_bundle TO nexora_lab_app;
GRANT UPDATE (
  content_checksum,
  content_revision,
  predecessor_organization_id,
  predecessor_version,
  canonical_version,
  sealed_at,
  sealed_by_actor_id,
  seal_key_id,
  seal_nonce
) ON lab_alth.lab_bundle TO nexora_lab_app;
-- Explicitly ensure status is not updatable by app.
REVOKE UPDATE (status) ON lab_alth.lab_bundle FROM nexora_lab_app;

REVOKE ALL ON SCHEMA lab_alth_internal FROM nexora_lab_app;
REVOKE ALL ON TABLE lab_alth_internal.seal_hmac_key FROM nexora_lab_app;
REVOKE ALL ON FUNCTION lab_alth.seal_bundle(jsonb, bytea, jsonb) FROM nexora_lab_app;

-- Sealer: EXECUTE seal only (lab may GRANT for positive path); never secret SELECT.
GRANT USAGE ON SCHEMA lab_alth TO nexora_lab_sealer;
GRANT SELECT ON lab_alth.lab_bundle TO nexora_lab_sealer;
GRANT EXECUTE ON FUNCTION lab_alth.seal_bundle(jsonb, bytea, jsonb) TO nexora_lab_sealer;
REVOKE ALL ON SCHEMA lab_alth_internal FROM nexora_lab_sealer;
REVOKE ALL ON TABLE lab_alth_internal.seal_hmac_key FROM nexora_lab_sealer;

-- Truncate / trigger DDL denied for ordinary roles (default: only owner).
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA lab_alth FROM nexora_lab_app, nexora_lab_sealer;

-- Fail-closed product analogue helper: revoke sealer execute (tests re-grant when needed).
-- Default after setup keeps EXECUTE for lab positive cases; runner toggles REVOKE for N9-style tests.

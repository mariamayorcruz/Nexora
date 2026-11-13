-- Point 8 / 4A-1C-0b: evidence immutability candidate-anchor (additive).
-- Applied AFTER 20261031210000_crm_read_policy_candidate_persistence_hardening.
-- Does NOT rewrite prior migration history.
--
-- Semántica nueva (PR #25 Parte V):
--   La evidencia / field-classes son inmutables IFF el candidato (toVersion) está VALIDATED.
--   Un predecesor fromVersion VALIDATED NO bloquea preparar evidencia hacia un candidato DRAFT.
--
-- Sin GUC, sin marcadores de sesión, sin bypass generales.
-- Triggers existentes siguen llamando a estos helpers; solo cambia el cuerpo.

CREATE OR REPLACE FUNCTION crm_read_policy_evidence_touches_validated(
  p_org_id text,
  p_from_version integer,
  p_to_version integer
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- p_from_version retained for call-site compatibility; immutability anchors on candidate only.
  SELECT EXISTS (
    SELECT 1
    FROM "CrmReadPolicyBundle" b
    WHERE b."organizationId" = p_org_id
      AND b."version" = p_to_version
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
     AND b."version" = e."toVersion"
    WHERE e."organizationId" = p_org_id
      AND e."id" = p_evidence_row_id
      AND b."status" = 'VALIDATED'::"CrmReadPolicyBundleStatus"
  );
$$;

COMMENT ON FUNCTION crm_read_policy_evidence_touches_validated(text, integer, integer) IS
  '4A-1C-0b: true iff candidate toVersion bundle is VALIDATED (fromVersion ignored for anchor).';

COMMENT ON FUNCTION crm_read_policy_evidence_row_touches_validated(text, text) IS
  '4A-1C-0b: true iff evidence row candidate (toVersion) bundle is VALIDATED.';

-- Preserve client lockdown of helper functions (hardening pattern).
REVOKE ALL ON FUNCTION crm_read_policy_evidence_touches_validated(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION crm_read_policy_evidence_row_touches_validated(text, text) FROM PUBLIC;

DO $$
DECLARE
  client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'authenticator']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
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
END $$;

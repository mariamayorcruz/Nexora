# Point 8 — 4A-1C-1B design freeze: SealService security boundary

## Status

**DESIGN ONLY. No runtime code, migration, production secret, role grant, HTTP route, or CRM activation is authorized by this document.**

This design is stacked on PR #31 / 4A-1C-1A. PR #31 must merge and pass its post-merge gate before implementation of this design is authorized.

## Purpose

Freeze the security architecture for the future DRAFT → VALIDATED transition.

The seal must prove all of the following at one transaction boundary:

1. the candidate content was hydrated under the locks established by 4A-1C-1A;
2. the pure Point 8 format/succession validators accepted that exact content;
3. an authority verifier accepted the operation;
4. the candidate still has the same `contentRevision`;
5. the database received an attestation from the dedicated SealService, not from the ordinary application path;
6. the transition changes only seal/audit state and never mutates child policy content.

## Current Supabase facts used by this design

Verified against the current project:

- `pgcrypto` is installed in schema `extensions`.
- Supabase Vault is installed.
- `service_role` has `USAGE` on `vault` and `SELECT` on `vault.decrypted_secrets`.
- `anon` and `authenticated` do not have Vault schema usage.
- the repository has a server-side `SUPABASE_SERVICE_ROLE_KEY` configuration for Storage.
- Prisma uses `DATABASE_URL` as its database connection boundary.
- custom roles `nexora_app` and `nexora_sealer` do not currently exist in production.

### Decision C9

Use **H-OWNER-TABLE**, not Supabase Vault, for the CRM policy seal HMAC verification key.

Rationale:

- the seal key must not be readable through the ordinary app's Supabase service-role capability;
- Vault deliberately grants `service_role` access to decrypted secrets;
- the seal key is a distinct trust domain from Storage/admin API access;
- a private database schema with explicit ACLs gives a narrower capability boundary.

Vault remains appropriate for unrelated application secrets; it is simply not the chosen trust boundary for this seal.

## Trust domains

### Ordinary application

Current application access continues through the existing Prisma `DATABASE_URL` path.

The ordinary application must have:

- no direct ability to update a bundle to VALIDATED;
- no `USAGE` on `crm_internal`;
- no `SELECT` on HMAC verification keys;
- no `EXECUTE` on the seal function;
- no secret used to emit CRM policy attestations.

The repository's `SUPABASE_SERVICE_ROLE_KEY` must not confer any CRM seal capability.

### SealService

SealService is a server-only component with two independent capabilities:

1. a dedicated PostgreSQL identity/capability for the seal call;
2. the active HMAC signing key in a server-only secret variable.

Compromise of only one capability must not be sufficient for ordinary product code to seal a candidate.

### Database owner / migration

The migration/database owner remains an administrative trust root. It can always alter database objects and is outside the ordinary-product threat boundary.

## Database roles

### `nexora_sealer`

Dedicated PostgreSQL role for SealService.

Normative properties:

- LOGIN may be provisioned operationally, but **no password is embedded in migrations or repository files**;
- NOSUPERUSER;
- NOCREATEDB;
- NOCREATEROLE;
- NOBYPASSRLS;
- NOINHERIT;
- no direct DML grants on CRM policy tables;
- no SELECT on key material;
- no CREATE/ALTER/DROP capability;
- eventual capability is only:
  - `USAGE` on the private function schema as required;
  - `EXECUTE` on the exact seal function.

**Initial implementation remains fail-closed:** do not grant operational EXECUTE until the authority gate is separately approved.

### `nexora_app`

Future least-privilege application DB role. It is not required to be introduced by 1B.

If/when introduced, it must not inherit `nexora_sealer`.

## Private schema and key store

Create a non-exposed schema:

`crm_internal`

Minimum ACL boundary:

- revoke all schema privileges from PUBLIC;
- no USAGE for `anon`, `authenticated`, `authenticator`, `service_role`, `nexora_app`, or `nexora_sealer` except the minimal future function-call path specifically granted;
- never add `crm_internal` to an exposed Data API schema list.

Table:

`crm_internal.seal_hmac_key`

Columns:

- `key_id text primary key`
- `secret bytea not null`
- `status text not null check (status in ('active','verify_only','revoked'))`
- `created_at timestamptz not null default now()`
- `retired_at timestamptz null`

Constraints:

- key material must be at least 32 bytes;
- at most one `active` row;
- migration creates **no key rows**;
- key provisioning/rotation is a separate privileged operation.

The table is readable only by the function owner/database owner. The `nexora_sealer` caller does not receive SELECT.

## Signing secret in SealService

Server-only variables, names frozen for implementation:

- `CRM_READ_POLICY_SEAL_HMAC_ACTIVE_KEY_ID`
- `CRM_READ_POLICY_SEAL_HMAC_SECRETS_JSON`

The second value is a map `keyId -> base64 secret`.

Rules:

- never `NEXT_PUBLIC_*`;
- never put the HMAC material in `DATABASE_URL`;
- never log the secret;
- never log full MAC values;
- fail closed if active key ID is absent, secret is absent, malformed, or shorter than 32 bytes.

## Attestation v1

Logical fields:

- `v = 1`
- `keyId`
- `organizationId`
- `bundleId`
- `version`
- `canonicalVersion`
- `contentChecksum`
- `contentRevision`
- `predecessorVersion` or null
- `predecessorChecksum` or null
- `issuedAtEpochMs`
- `nonce`

Nonce:

- at least 128 bits from a cryptographic RNG;
- encoded base64url without padding.

Timestamp window in DB:

- not older than 60 seconds;
- not more than 5 seconds in the future.

## Canonical HMAC bytes

Do **not** HMAC generic JSON serialization and do not rely on JSON object key order or PostgreSQL `jsonb::text`.

Freeze a versioned, length-prefixed UTF-8 framing shared by TypeScript and PostgreSQL.

Conceptual form:

```text
crm-read-policy-seal-attestation/v1\n
v=<len>:1\n
keyId=<len>:...\n
organizationId=<len>:...\n
bundleId=<len>:...\n
version=<len>:...\n
canonicalVersion=<len>:...\n
contentChecksum=<len>:...\n
contentRevision=<len>:...\n
predecessorVersion=<len>:...\n
predecessorChecksum=<len>:...\n
issuedAtEpochMs=<len>:...\n
nonce=<len>:...\n
```

For nullable fields, encode null as `-1:`.

Lengths are UTF-8 byte lengths, not JavaScript character counts.

Integers use base-10 ASCII with no leading zeros except `0`.

Implementation must include fixed known-answer vectors proving TypeScript and PostgreSQL produce identical bytes and identical HMAC-SHA256 output.

## HMAC

Algorithm:

- HMAC-SHA256;
- key material >= 32 random bytes;
- PostgreSQL verify via `extensions.hmac(message_bytea, secret, 'sha256')`.

Do not claim ordinary `bytea = bytea` comparison is constant-time.

Provide a fixed-length comparator for the 32-byte MAC that:

- rejects non-32-byte values;
- iterates over all 32 bytes;
- accumulates XOR differences;
- returns equality only after the full loop.

## Seal function

Private function:

`crm_internal.crm_read_policy_seal_bundle(attestation jsonb, mac bytea, audit jsonb)`

Properties:

- `SECURITY DEFINER`;
- fixed/empty `search_path`;
- every relation/function reference schema-qualified;
- owned by the database migration owner;
- no default PUBLIC EXECUTE;
- explicitly revoke EXECUTE from:
  - PUBLIC
  - anon
  - authenticated
  - authenticator
  - service_role
  - nexora_app
  - nexora_sealer
- a future activation migration/gate may grant only to `nexora_sealer`.

The function is in `crm_internal`, not `public`, so it is not intended to be a PostgREST RPC.

## Fixed verification order inside the seal function

1. Validate attestation shape and version.
2. Validate `issuedAtEpochMs` TTL/skew.
3. Load `key_id` where status is `active` or `verify_only`.
4. Rebuild canonical attestation bytes.
5. Compute expected HMAC-SHA256.
6. Compare MAC using fixed-length full-loop comparison.
7. Lock candidate bundle by `organizationId + bundleId` FOR UPDATE.
8. Require:
   - candidate exists;
   - candidate is DRAFT;
   - attestation version/org/id match;
   - `canonicalVersion` matches;
   - `contentRevision` matches;
   - `contentChecksum` matches the checksum asserted by SealService.
9. For version > 1:
   - predecessor belongs to same org;
   - predecessor is VALIDATED;
   - predecessor version/checksum match the attestation.
10. Perform the minimal transition:
   - status -> VALIDATED;
   - contentChecksum -> attested checksum;
   - seal audit columns -> supplied immutable audit values.
11. Do not mutate any child/content row.

The SQL function **does not run the TypeScript Point 8 validators**. Its HMAC verifies that the trusted SealService attested that validation occurred on the locked/revisioned snapshot.

## Bundle audit fields proposed for implementation

Add nullable fields that are null while DRAFT:

- `sealedAt timestamptz`
- `sealKeyId text`
- `sealNonce text`
- `sealAuthorityRef text`

On a successful DRAFT -> VALIDATED transition all become non-null and immutable.

No raw authority credential/token is stored. `sealAuthorityRef` is a non-secret audit reference.

## Existing immutability trigger

4A-1C-1A continues to block ordinary DRAFT -> VALIDATED updates.

1B implementation may narrow that trigger so the database-owner/SECURITY-DEFINER transition can succeed only with a complete seal shape.

No GUC/session flag, bypass variable, or HTTP-provided magic marker is permitted.

Ordinary roles still have no direct table permission to perform the transition.

## SealService transaction

Future implementation sequence:

1. begin SERIALIZABLE transaction on dedicated SealService DB connection;
2. lock candidate bundle;
3. hydrate the full policy snapshot under that transaction;
4. run `validateCrmReadPolicyBundle`;
5. if version > 1, hydrate predecessor/evidence and run `validateCrmReadPolicySuccession`;
6. run authority verifier;
7. require authority = allow;
8. compute checksum from the same in-memory snapshot using the Point 8 canonicalizer;
9. read the locked candidate's `contentRevision`;
10. build attestation v1;
11. HMAC with active SealService key;
12. call `crm_internal.crm_read_policy_seal_bundle` in the same transaction;
13. commit.

Any validator error, authority deny/unknown, missing key, revision mismatch, MAC failure, predecessor mismatch, or concurrent conflict -> rollback.

## Authority — C3

The product remains fail-closed.

For the first implementation cut:

- authority provider returns deny/unsupported by default;
- no HTTP/API path can invoke a seal;
- no scheduler/job can invoke a seal;
- no product EXECUTE grant is installed for `nexora_sealer`;
- absence of a real approved authority integration means zero ordinary production seals.

This closes C3 architecturally without pretending that `current_user`, a checksum, an actor ID, or an HMAC alone proves business authority.

## Rotation

Rotation sequence:

1. provision new random key in the private DB key table as active while previous becomes verify_only;
2. configure new key in SealService server secret store;
3. switch active key ID in SealService;
4. keep previous verify_only for at least attestation TTL + operational margin;
5. later mark previous revoked and remove it from SealService.

Emergency revocation:

- mark DB key revoked;
- remove signing key from SealService;
- do not mutate already VALIDATED bundles.

## 1B implementation decomposition

Do not implement all operational capability in one commit.

### 1B-1 — dormant crypto/database foundation

Allowed:

- private schema;
- empty key table;
- attestation byte builder;
- HMAC verification helpers;
- MAC comparator;
- seal audit columns;
- private seal function;
- no key rows;
- no EXECUTE grant to product/sealer roles;
- no SealService runtime code.

Required tests:

- ACL negatives;
- empty-key fail closed;
- bad/short MAC;
- unknown/revoked key;
- expired/future attestation;
- known-answer vectors;
- contentRevision mismatch;
- predecessor mismatch;
- DRAFT-only;
- validated immutability;
- no public RPC exposure.

### 1B-2 — dormant SealService process code

Only after 1B-1 passes/merges.

Allowed:

- server-only SealService module;
- pure authority interface whose production implementation still denies;
- TypeScript attestation canonicalizer;
- HMAC emission from server env;
- transaction/hydration/validator orchestration;
- no HTTP route;
- no scheduler;
- no production sealer grant;
- no real signing secret provisioned by migration.

### Later activation gate

Separate explicit authorization required for:

- real authority integration;
- production `nexora_sealer` credential;
- HMAC key provisioning;
- EXECUTE grant;
- any product route/job capable of requesting a seal.

## Non-goals

This design does not authorize:

- CRM read-policy activation pointer;
- changing evaluator runtime behavior;
- public/admin HTTP seal endpoint;
- RLS policy expansion;
- using service_role as sealer;
- using Vault as the CRM seal key store;
- pgsodium;
- production migration execution.

## Gate to authorize 1B-1 code

Before implementation:

1. PR #31 must be merged and its new `main` green.
2. Human reviewer accepts H-OWNER-TABLE and dedicated sealer boundary.
3. Human reviewer accepts the versioned length-prefixed attestation encoding.
4. Product remains fail-closed: no operational EXECUTE grant and no key provisioning.

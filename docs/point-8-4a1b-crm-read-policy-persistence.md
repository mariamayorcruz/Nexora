# Punto 8 — Paso 4A-1B: persistencia inactiva del formato de políticas CRM

Almacenamiento Prisma/Postgres para **políticas candidatas** de lectura CRM. No hay APIs operativas, activación, oferta comercial ni puntero de bundle activo en `Organization`.

## Referencia de contrato

PR #23 (paso 4A-1A), HEAD aprobado:

`02c8a573b967d7656c8f5e057003b49ae214d0c5`

Los validadores puros viven en ese PR. Este corte **no los importa, no los modifica y no los duplica**. Si un servicio futuro necesita validar antes de persistir, debe depender explícitamente del módulo `crm-read-policy-format` de 4A-1A.

## Migraciones

| Migración | Rol |
|---|---|
| `20261031200000_add_crm_read_policy_candidate_persistence` | Tablas, FKs, CHECKs, triggers iniciales |
| `20261031210000_crm_read_policy_candidate_persistence_hardening` | Correctiva: quita bypass GUC, bloquea VALIDATED, endurece UPDATE OLD/NEW, RLS + REVOKE |

La migración inicial **no se reescribe**. Se aplicó en Postgres desechable local de validación del PR (`nexora_point8_4a1b` @ `127.0.0.1`). **No** se ha aplicado ni inspeccionado en producción.

## Qué se almacena

| Pieza | Tabla(s) |
|---|---|
| Bundle candidato (empresa, versión, estado DRAFT/VALIDATED, canonicalVersion, checksum) | `CrmReadPolicyBundle` |
| Catálogos de membresías/leads del bundle | `CrmReadPolicyBundleMembershipLink`, `CrmReadPolicyBundleLeadLink` |
| Concesiones (`logicalId` ≠ `versionId`, padre intra-bundle) | `CrmReadPolicyGrant` |
| Restricciones | `CrmReadPolicyRestriction` |
| Clases de campo (sin duplicados) | `*FieldClass` |
| `retiredGrantLogicalIds` | `CrmReadPolicyRetiredGrantLogicalId` |
| Evidencia tipada entre versiones | `CrmReadPolicyChangeEvidence` (+ clases ADDED/REMOVED) |
| Predecesor explícito | `predecessorOrganizationId` + `predecessorVersion` → mismo org |

`contentChecksum` **no** es firma de actor ni prueba de autoridad: solo digiere contenido canónico declarado.

En este corte el almacenamiento operativo admitido es **DRAFT**. El enum conserva `VALIDATED` para el futuro servicio de sellado, pero la base rechaza crear o alcanzar ese estado.

## Integridad en base

- Claves/relaciones compuestas `(organizationId, …)` impiden membership/lead/bundle/evidencia de otra empresa.
- Padre de grant: FK compuesta `(organizationId, bundleId, parentVersionId)` (DEFERRABLE).
- Evidencia: FK `(organizationId, fromVersion|toVersion)` al bundle de la misma empresa; `fromVersion < toVersion`.
- CHECKs: versión ≥ 1; scope COMPANY sin lead / RECORD con lead; ventanas; acción `crm.lead.read`; VALIDATED⇒checksum (si alguna vez existiera una fila); predecesor mismo org; ids no vacíos.
- Uniques: versión por empresa; `logicalId`/`versionId` por bundle; clases y retired ids sin duplicados.

## Efectos en borrados existentes

Nuevos FKs a `Membership` y `CrmLead` usan **ON DELETE RESTRICT** (no CASCADE).

- DELETE físico de `Membership`/`CrmLead` referenciados por políticas candidatas **falla**.
- `Membership.status = REMOVED` sigue disponible.
- DELETE de `Organization` con bundles candidatos falla (RESTRICT).
- DELETE de bundle **DRAFT** hace CASCADE de hijos.

## Estado VALIDATED e inmutabilidad (este corte)

1. **INSERT** de bundle `VALIDATED` → rechazado (trigger).
2. **UPDATE** `DRAFT → VALIDATED` → rechazado (trigger).
3. No existe bypass de producto (`crm_read_policy.allow_validated_snapshot_write` eliminado en la migración correctiva). No hay GUC, booleano ni función de producto que permita saltarse el bloqueo.
4. Si existiera una fila `VALIDATED` (p. ej. fixture privilegiado en pruebas), sus hijos/evidencia son inmutables: INSERT/UPDATE/DELETE rechazados; en UPDATE se inspeccionan **origen (OLD)** y **destino (NEW)** (`organizationId`, `bundleId`, `evidenceRowId`, `fromVersion`, `toVersion`).

Una función pura de 4A-1A **no** impide escrituras SQL directas. El sellado transaccional DRAFT→VALIDATED queda **pendiente** de un servicio futuro (no implementado aquí).

La asignación de versión no usa `max(version)+1` sin control de concurrencia.

## Acceso Data API / clientes (protección explícita del esquema propuesto)

Sobre **solo** las tablas nuevas de este PR:

- `ENABLE ROW LEVEL SECURITY` (sin `FORCE`; el owner interno / rol de migración sigue operando).
- **Ninguna** política permisiva para `anon` / `authenticated`.
- `REVOKE ALL` de `PUBLIC` y, si existen, de `anon`, `authenticated`, `authenticator`.
- Funciones de trigger/helpers: `REVOKE ALL … FROM PUBLIC` (y de roles cliente si existen).

Límites documentados:

| Rol | Acceso esperado a tablas 4A-1B |
|---|---|
| Owner de tabla / rol de `DATABASE_URL` del servidor (interno) | DDL/DML según grants del owner; RLS no FORCE |
| `anon` / `authenticated` / `authenticator` (Supabase Data API) | Sin privilegios; sin políticas RLS |
| `PUBLIC` | Revocado |

Esto **no** afirma exposición en producción: producción no se inspeccionó ni se migró en este corte. Corrige la falta de protección explícita del esquema propuesto. La migración es segura en Postgres desechable sin roles Supabase (REVOKE condicional).

## Tabla de invariantes

| Invariante | DB | Validador 4A-1A (PR #23) | Pendiente (servicio transaccional) |
|---|---|---|---|
| Bundle pertenece a Organization | FK RESTRICT | pertenencia | — |
| Membership/CrmLead same-org | FK compuesta RESTRICT | pertenencia_incoherente | — |
| Padre grant same-bundle/org | FK compuesta | padre_ausente / padre_ajeno | — |
| Evidencia same-org + orden | FK + CHECK | evidencia_ajena / version_no_superior | exactitud de huellas |
| Versión ≥ 1 única por org | CHECK + UNIQUE | version_invalida | reserva concurrente de versión |
| logicalId/versionId únicos | UNIQUE | logical_id/version_id_duplicado | — |
| Scope COMPANY/RECORD | CHECK | scope_no_soportado | — |
| Clases conocidas sin dups | ENUM + PK | clase_* | — |
| Ventana temporal | CHECK | ventana_invalida | — |
| retiredGrantLogicalIds | tabla + PK | historial_* / coleccion_ausente | monotonicidad entre sucesiones |
| Checksum canónico | CHECK si VALIDATED | checksum_* | sellado atómico |
| No reactivar logicalId retirado | — | reactivacion_invalida | — |
| Evidencia exacta por changeKind | kind + JSON | evidencia_inexacta | — |
| No crear/alcanzar VALIDATED aún | triggers (INSERT + UPDATE) | — | servicio de sellado |
| Inmutabilidad si VALIDATED | triggers OLD+NEW | contenido_mutado_tras_validacion | — |
| Clientes Data API sin acceso | RLS + REVOKE | — | revisión de roles en hosting |
| Autoridad / roots / activación | — | pendingExternalChecks | servicio + evaluador |

## Pruebas

```bash
FR004_DATABASE_URL=postgresql://… npm run tenancy:validate-point8-4a1b
```

Solo Postgres desechable. Fixtures VALIDATED usan `DISABLE TRIGGER` privilegiado del entorno de prueba, no un bypass de producto.

## Exclusiones

Sin rutas, UI, autorización operativa nueva, inventarios, oferta, binding legacy, activación, suspensión, adaptador, shadow evaluation, merge, deploy ni producción. PR #22 y PR #23 no se modifican.

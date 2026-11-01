# Punto 8 — Paso 4A-1B: persistencia inactiva del formato de políticas CRM

Almacenamiento Prisma/Postgres para **políticas candidatas** de lectura CRM. No hay APIs operativas, activación, oferta comercial ni puntero de bundle activo en `Organization`.

## Referencia de contrato

PR #23 (paso 4A-1A), HEAD aprobado:

`02c8a573b967d7656c8f5e057003b49ae214d0c5`

Los validadores puros viven en ese PR. Este corte **no los importa, no los modifica y no los duplica**. Si un servicio futuro necesita validar antes de persistir, debe depender explícitamente del módulo `crm-read-policy-format` de 4A-1A.

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

## Integridad en base

- Claves/relaciones compuestas `(organizationId, …)` impiden membership/lead/bundle/evidencia de otra empresa.
- Padre de grant: FK compuesta `(organizationId, bundleId, parentVersionId)` (DEFERRABLE) — no admite padre de otro bundle/empresa.
- Evidencia: FK `(organizationId, fromVersion|toVersion)` al bundle de la misma empresa; `fromVersion < toVersion`.
- CHECKs: versión ≥ 1; scope COMPANY sin lead / RECORD con lead; ventanas `validFrom ≤ validUntil`; acción `crm.lead.read`; VALIDATED exige checksum; predecesor mismo org y versión menor; ids no vacíos.
- Uniques: versión por empresa; `logicalId`/`versionId` por bundle; clases y retired ids sin duplicados.

## Efectos en borrados existentes

Nuevos FKs a `Membership` y `CrmLead` usan **ON DELETE RESTRICT** (no CASCADE).

- Borrar físicamente una `Membership` o un `CrmLead` referenciado por una política candidata **falla**.
- `Membership.status = REMOVED` sigue disponible (retirada lógica).
- Borrar `Organization` con bundles candidatos falla (RESTRICT).
- Borrar un bundle **DRAFT** hace CASCADE de sus hijos. Un bundle **VALIDATED** no se puede borrar (trigger).

No se añaden cascadas que borren políticas al retirar usuarios/membresías.

## Inmutabilidad

1. Trigger en `CrmReadPolicyBundle`: UPDATE/DELETE de filas `VALIDATED` rechazado.
2. UPDATE `DRAFT → VALIDATED` **bloqueado** hasta el servicio transaccional futuro.
3. Hijos de un bundle `VALIDATED`: UPDATE/DELETE rechazados; INSERT solo si la sesión activa el GUC local `crm_read_policy.allow_validated_snapshot_write` (pensado para la escritura inicial del snapshot por el futuro servicio; las pruebas desechables lo ejercitan). Sin ese GUC, no se puede ampliar un VALIDATED.

Una función pura de 4A-1A **no** impide escrituras SQL directas; la protección de este corte es de base (CHECK + triggers).

La asignación de versión no usa `max(version)+1` sin control de concurrencia: este corte no implementa el servicio de creación.

## Migración

- Nombre: `20261031200000_add_crm_read_policy_candidate_persistence`
- Aditiva; no reescribe migraciones anteriores; no usa `db push`.

## Tabla de invariantes

| Invariante | DB | Validador 4A-1A (PR #23) | Pendiente (servicio transaccional) |
|---|---|---|---|
| Bundle pertenece a una Organization | FK RESTRICT | pertenencia | — |
| Membership/CrmLead same-org | FK compuesta RESTRICT | pertenencia_incoherente | — |
| Padre grant same-bundle/org | FK compuesta | padre_ausente / padre_ajeno | profundidad/ciclos completos ya en validador |
| Evidencia same-org + orden de versiones | FK + CHECK | evidencia_ajena / version_no_superior | exactitud de huellas/contratos |
| Versión ≥ 1 única por org | CHECK + UNIQUE | version_invalida | reserva concurrente de versión |
| logicalId/versionId únicos en bundle | UNIQUE | logical_id/version_id_duplicado | — |
| Scope COMPANY/RECORD | CHECK | scope_no_soportado | — |
| Clases conocidas sin duplicados | ENUM + PK | clase_desconocida / clase_duplicada | — |
| Ventana temporal coherente | CHECK | ventana_invalida | — |
| retiredGrantLogicalIds presentes sin dups | tabla + PK | coleccion_ausente / historial_* | monotonicidad entre sucesiones |
| Checksum canónico correcto | solo presencia si VALIDATED | checksum_invalido / ausente | sellado atómico + concurrencia |
| No reactivar logicalId retirado | — | reactivacion_invalida | — |
| Evidencia exacta por changeKind | kind tipado + JSON snapshot | evidencia_inexacta | — |
| Inmutabilidad tras VALIDATED | triggers + GUC | contenido_mutado_tras_validacion (estructura) | transición DRAFT→VALIDATED segura |
| Autoridad de plataforma / roots / activación | — | pendingExternalChecks | servicio + evaluador operativo |

## Pruebas

```bash
FR004_DATABASE_URL=postgresql://… npm run tenancy:validate-point8-4a1b
```

Solo Postgres desechable (`localhost` / `127.0.0.1` / `postgres` / `*.local`).

## Exclusiones

Sin rutas, UI, autorización nueva, inventarios, oferta, binding legacy, activación, suspensión, adaptador, shadow evaluation, merge, deploy ni producción. PR #22 y PR #23 no se modifican.

# Punto 8 / Corte 4A-1C-0c — Concurrencia y aislamiento multiempresa de evidencias

Correcciones **aditivas** de laboratorio sobre PR #27 (candidate-anchor), que a su vez depende de PR #24.

## Cadena de dependencias (no modificar artefactos previos)

| Artefacto | Rol | HEAD (referencia; no modificado) |
|---|---|---|
| PR #23 | Validadores formato/sucesión | `02c8a573b967d7656c8f5e057003b49ae214d0c5` |
| PR #24 | Persistencia candidata + hardening | `b57c233043bbde2c74f71c29a9296ae9bc494ff3` |
| PR #25 Partes IV–V | Diseño sellado ALT-H / conflictos | `29d8e3473ac1f445d14db8bfb36f2b37bad8b320` |
| PR #26 | Laboratorio de seguridad | `d7b4b047fca2146b6b1b5447a0b4e87d4e41b7f8` |
| PR #27 | Candidate-anchor + pruebas 0b | `0b901925f9773873fbc4a3cc3e800dd63bdf8226` |
| **PR #28 (0c)** | Locks de padre + org-freeze + `contentRevision` | `6502451750f426b49acb845e6231db97408bb1f1` |

Base experimental: rama de PR #27. Stack: **#24 → #27 → 0c**.

## Migración experimental

`prisma/migrations/20261109020000_crm_read_policy_evidence_concurrency_isolation/migration.sql`

Justificación / alcance:

1. **`contentRevision` (BIGINT, default 0)** en `CrmReadPolicyBundle` — se incrementa en DML de evidencia / EvidenceFieldClass contra el candidato. Permite detectar deriva de contenido frente a un sellado concurrente. **Solo en esta rama experimental**; no se cablea aún a SealService/HMAC.
2. **`crm_read_policy_lock_bundle_by_version`** — `SELECT … FOR UPDATE` del candidato; falla cerrado si no existe (`ERRCODE` FK).
3. **`crm_read_policy_lock_two_candidates`** — orden determinista `(orgId, version)` cuando un UPDATE traslada `toVersion` / evidencia padre.
4. **Org-freeze** — `organizationId` inmutable en `CrmReadPolicyChangeEvidence` y `CrmReadPolicyChangeEvidenceFieldClass` (bloquea traslados entre orgs aunque las versiones existan en ambas).
5. Preserva candidate-anchor 0b (`toVersion` VALIDATED ⇒ inmutable) y same-org FKs.
6. Sin GUC / session markers / bypass de producto. No reescribe migraciones históricas.

## Suite

```bash
FR004_DATABASE_URL=postgresql://…@127.0.0.1:5432/nexora_point8_4a1c_0c \
  npm run tenancy:validate-point8-4a1c-0c
```

Solo Postgres local desechable. Fixtures `VALIDATED` usan `session_replication_role=replica` privilegiado **de laboratorio**.

### Resultados (corrida local de cierre)

| Id | Resultado | Clase | Notas |
|---|---|---|---|
| E-FIX-1 … E-FIX-12 | PASS | demostrado | Regresión candidate-anchor + same-org |
| CONC-A / OVERLAP / POST | PASS | demostrado | Seal-then-edit: T2 espera `FOR UPDATE`, luego rechazo inmutabilidad |
| CONC-B / OVERLAP / POST | PASS | demostrado | Edit-then-seal: T2 sella tras liberar lock; edición pre-seal persiste |
| ISO-CROSS-ORG | PASS | demostrado | Org-freeze + FK incoherente; sin escrituras parciales |
| ISO-ORG-ALIGN | PASS | demostrado | Rewrite `organizationId` con versiones 1/2 en ambas orgs rechazado |
| OLD-NEW | PASS | demostrado | Retarget DRAFT↔DRAFT OK; involucrar VALIDATED rechazado |
| POST-VAL | PASS | demostrado | Tras VALIDATED: evidence + field-class bloqueados |
| HIST | PASS | demostrado | Predecesor VALIDATED intacto |
| REV | PASS | demostrado | `contentRevision` 0→1 tras INSERT evidencia |
| SENS-LOCK | PASS | sensibilidad | Sin `FOR UPDATE` (+ bump no-op) la edición cae durante seal abierto |
| SENS-ORG-DEF / SENS-ORG | PASS | sensibilidad | Cláusula presente; sin org-freeze el traslado alineado tiene éxito |

## Garantías demostradas

- Serialización seal↔evidencia vía locks de padre en INSERT/UPDATE/DELETE de evidencia y field classes.
- Orden determinista al involucrar OLD/NEW candidatos.
- `organizationId` inmutable en evidencia y field classes (no eludible por FKs alineadas).
- Candidate-anchor 0b y predecesor VALIDATED conservados.
- Controles sensibles: retirar lock/bump u org-freeze reabre las brechas 0b.

## Riesgos residuales (pendientes de producto)

- SealService / HMAC / autoridad de sellado reales **no** implementados (lab usa `replica`).
- `contentRevision` no está consumido por un sellador operativo.
- Autorización de aplicación, rutas, middleware y activación CRM fuera de alcance.
- No cubre isolation a nivel de RLS/policies de producto ni multi-writer fuera de estas tablas.

## Fuera de alcance

SealService, HMAC operativo, autoridad de sellado, activación CRM, rutas/middleware, merge/deploy, modificación de PR #22–#27 / `main`.

## Recomendación

**Cerrar 4A-1C-0c** con este PR en borrador: las dos brechas de 0b (carrera seal↔evidencia y traslado cross-org con versiones alineadas) quedan demostradas como controladas en el laboratorio. El siguiente corte (4A-1C-1) puede consumir locks + `contentRevision` en el diseño de sellado; no arrancar automáticamente aquí.

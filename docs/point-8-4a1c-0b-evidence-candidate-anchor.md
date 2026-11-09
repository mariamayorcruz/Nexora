# Punto 8 / Corte 4A-1C-0b — Candidate-anchor de evidencia

Migración correctiva **aditiva** sobre el hardening de PR #24: la evidencia es inmutable solo cuando el candidato (`toVersion`) está `VALIDATED`.

## Referencias

| Artefacto | HEAD (no modificado) |
|---|---|
| PR #23 | `02c8a573b967d7656c8f5e057003b49ae214d0c5` |
| PR #24 | `b57c233043bbde2c74f71c29a9296ae9bc494ff3` |
| PR #25 Parte V | `29d8e3473ac1f445d14db8bfb36f2b37bad8b320` |
| PR #26 lab | `d7b4b047fca2146b6b1b5447a0b4e87d4e41b7f8` |

## Migración

`prisma/migrations/20261109010000_crm_read_policy_evidence_candidate_anchor/migration.sql`

- `CREATE OR REPLACE` de `crm_read_policy_evidence_touches_validated` → ancla en `toVersion` únicamente.
- `CREATE OR REPLACE` de `crm_read_policy_evidence_row_touches_validated` → join a `e.toVersion`.
- Sin GUC / session markers / triggers de lock nuevos.
- `REVOKE` PUBLIC/clientes sobre helpers.
- No reescribe `20261031200000` ni `…210000`.

## Suite

```bash
FR004_DATABASE_URL=postgresql://…@127.0.0.1:5432/nexora_point8_4a1c_0b \
  npm run tenancy:validate-point8-4a1c-0b
```

Solo Postgres local desechable. Fixtures `VALIDATED` usan `session_replication_role=replica` privilegiado **de laboratorio**, no bypass de producto.

### Resultados (última corrida local)

| Id | Resultado | Notas |
|---|---|---|
| E-FIX-1 … E-FIX-12 | PASS | Regresión candidate-anchor |
| CONC-A | PASS | Dos sesiones: T1 sella (lab) abierto; T2 edita evidencia |
| CONC-A-OVERLAP | PASS (RESIDUAL_RACE) | T2 puede commitear edición mientras el seal lab sigue abierto — sin locks de padre |
| CONC-A-POST | PASS | Tras commit de ambos, UPDATE evidencia rechazado |
| CONC-B | PASS | Orden inverso: T1 edita abierto; T2 sella |
| CONC-B-OVERLAP | PASS (RESIDUAL_RACE) | Misma laguna de serialización |
| CONC-B-POST | PASS | Post-VALIDATED inmutable |
| ISO-CROSS-ORG | PASS | Retargets incoherentes rechazados por FK; sin parciales |
| ISO-ORG-ALIGN | PASS (RESIDUAL) | `organizationId` hacia otra org con mismas versiones es FK-legal; 0b no añade trigger anti-rewrite |
| OLD-NEW | PASS | Retarget DRAFT→DRAFT OK; involucrar VALIDATED rechazado |
| POST-VAL | PASS | Tras VALIDATED: evidence + field-class bloqueados |
| HIST | PASS | Grants de predecesor VALIDATED intactos |

**23 passed / 0 failed** en la corrida de cierre de concurrencia/aislamiento.

## Bloqueos documentados (no corregidos en 0b)

1. **Carrera seal↔evidencia:** candidate-anchor no toma `FOR UPDATE` del candidato en DML de evidencia. Bajo `READ COMMITTED`, una txn puede editar evidencia mientras otra (lab) deja el flip a VALIDATED sin commit. La inmutabilidad **después** del commit sí se cumple. Los locks de padre pertenecen al diseño 4A-1C-1 (PR #25 Parte IV), no a este corte.
2. **Rewrite de `organizationId` con versiones alineadas:** las FKs compuestas no lo impiden. Fuera de alcance de 0b (no se añaden triggers).

## Fuera de alcance

SealService, HMAC operativo, autoridad de sellado, activación CRM, rutas/middleware, merge/deploy.

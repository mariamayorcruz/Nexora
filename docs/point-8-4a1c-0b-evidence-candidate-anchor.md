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
- Sin GUC / session markers.
- `REVOKE` PUBLIC/clientes sobre helpers (patrón hardening).
- No reescribe `20261031200000` ni `…210000`.

## Suite

```bash
FR004_DATABASE_URL=postgresql://…@127.0.0.1:5432/nexora_point8_4a1c_0b \
  npm run tenancy:validate-point8-4a1c-0b
```

Solo Postgres local desechable. Fixtures `VALIDATED` usan `session_replication_role=replica` privilegiado **de laboratorio**, no bypass de producto.

## Fuera de alcance

SealService, HMAC operativo, autoridad de sellado, activación CRM, rutas/middleware, merge/deploy.

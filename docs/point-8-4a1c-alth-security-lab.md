# Punto 8 / 4A-1C — Laboratorio aislado ALT-H (seguridad)

**Estado:** laboratorio documental + suite ejecutable en Postgres **desechable**.  
**No** implementa 4A-1C-1 operativo. **No** modifica PR #22/#23/#24/#25 ni migraciones de producto.

## Referencias

| Artefacto | HEAD verificado al abrir el lab |
|---|---|
| `main` (base) | tip remoto al crear la rama |
| PR #22 | `368fb25c7bf7a4674013c51d28b8a6919fbf7239` |
| PR #23 | `02c8a573b967d7656c8f5e057003b49ae214d0c5` |
| PR #24 | `b57c233043bbde2c74f71c29a9296ae9bc494ff3` |
| PR #25 diseño | `1bab8f5f2d672f02702c41492c23adc829e37cf6` |

## Archivos del laboratorio

| Ruta | Rol |
|---|---|
| `lab/point8-4a1c-alth/sql/01_lab_schema.sql` | Schemas `lab_alth` / `lab_alth_internal`, 10 tablas sintéticas, registro HMAC |
| `lab/point8-4a1c-alth/sql/02_locks_revision_seal.sql` | Locks, `content_revision`, immutability, `seal_bundle` + HMAC |
| `lab/point8-4a1c-alth/sql/03_grants_lab_roles.sql` | Matriz `nexora_lab_app` / `nexora_lab_sealer` |
| `lab/point8-4a1c-alth/README.md` | Cómo montar DB local |
| `lab/point8-4a1c-alth/results/latest.json` | Última corrida |
| `scripts/validate-point8-4a1c-alth-lab.ts` | Runner N/P/C/S |
| `package.json` | script `tenancy:validate-point8-4a1c-alth-lab` |
| este doc | Informe |

## Resultados exactos (última corrida local)

```text
passed: 20
failed: 0
failedIds: []
```

| Id | Resultado | Qué demuestra |
|---|---|---|
| N1 | PASS | App no puede `UPDATE status→VALIDATED` |
| N2 | PASS | App sin `EXECUTE` seal |
| N3 | PASS | MAC ausente / incorrecto rechazado |
| P1 | PASS | HMAC válido sella DRAFT→VALIDATED |
| N4 | PASS | MAC de A no aplica a B |
| N5 | PASS | Atestación obsoleta tras INSERT grant (revision) |
| N6 | PASS | Sealer sin UPDATE crudo de bundle |
| N7 | PASS | App/sealer sin lectura de secreto (`lab_alth_internal`) |
| N8 | PASS | `PUBLIC` sin EXECUTE |
| N9 | PASS | Fail-closed: `REVOKE EXECUTE` bloquea sellado con MAC válido |
| N10 | PASS | Solo checksum/actor/authorityRef no sella |
| N11 | PASS | App no altera la función |
| N12 | PASS | App no drop/disable triggers |
| N13 | PASS | App no se auto-otorga EXECUTE |
| C_INV | PASS | Bumps revision en catálogos/grants/restrictions/FC/evidence/traslado/DELETE; TRUNCATE denegado; aislamiento orgB; insert en VALIDATED rechazado |
| C_EVID | PASS | Mutación de evidencia invalida atestación previa |
| S1 | PASS | Mutante sin verify HMAC sella con MAC basura → control HMAC es necesario; función restaurada |
| S2 | PASS | `GRANT EXECUTE` a app rompe N2 (luego REVOKE) |
| S6 | PASS | App no forja VALIDATED vía GUC marker (sin privilegio de columna `status`) |
| S5 | PASS | TRUNCATE denegado a app |

**Comparación MAC:** igualdad `bytea` únicamente. **No** se afirma resistencia temporal.

## Controles demostrados

- HMAC-SHA256 con `pgcrypto` + tabla de claves en schema privado owner-only.
- Separación app / sealer / owner.
- Fail-closed por ausencia de EXECUTE.
- Locks de padre + `content_revision` en inventario sintético de 10 categorías.
- Sensibilidad: quitar HMAC o ampliar EXECUTE degrada garantías.

## Fallos / hallazgos (no fallos de suite)

1. **Brecha potencial vs PR #24:** el hardening de evidencia que bloquea DML si *cualquier* extremo (`from`/`to`) es VALIDATED impediría escribir evidencia de sucesión con predecesor ya sellado y candidato DRAFT. El lab implementa la **intención 4A-1C** (bloquear solo si el **candidato** `to_version` está VALIDATED). **4A-1C-1 debe reconciliar esto con #24** (ajuste de trigger de evidencia o secuencia de escritura) antes de implementación operativa.
2. El marcador transaccional `lab_alth.seal_mac_ok` es un control de laboratorio acoplado a privilegios de columna; en producto la norma PR #25 prefiere que el UPDATE a VALIDATED ocurra solo dentro del definer tras MAC (sin depender de que un rol ordinario pueda set_config).
3. Frontera residual C4: owner o poseedor de secreto+EXECUTE puede fabricar MAC sin corrida `#23` (fuera de “rol ordinario”).

## Riesgos sin resolver

| Riesgo | Estado |
|---|---|
| Reconciliación evidencia #24 vs predecesor VALIDATED | **Abierto** — bloqueante de diseño para 4A-1C-1 |
| Aceptación H-OWNER-TABLE en producto (C9) | Abierto (lab solo demuestra el patrón) |
| Fail-closed product grants (C3) | Abierto en producto; lab demuestra N9 |
| Suite producto real sobre tablas CrmReadPolicy* | No ejecutada (lab sintético) |
| Constant-time MAC compare | No reclamado / no demostrado |
| Autoridad real de sellado | Sigue fail-closed / fuera de lab |

## Evaluación C1–C10 (tras lab)

| Id | Evaluación lab |
|---|---|
| C1 ALT-H | **Soportada** por evidencia lab |
| C2 señales insuficientes | **Soportada** (N3/N10/S6) |
| C3 fail-closed grants | **Patrón demostrado** (N9); falta política de producto |
| C4 residual HMAC+EXECUTE | **Confirmada** como frontera (S1 mutante / owner) |
| C5 locks/revision 10 tablas | **Patrón demostrado** en sintético (C_INV/C_EVID); falta sobre esquema #24 real |
| C6 decisiones de producto | Intactas; lab no activa CRM |
| C7 suite | Lab N/S/C **pasó**; no sustituye suite sobre migraciones #24 |
| C8 no pgsodium | Cumplido (`pgcrypto` only) |
| C9 almacén secreto | Patrón H-OWNER-TABLE **demostrado** en lab; aceptación producto pendiente |
| C10 no merge sin gate | Vigente |

## Recomendación técnica sobre 4A-1C-1

**No aprobar aún la implementación operativa 4A-1C-1.**

Condiciones mínimas adicionales:

1. Cerrar el **conflicto evidencia #24 vs predecesor VALIDATED** con un cambio de diseño/migración explícito (sin GUC de bypass).  
2. Aceptación humana de C3/C9/C10 sobre el camino de producto.  
3. Portar la suite lab a tablas/migraciones reales en un PR 4A-1C-1 aún sin activación/HTTP.

El laboratorio **sí** respalda ALT-H como dirección: HMAC + roles + revision/locks son realizables en Postgres local con `pgcrypto`.

# Punto 8 — Paso 4A-1C: diseño del sellado transaccional CRM (revisión de seguridad)

**Estado:** diseño documental — **4A-1C-1 bloqueado**. ALT-H candidata aceptada; Parte IV (HMAC/privilegios) cerrada a nivel de diseño; Parte V resuelve el conflicto de evidencia PR #24 vs laboratorio PR #26 — **pendiente aceptación humana** antes de cualquier migración correctiva o 4A-1C-1.  
**Alcance:** solo lectura/diseño. Sin código operativo, sin migraciones aplicadas, sin APIs, sin merge, sin deploy, sin producción.  
**No modifica** PR #22, #23 ni #24 (solo propone migración **aditiva** futura).

### Bloqueo de viabilidad (hallazgo confirmado)

La verificación **Ed25519 dentro de SQL** **no es viable** en el PostgreSQL objetivo (Supabase hosted) vía `pgcrypto`. Ver Parte II §V1 y Parte III. La arquitectura candidata es **ALT-H** (HMAC-SHA256 con `pgcrypto` + separación de roles + fail-closed); detalle normativo del secreto y privilegios en **Parte IV**.

## HEADs de referencia (re-verificados en verificación final)

| Artefacto | HEAD | Draft |
|---|---|---|
| PR #22 evaluador | `368fb25c7bf7a4674013c51d28b8a6919fbf7239` | sí |
| PR #23 validadores | `02c8a573b967d7656c8f5e057003b49ae214d0c5` | sí |
| PR #24 persistencia + hardening | `b57c233043bbde2c74f71c29a9296ae9bc494ff3` | sí |
| PR #25 este diseño | tip de rama `cursor/point8-4a1c-crm-seal-design-0dea` (ver `git rev-parse HEAD` tras push) | sí |

## Decisiones de diseño fijadas en esta revisión

| Decisión | Valor |
|---|---|
| Predecesor para `version > 1` | Debe existir y estar **VALIDATED** |
| Metadatos de sellado vs checksum canónico `#23` | **Separados** — no entran en `crm-read-policy-canonical/v1` |
| Auditoría | **Mínima** en columnas de `CrmReadPolicyBundle`; sin tablas nuevas salvo aprobación explícita |
| Candidatos vacíos | **Permitidos** si pasan validación estructural `#23` |
| Activación operativa | **Fuera de alcance** — sellar ≠ activar ≠ conceder lectura CRM |

---

## 0. Clasificación: implementado / propuesto / pendiente

### Ya implementado (#23 / #24)

- Validadores puros + checksum canónico.
- Persistencia candidata DRAFT y bloqueo total de VALIDATED (INSERT y DRAFT→VALIDATED).
- Inmutabilidad de hijos/evidencia si el bundle origen o destino es VALIDATED (OLD+NEW).
- RLS + REVOKE cliente sobre tablas/funciones nuevas.
- `pendingExternalChecks` incluye autoridad, roots, activación, concurrencia e inmutabilidad DB.

### Propuesto (este documento, revisado)

- Servicio de sellado con **fail-closed** de autoridad.
- **Atestación HMAC-SHA256** (`pgcrypto`) que vincula el resultado `#23` al contenido DB + `contentRevision`.
- **Estabilidad transaccional del contenido** vía bloqueo de padres desde DML hijo + `contentRevision`.
- Ajuste estrecho de trigger de bundle (sin GUC / sin booleanos de sesión).
- Columnas mínimas de auditoría/revisión en el bundle existente.
- Pruebas PostgreSQL reales de elusión e invariantes.

### Pendiente de aprobación / implementación futura

- Autorización real y verificable de sellado (sustituto del fail-closed).
- Implementación 4A-1C-1+ (código/migración).
- Activación, binding, rutas, evaluador operativo (#22).

---

## 1. Bloqueo 1 — Impedir sellado vía SECURITY DEFINER sin validadores #23

### Problema

Una función `crm_read_policy_seal_bundle(...)` invocable con `EXECUTE` puede sellar si solo exige:

- checksum no vacío,
- `actorId`,
- `sealAuthorityRef`,
- o un flag de “listo”.

Ninguno de esos valores prueba que `validateCrmReadPolicyBundle` / `validateCrmReadPolicySuccession` se ejecutaron sobre **ese** contenido.

### Alternativas técnicas

| Id | Enfoque | Cómo bloquea el bypass | Riesgos |
|---|---|---|---|
| **A** | Solo rol DB sealer (credenciales exclusivas del proceso SealService); app sin `EXECUTE`/`UPDATE` a VALIDATED | Quien no es SealService no llega al camino privilegiado | Credencial sealer = confianza total; SQL directo como sealer aún sella sin `#23` |
| **B** | Atestación **firmada** (Ed25519) emitida **solo** tras `ok` de `#23`; la función SQL verifica firma con clave pública | Sin clave privada no hay atestación válida → `EXECUTE` solo no basta | Gestión de claves; no sustituye autoridad fail-closed |
| **C** | Reimplementar reglas `#23` en PL/pgSQL dentro del seal | Validación en el mismo sitio que escribe | Deriva del contrato `#23`; costo; prohibido por acoplamiento |
| **D** | Columna `sealReadyChecksum` escrita por el app tras validar | Fácil de forjar con `UPDATE` DRAFT si el rol app puede escribirla | **Insuficiente** — rechazada como control primario |

### Elección recomendada (actualizada tras viabilidad): **ALT-H + A**, no Ed25519-in-SQL

> **Hallazgo:** Ed25519 dentro de SQL (**B**) queda **descartado** como dependencia de producto en Supabase hosted. Motivos y alternativas en Parte II §V1–§V4.

Control primario vigente:

1. **Atestación HMAC-SHA256** (`pgcrypto.hmac`) sobre el mismo payload de atestación, emitida **solo** tras `#23` ok (ver §V4).
2. Función SQL verifica el MAC con un secreto **no** poseído por el rol SQL ordinario (Vault / secreto solo legible por el owner de la función definer).
3. Separación de roles: el rol que edita DRAFT **no** tiene `EXECUTE` ni puede `UPDATE status→VALIDATED`.
4. `current_user` / ser el definer **no** cuenta como prueba de validación `#23`.
5. Fail-closed de autoridad (§3): sin allow, no se emite MAC.

El payload de atestación permanece:

```text
SealAttestation = {
  v: 1,
  organizationId, bundleId, version,
  canonicalVersion: "crm-read-policy-canonical/v1",
  contentChecksum, contentRevision,
  predecessorVersion, predecessorChecksum,
  issuedAt, nonce
}
mac = HMAC-SHA256(canonical_bytes(SealAttestation), SEAL_ATTESTATION_SECRET)
```

### Por qué checksum / actor / authorityRef / current_user no bastan

| Señal | Por qué falla como prueba de `#23` |
|---|---|
| Checksum no vacío | Inventable; no implica sucesión/evidencia/retired |
| `actorId` / `sealAuthorityRef` | No son validación estructural |
| Columna “ready” escribible | El mismo rol que llama a seal puede ponerla |
| `current_user = sealer` | Solo prueba **quién escribe**, no que `#23` corrió |

### Invariantes verificables (Postgres real)

Ver Parte II §V5 (pruebas negativas y de sensibilidad). Incluyen: MAC ausente/incorrecto, rol app sin EXECUTE, mutación que incrementa `contentRevision`, y elusión por `current_user`.

---

## 2. Bloqueo 2 — Estabilidad transaccional real del contenido

### Problema

`SELECT … FROM CrmReadPolicyBundle FOR UPDATE` **no** bloquea:

- `INSERT` de grants/restrictions/retired ids/field classes/links,
- `UPDATE`/`DELETE` de hijos existentes,
- `UPDATE` que **traslade** `bundleId` (u org) entre bundles,
- evidencia `CrmReadPolicyChangeEvidence` (+ field classes) ligada por versiones.

Un sellador puede validar un snapshot en memoria mientras otra transacción altera filas; un seal posterior fijaría VALIDATED sobre contenido distinto al validado, o correría condiciones de carrera con la atestación.

### Alternativas técnicas

| Id | Enfoque | Cobertura | Riesgos |
|---|---|---|---|
| **L1** | Triggers BEFORE en **todas** las tablas hijas/evidencia: tomar `FOR UPDATE` (o `FOR NO KEY UPDATE`) del/los bundle padre(s) en orden determinista antes de permitir DML | Mientras el seal sostiene el lock del padre, el DML hijo **espera**; al commit VALIDATED, immutability `#24` rechaza | Hay que cubrir **todas** las tablas; olvidar una abre hueco |
| **L2** | Contador monotónico `contentRevision` en el bundle; cada DML de contenido hace `UPDATE bundle SET contentRevision = contentRevision + 1` bajo el mismo lock de padre | Detecta cualquier cambio entre atestación y seal aunque hubiera un hueco de lock | Requiere que el incremento sea inevitable en el mismo camino que el DML |
| **L3** | `SERIALIZABLE` en la txn de seal | Abortos por SSI ante lecturas/escrituras concurrentes | No sustituye locks de padre para INSERT predicado; complementar |
| **L4** | `LOCK TABLE` SHARE ROW EXCLUSIVE en todas las tablas candidatas | Serializa todo el tenant-schema | Demasiado grueso; rechazo como primario |
| **L5** | Columna `sealingInProgress` / GUC de sesión | — | **Rechazado** (excepción general / sesión) |

### Elección recomendada: **L1 + L2 + L3 (seal txn)**

#### 2.1 Bloqueo de padres desde DML hijo (L1)

Nueva rutina SQL (diseño; no implementada aquí), invocada al inicio de los triggers de hijo/evidencia (ampliación del camino `#24`, sin GUC):

```text
crm_read_policy_lock_bundle_parents(...)
```

Reglas:

1. **Hijos con `bundleId`** (grants, restrictions, links, retired, field classes de grant/restriction):  
   - `DELETE`/`UPDATE` OLD: lock `(organizationId, bundleId)` OLD.  
   - `INSERT`/`UPDATE` NEW: lock `(organizationId, bundleId)` NEW.  
   - Si OLD y NEW difieren (traslado): lock ambos en orden `(organizationId ASC, bundleId ASC)` para evitar deadlock.

2. **Evidencia por versiones** (`CrmReadPolicyChangeEvidence`):  
   - Resolver bundles de `fromVersion` y `toVersion` (y OLD/NEW si cambian).  
   - Lock todos los bundles afectados en orden `(organizationId, version)`.

3. **Field classes de evidencia:** lock vía fila de evidencia → mismos bundles.

4. Tras adquirir locks, conservar comprobaciones de immutability VALIDATED de `#24` (OLD+NEW).

Efecto con el seal:

```text
Seal txn:  BEGIN;  SELECT bundle FOR UPDATE;  … valida …;  seal;  COMMIT
Editor:    INSERT grant → trigger intenta FOR UPDATE del mismo bundle → ESPERA
Post-commit VALIDATED → editor desbloquea y recibe error de immutability
```

#### 2.2 `contentRevision` (L2)

Columna aditiva en `CrmReadPolicyBundle` (no es metadato de actor; es control de concurrencia de contenido):

- `contentRevision bigint not null default 0`
- Cada DML que afecte el contenido canónico del bundle (hijos listados + evidencia cuya `toVersion` o `fromVersion` apunte a este bundle cuando el cambio forma parte del snapshot de sucesión persistido) incrementa la revisión **en la misma transacción**, después del lock de padre.
- Updates de **solo** metadatos de sellado / auditoría **no** incrementan `contentRevision`.
- Updates DRAFT de campos del bundle que entren en el canónico `#23` (si los hubiera mutables: p. ej. `canonicalVersion` malicioso) **sí** deben incrementar; el diseño de persistencia actual concentra el canónico en hijos + identidad org/version — cualquier columna futura canónica queda sujeta a la misma regla.

La atestación firma `contentRevision`. El seal SQL exige igualdad. Si hubo cambio, la atestación queda inválida aunque alguien reutilice el checksum textual.

#### 2.3 Aislamiento de la txn de seal (L3)

SealService abre la transacción en **`SERIALIZABLE`** (o, si se demuestra insuficiente en pruebas, se documenta fallo y se refuerza L1/L2 — no se relaja L1/L2).

Orden de operaciones del seal (único camino feliz):

1. `BEGIN ISOLATION LEVEL SERIALIZABLE`
2. `SELECT bundle FOR UPDATE` (org + id)
3. Lock/lectura ordenada de todos los hijos y evidencia de sucesión necesaria
4. Hidratar → validadores `#23` → checksum
5. Verificar predecesor VALIDATED si `version > 1`
6. Autoridad (§3) — fail-closed hoy
7. Firmar atestación con `contentRevision` leído **después** de los locks
8. `crm_read_policy_seal_bundle(attestation, signature, audit)`
9. Relación: función re-verifica revision + firma + predecesor
10. `COMMIT` (o rollback total ante cualquier fallo)

### Invariantes verificables (Postgres real)

1. Txn A: `FOR UPDATE` bundle + sleep; Txn B: `INSERT` grant mismo bundle → B bloqueada hasta A commit/abort (medir `pg_locks` / timeout).  
2. Igual para `UPDATE`/`DELETE` grant, restriction, retired id, membership/lead link, field class.  
3. Traslado `UPDATE grant SET bundleId = otherDraft` mientras other o source está locked por seal → espera o fallo limpio; nunca silent seal sobre contenido mudado.  
4. Evidencia INSERT `fromVersion=1,toVersion=2` mientras seal de v2 sostiene lock → espera.  
5. Seal firma revision=N; concurrente incrementa a N+1 y commit antes del seal → seal aborta por mismatch de revision (o SSI).  
6. Tras VALIDATED, cualquier DML hijo/evidencia sigue rechazado (#24).

---

## 3. Bloqueo 3 — Autoridad de sellado fail-closed

### Problema

Mientras no exista autorización **real y verificable**, ninguna identidad ordinaria debe poder sellar. Un diseño que “deja pendingExternalChecks pero igual sella” es fail-open.

### Alternativas

| Id | Enfoque | Fail-closed | Riesgos |
|---|---|---|---|
| **F1** | Puerto `SealAuthorityVerifier` con **única** impl productiva inicial `FailClosedSealAuthority` → siempre `denied` | Sí en TS | Debe impedirse atajos de env (`ALLOW_SEAL=1`) sin aprobación |
| **F2** | No emitir nunca atestaciones si denied; función SQL exige firma → sin allow no hay seal | Sí en la práctica | Misma confianza en clave privada |
| **F3** | No `GRANT EXECUTE` hasta existir autoridad real | Sí a nivel DB | Pruebas necesitan rol/harness explícito |
| **F4** | Allowlist hardcodeada de user ids | No aceptable (patrón prohibido / frágil) | — |

### Elección recomendada: **F1 + F2 + F3**

Contrato:

```text
SealAuthorityDecision =
  | { allowed: false, code: 'seal_authority_unimplemented' | 'seal_authority_denied', detail: string }
  | { allowed: true, authorityKind: <solo kinds aprobados en el futuro>, authorityId: string }
```

Invariantes de producto **hasta** aprobación de un kind real:

1. `FailClosedSealAuthority.verify(...)` **siempre** `{ allowed: false, code: 'seal_authority_unimplemented' }`.  
2. SealService **no** hidrata-para-firmar / **no** llama a la función SQL si `allowed !== true`.  
3. No existe kind `authorityKind` emitible en producción en 4A-1C.  
4. No hay bypass por `actorId` “admin”, membership OWNER, ni variable de entorno de conveniencia.  
5. Pruebas de elusión: identidad ordinaria (y “admin” simulado) → `seal_authority_unimplemented`; estado DRAFT intacto.  
6. Pruebas del mecanismo criptográfico/SQL usan **harness de laboratorio** (clave de test + rol sealer de test) documentado como **no** camino productivo; el camino productivo permanece deny-all.

Cuando en el futuro exista autoridad real: nuevo corte revisable que añade un verifier verificable, un `authorityKind` versionado, y solo entonces puede `allowed: true` emitir atestaciones. Ese corte **no** forma parte de la aprobación actual.

### Invariantes verificables

1. Llamada al servicio de sellado con cualquier `actorId` → denied; cero filas VALIDATED nuevas.  
2. Intento de pasar `sealAuthorityRef` / membership OWNER → sigue denied.  
3. Función SQL sin atestación firmada → denied (cubre invocación directa).  
4. Documentación/CI del harness de test no se configura en el rol de producción (checklist de release; fuera de auto-merge).

---

## 4. Ajustes a #24 (triggers / columnas) — sin GUC

### 4.1 Trigger de bundle (estrecho)

Permitir UPDATE DRAFT→VALIDATED **solo** cuando:

1. Lo ejecuta el camino de `crm_read_policy_seal_bundle` (definer + firma válida ya comprobada en la función; el UPDATE ocurre **dentro** de esa función), y  
2. Columnas mutadas ⊆ `{ status, contentChecksum, updatedAt, sealedAt, sealedByActorId, sealAuthorityKind, sealAuthorityId, sealAttestationNonce }` ∪ (si aplica) ningún otro, y  
3. `NEW.contentChecksum` NOT NULL e igual al de la atestación verificada, y  
4. `OLD.status = DRAFT`, `NEW.status = VALIDATED`.

Sigue prohibido: INSERT VALIDATED; mutar filas ya VALIDATED; DELETE VALIDATED.

Detección sin GUC: el UPDATE privilegiado ocurre solo dentro de la función `SECURITY DEFINER` del rol sealer; el trigger puede exigir `current_user = sealer_owner` **y** que exista verificación previa en la misma función (un solo sitio de UPDATE). El rol app **no** puede UPDATE esos campos a VALIDATED directamente.

### 4.2 Columnas mínimas en `CrmReadPolicyBundle` (sin tabla nueva)

| Columna | Rol | ¿Canónico `#23`? |
|---|---|---|
| `contentRevision` | Concurrencia de contenido | No |
| `sealedAt` | Auditoría mínima | No |
| `sealedByActorId` | Auditoría mínima (quién solicitó; no prueba de allow) | No |
| `sealAuthorityKind` / `sealAuthorityId` | Auditoría; en fail-closed no se escriben en prod | No |
| `sealAttestationNonce` | Anti-reuso / auditoría | No |

`contentChecksum` en VALIDATED sigue siendo el digest canónico `#23` (contenido de política), no firma de actor.

### 4.3 Hijos / evidencia

- Mantener immutability OLD+NEW de `#24`.  
- Añadir locks de padre (§2.1) + bump `contentRevision` (§2.2).  
- Sin bypass de sesión.

---

## 5. Flujo transaccional revisado (resumen)

```text
BEGIN SERIALIZABLE
  lock bundle FOR UPDATE
  [fail-closed authority — stop si denied]
  lock/read children + evidence (orden estable)
  hydrate → validateCrmReadPolicyBundle
  if version > 1:
     load predecessor FOR SHARE/UPDATE
     require predecessor.status = VALIDATED
     validateCrmReadPolicySuccession
  checksum = computeCrmReadPolicyBundleChecksum
  read contentRevision
  sign SealAttestation
  crm_read_policy_seal_bundle(attestation, sig, audit)
    verify sig + TTL + revision + predecessor
    UPDATE status/checksum/audit only
COMMIT
```

Idempotencia: si ya `VALIDATED` y checksum+version coinciden con la petición → `already_sealed` sin reescribir contenido. Si VALIDATED con contenido distinto → `conflict_immutable`.

---

## 6. Matriz de pruebas PostgreSQL reales (obligatorias antes de aprobar 4A-1C-1)

### Elusión de validadores (#23)

| # | Caso | Esperado |
|---|---|---|
| E1 | Seal SQL con checksum libre, sin MAC | rechazo |
| E2 | MAC con secreto incorrecto | rechazo |
| E3 | Atestación de otro bundleId/version | rechazo |
| E4 | Atestación con revision antigua tras mutar grant | rechazo |
| E5 | Sucesión sin predecesor VALIDATED | rechazo en servicio (y SQL double-check) |

### Estabilidad / concurrencia

| # | Caso | Esperado |
|---|---|---|
| C1 | INSERT grant concurrente durante seal | bloqueo → luego immutability o seal primero limpio |
| C2 | DELETE restriction concurrente | igual |
| C3 | UPDATE retiredGrantLogicalIds / INSERT retired | igual |
| C4 | Traslado grant entre dos DRAFT | locks ordenados; sin seal sucio |
| C5 | Evidencia INSERT concurrente on succession | espera / fail limpio |
| C6 | Dos seals paralelos mismo DRAFT | uno sella; otro idempotente o espera |

### Autoridad fail-closed

| # | Caso | Esperado |
|---|---|---|
| A1 | Cualquier actor ordinario vía servicio | `seal_authority_unimplemented`; DRAFT intacto |
| A2 | OWNER membership / admin string | igual denied |
| A3 | Sin GRANT EXECUTE a roles cliente | permission denied |

### Regresión #24

| # | Caso | Esperado |
|---|---|---|
| R1 | INSERT VALIDATED directo | rechazado |
| R2 | UPDATE hijo post-seal | rechazado OLD/NEW |
| R3 | No existe GUC `allow_validated_snapshot_write` | confirmed |

Harness de laboratorio para E/C (MAC de test) **separado** de A1–A3 (camino productivo deny-all). Matriz ampliada en Parte II §V5.

---

## 7. Riesgos residuales

| Riesgo | Mitigación |
|---|---|
| Compromiso del secreto HMAC / credencial sealer | Rotación; F3; secreto fuera del rol app; fail-closed no emite MAC |
| Ed25519-in-SQL no disponible en Supabase/`pgcrypto` | Descartado; ALT-H (Parte II) |
| Olvidar tabla hija en lock/revision | Inventario §V3 + test de sensibilidad |
| `TRUNCATE` / `session_replication_role` / owner DISABLE TRIGGER | REVOKE TRUNCATE; roles no-owner; tests §V5 |
| Deriva SQL vs checksum `#23` | SQL no recalcula FNV; revision + MAC tras hydrate TS |
| Confundir `sealedByActorId` / `current_user` con allow o `#23` | Fail-closed + MAC obligatorio |
| Auto-deploy Vercel al merge | Gate humano; este doc no autoriza merge |

---

## 8. Cortes de implementación (solo tras nueva aprobación)

| Corte | Contenido | ¿Código operativo? |
|---|---|---|
| **4A-1C-0** | Este diseño (doc) + viabilidad | No |
| **4A-1C-1** | Migración: `contentRevision`, auditoría mínima, locks/bump en **todas** las tablas §V3, función seal + **HMAC pgcrypto**, REVOKE/GRANT; suite Postgres §V5 | Sí — **requiere aprobación explícita** |
| **4A-1C-2** | SealService TS: fail-closed, hydrate, `#23`, MAC, seal; sin HTTP | Sí — tras 4A-1C-1 |
| **4A-1C-3** | Concurrencia/aislamiento org + sensibilidad | Sí |
| **Futuro** | Verifier de autoridad real | Otro PR; sustituye fail-closed |

---

## 9. Resumen ejecutivo para revisores

1. **Ed25519-in-SQL no es viable** en el Postgres Supabase objetivo con `pgcrypto`; no implementar 4A-1C-1 sobre esa premisa.  
2. **Sin `#23` no hay seal:** MAC HMAC (`pgcrypto`) emitido solo tras validadores + roles separados; checksum/actor/ref/`current_user` no bastan.  
3. **Contenido estable:** locks de padre en **todas** las tablas de contenido/evidencia + bump `contentRevision` (incl. UPDATE del propio bundle canónico) + `SERIALIZABLE`.  
4. **Fail-closed:** ninguna identidad ordinaria sella hasta autoridad verificable.

**No implementar 4A-1C-1 hasta nueva aprobación explícita tras esta verificación de viabilidad.**

---

# Parte II — Verificación de viabilidad (PR #25)

Análisis técnico-documental. Sin acceso a producción. Referencias: documentación pública PostgreSQL/`pgcrypto`, lista de extensiones privilegiadas de la imagen `supabase/postgres`, docs Supabase Vault/pgsodium, esquema/migraciones PR #24 HEAD `b57c233`.

## V1. ¿Supabase/Postgres admite verificación Ed25519 desde SQL?

### Hallazgos

| Capacidad | ¿Disponible en objetivo Supabase hosted? | Notas |
|---|---|---|
| `pgcrypto` | **Sí** (extensión privilegiada habitual) | `digest`, `hmac`, PGP (`pgp_*`), `crypt`/`gen_salt`. **No** expone Ed25519 ni `ed25519_verify` / `crypto_sign_*` |
| Extensión comunitaria `ed25519` / `pg_ed25519` | **No** en `supautils.privileged_extensions` de la imagen curated | Requiere `.so` nativo; hosted no permite instalar extensiones C arbitrarias |
| `pgsodium.crypto_sign_verify_detached` | Extensión **listada**, API Ed25519 (libsodium) | Supabase documenta **pgsodium en deprecación**; **no recomendado** como dependencia de producto nueva. Vault **no** sustituye verify de firmas de aplicación |
| `supabase_vault` | **Sí** (secretos cifrados) | Almacén de secretos; **no** es verificador Ed25519 |
| `plv8` verificar en JS | Extensión posible en imagen | Fuera de contrato; superficie y mantenimiento inaceptables para este control |
| Duplicar verify en PL/pgSQL puro | N/A | Inseguro / no estándar |

### Conclusión V1

**No asumir** que `pgcrypto` verifica Ed25519: **no lo hace**.  
**Bloqueo:** diseñar el sellado como “la función SQL verifica Ed25519” **no es viable** en el entorno objetivo sin depender de `pgsodium` deprecado o de extensiones no alojadas.

**Alternativa criptográfica viable en SQL:** `pgcrypto.hmac(..., 'sha256')` (ver §V4).

### Permisos típicos (diseño)

- `CREATE EXTENSION pgcrypto WITH SCHEMA extensions;` (o schema ya usado por el proyecto) — rol privilegiado de migración.  
- `GRANT EXECUTE` solo de la función seal (no de helpers de secreto) al rol sealer.  
- Secreto HMAC: **no** `GRANT` de lectura del secreto al rol que solo edita DRAFT.

---

## V2. SECURITY DEFINER, rol sealer y elusión de `#23`

### Problema reforzado

`current_user = nexora_crm_policy_sealer` (o `session_user <> current_user` por SECURITY DEFINER) **solo** demuestra el rol de escritura. Un operador con `psql` y esa credencial, o cualquier código que obtenga `EXECUTE`, puede llamar `crm_read_policy_seal_bundle` **sin** pasar por TypeScript/`#23`.

### Modelo de privilegios propuesto (fail-closed)

| Rol | DRAFT DML hijos | UPDATE bundle (campos draft) | `EXECUTE` seal | Lectura secreto HMAC | Comentario |
|---|---|---|---|---|---|
| `anon` / `authenticated` / Data API | No (REVOKE #24) | No | No | No | Intactos |
| `nexora_app` (API/runtime general) | Sí (DRAFT) | Sí salvo transición VALIDATED | **No** | **No** | No puede sellar |
| `nexora_sealer` (solo SealService) | Mínimo necesario para lock/read | No genérico; solo vía función | **Sí** (cuando autoridad exista) | **No** directo | Credencial distinta de `DATABASE_URL` general |
| Owner de función / migración | DDL | — | define función | lee secreto en definer | Break-glass |

### Cómo impedir transición directa DRAFT→VALIDATED eludiendo `#23`

Controles **conjuntos** (ninguno basta solo):

1. **Trigger de bundle:** rechaza todo UPDATE a VALIDATED que no sea el UPDATE mínimo ejecutado **dentro** de `crm_read_policy_seal_bundle` tras verificar MAC. Un `UPDATE … SET status='VALIDATED'` crudo del sealer **falla** si no pasa por la función (p. ej. la función es el único sitio con permiso de columna `status`, o el trigger exige un token de un solo uso materializado solo tras MAC ok en la misma función — **sin GUC de sesión**).  
2. **MAC obligatorio** dentro de la función: sin MAC válido → no UPDATE. Poseer el rol sealer **sin** el secreto HMAC ⇒ no sella.  
3. **Secreto HMAC** solo en: (a) entorno SealService, (b) lectura por el owner dentro del cuerpo SECURITY DEFINER (Vault u objeto sin `GRANT` al sealer login). El login sealer **no** puede `SELECT` el secreto.  
4. **Fail-closed:** en producto, hasta autoridad real, **no** se hace `GRANT EXECUTE` al sealer de aplicación y SealService **no** carga el secreto de emisión (o verifier always-deny implica no emisión).  
5. **Column privileges:** `REVOKE UPDATE (status) ON CrmReadPolicyBundle FROM nexora_app, nexora_sealer` si el UPDATE lo hace solo el owner vía definer — el sealer solo `EXECUTE` la función.

### Qué queda como frontera de confianza (explícito)

Quien posea **a la vez** `EXECUTE` + secreto HMAC (o sea el owner) puede fabricar un MAC sin correr `#23`. Eso se mitiga por:

- Fail-closed (no grant / no secreto en prod hasta autoridad),
- proceso SealService como único emisor (invariante de código + tests),
- rotación y auditoría `sealedAt` / nonce.

`current_user` **nunca** se documenta como prueba de `#23`.

---

## V3. Locks + `contentRevision` frente al inventario PR #24

### Tablas de contenido / evidencia (#24)

| # | Tabla | ¿En checksum canónico `#23`? | ¿Afecta sucesión `#23`? | Lock padre(s) requerido | ¿Bump `contentRevision`? |
|---|---|---|---|---|---|
| 1 | `CrmReadPolicyBundle` | Parcial: `organizationId`, `version` (no status/audit/checksum metadata) | Predecesor usado en sucesión | Self `FOR UPDATE` | **Sí** si cambian columnas canónicas o predecesor; **No** si solo audit/seal/status vía seal |
| 2 | `CrmReadPolicyBundleMembershipLink` | Sí (`membershipIds`) | Catálogo | bundle `(org, bundleId)` | Sí (bundle) |
| 3 | `CrmReadPolicyBundleLeadLink` | Sí (`leadIds`) | Catálogo | bundle | Sí |
| 4 | `CrmReadPolicyRetiredGrantLogicalId` | Sí | Monotonicidad | bundle | Sí |
| 5 | `CrmReadPolicyGrant` | Sí | Sí | OLD/NEW bundles (traslados) | Sí |
| 6 | `CrmReadPolicyGrantFieldClass` | Sí (clases del grant) | Sí | bundle del grant | Sí |
| 7 | `CrmReadPolicyRestriction` | Sí | Sí | OLD/NEW bundles | Sí |
| 8 | `CrmReadPolicyRestrictionFieldClass` | Sí | Sí | bundle | Sí |
| 9 | `CrmReadPolicyChangeEvidence` | **No** (fuera del digest) | **Sí** (obligatoria en sucesión) | bundles de `fromVersion` **y** `toVersion` (OLD+NEW) | **Sí en el candidato `toVersion`** (y en from/to afectados si cambian) |
| 10 | `CrmReadPolicyChangeEvidenceFieldClass` | No | Sí (huellas de clases) | vía evidence → from/to bundles | Sí en candidato `toVersion` |

Orden de lock: `(organizationId ASC, bundleId ASC)` o, para evidencia por versión, resolver ids de bundle y ordenar `(organizationId, version)` para evitar deadlocks.

### Huecos si solo se hace `FOR UPDATE` del padre en el seal (sin triggers hijo)

Cualquier DML concurrente en filas 2–10 **no espera** al lock del padre. Especialmente:

- `INSERT` nuevo grant/restriction/retired/link/field class / evidence,
- `UPDATE` que cambia `bundleId` / `organizationId` / `grantVersionId` / versiones de evidencia,
- `DELETE`.

### Huecos adicionales identificados (deben cubrirse en diseño)

| Hueco | Riesgo | Control requerido |
|---|---|---|
| **H1** UPDATE directo de `CrmReadPolicyBundle.canonicalVersion` / `version` / `organizationId` / `predecessor*` en DRAFT | Cambia identidad canónica o sucesión sin tocar hijos | BEFORE UPDATE en bundle: lock self; bump `contentRevision` si columnas canónicas/predecesor cambian |
| **H2** DML de **evidencia** (tablas 9–10) | Cambia sucesión validada; **no** está en checksum | Lock from+to; bump revision del **candidato** (`toVersion`) siempre |
| **H3** Traslado multi-bundle de grant/restriction/field class | Contenido “desaparece”/aparece entre bundles | Lock OLD+NEW ordenado; bump **ambos** |
| **H4** `TRUNCATE` de tablas hijas | Vacía contenido **sin** row triggers | `REVOKE TRUNCATE` (y preferir tests que fallen si el rol de prueba puede truncar) |
| **H5** `SET session_replication_role = replica` | Desactiva triggers | Rol app/sealer sin privilegio; solo harness de test documentado (#24) |
| **H6** Owner `ALTER TABLE … DISABLE TRIGGER` | Bypass total | App/sealer ≠ table owner |
| **H7** DELETE CASCADE al borrar DRAFT bundle | Elimina hijos | Seal sostiene lock del bundle; borrado espera o falla |
| **H8** Mutaciones en `Membership`/`CrmLead` referenciados | No cambian filas de política ni checksum de IDs | Fuera del digest; DELETE físico ya RESTRICT en #24 |
| **H9** Evidencia `toVersion=N` mutada mientras se sella N, sin bump | Atestación con revision vieja aún “válida” si solo se bumpeaba por grants | **Obligatorio** bump en 9–10 |
| **H10** Solo bumpear NEW y no OLD en traslado | Bundle origen cambia sin invalidar atestación allí | Bump OLD y NEW |

### Relación con L1+L2+L3

La recomendación §2 se **confirma**, con enmiendas: inventario completo 1–10, H1–H10, y tests de sensibilidad que fallen si falta un trigger en cualquier tabla del inventario.

---

## V4. Arquitectura alternativa recomendada (sin Ed25519-in-SQL)

Conserva: fail-closed de autoridad, separación validación / autoridad / escritura, estabilidad L1+L2+L3, metadatos fuera del canónico, predecesor VALIDATED, sin activación.

```text
┌─────────────────────────────────────────┐
│ SealService (único emisor de MAC)       │
│  authority fail-closed → deny (hoy)     │
│  SERIALIZABLE + lock bundle             │
│  hydrate → validate #23 (+ succession)  │
│  mac = HMAC-SHA256(attestation, secret) │
│  CALL crm_read_policy_seal_bundle(...)  │
└──────────────────┬──────────────────────┘
                   │ EXECUTE (rol sealer)
                   ▼
┌─────────────────────────────────────────┐
│ SQL SECURITY DEFINER (owner)            │
│  1. leer secreto (Vault/objeto sin      │
│     GRANT al login sealer)              │
│  2. verificar hmac(attestation, secret) │
│  3. chequear revision + pred VALIDATED  │
│  4. UPDATE mínimo DRAFT→VALIDATED       │
│  Trigger: rechaza UPDATE VALIDATED crudo│
└─────────────────────────────────────────┘

nexora_app: DRAFT only — sin EXECUTE, sin UPDATE(status)
```

### Comparación de alternativas post-viabilidad

| Id | Enfoque | Viable en Supabase | Eluye `#23` con solo SQL EXECUTE? | Notas |
|---|---|---|---|---|
| **B (Ed25519 SQL)** | verify en SQL | **No** (sin pgsodium/ext externa) | No si hubiera verify | **Descartada** |
| **ALT-H (HMAC pgcrypto)** | `hmac` + secreto | **Sí** | No sin secreto | **Recomendada** |
| **ALT-R (solo roles)** | sealer credential = trust | Sí | **Sí** (psql como sealer) | Insuficiente sola; complemento de ALT-H |
| **ALT-P (pgsodium sign)** | `crypto_sign_verify_detached` | Técnicamente posible hoy | No sin sk | **No recomendada** (deprecación) |
| **ALT-0 (nada crypto)** | trigger + current_user | Sí | **Sí** | **Rechazada** |

### Separación de preocupaciones

| Preocupación | Dónde vive |
|---|---|
| Validez estructural/sucesión | Solo `#23` en SealService (TS) |
| Autoridad para sellar | Fail-closed verifier (hoy deny) |
| Escritura VALIDATED | Función SQL tras MAC + revision |
| Prueba de que un emisor autorizado atestiguó ese digest/revision | MAC HMAC |

---

## V5. Pruebas negativas y de sensibilidad (Postgres desechable)

Entorno: Postgres local desechable (mismo espíritu que `tenancy:validate-point8-4a1b`). **Sin** datos de producción. Harness puede usar privilegios de owner solo para montar roles/secretos de prueba.

### Negativas — elusión de validación / privilegios

| ID | Procedimiento | Esperado |
|---|---|---|
| N1 | Rol app: `UPDATE` bundle `status=VALIDATED` | rechazo trigger / privilegio columna |
| N2 | Rol app: `SELECT crm_read_policy_seal_bundle(...)` | `permission denied` |
| N3 | Rol sealer: seal con attestation sin MAC / MAC basura | rechazo |
| N4 | Rol sealer: MAC válido de bundle A aplicado a B | rechazo |
| N5 | Rol sealer: MAC con `contentRevision` obsoleto tras INSERT grant | rechazo |
| N6 | Rol sealer: `UPDATE` crudo `DRAFT→VALIDATED` sin función | rechazo |
| N7 | Login sealer: `SELECT` secreto HMAC / vault | `permission denied` |
| N8 | `anon`/`authenticated`: cualquier DML/EXECUTE seal | denied (regresión #24) |
| N9 | Camino servicio con authority fail-closed | no emite MAC; cero VALIDATED nuevos |
| N10 | Argumentos solo checksum + actorId + authorityRef | rechazo (falta MAC) |

### Sensibilidad — demostrar que el control es el que creemos

| ID | Procedimiento | Esperado |
|---|---|---|
| S1 | Quitar verificación HMAC del cuerpo de la función (mutante de test) | N3 **pasa** indebidamente → prueba falla (el control real es el MAC) |
| S2 | `GRANT EXECUTE` al rol app | N2 deja de cumplirse → sensibilidad de privilegios |
| S3 | Omitir bump `contentRevision` en trigger de evidence | sellar tras mutar evidencia con MAC viejo **tiene éxito** → prueba de hueco H2/H9 falla el diseño |
| S4 | Omitir lock de padre en INSERT grant | concurrent insert no bloquea (medir) → sensibilidad L1 |
| S5 | Permitir `TRUNCATE` al rol app | vaciado sin bump → sensibilidad H4 |
| S6 | Confiar solo en `current_user` (mutante sin MAC) | N3/N6 fallan abiertos → demuestra insuficiencia de `current_user` |

### Concurrencia / inventario (desechable)

Para **cada** tabla 2–10: INSERT, UPDATE (incl. traslado de claves de padre si aplica), DELETE concurrente con seal en curso → espera o abort limpio; post-sellado immutability.  
Más: UPDATE bundle `predecessorVersion` / `canonicalVersion` durante seal → bump + invalidate MAC.

---

## V6. Bloqueos pendientes de aprobación (antes de 4A-1C-1)

Actualizado: ver matriz **C1–C10** en §III.5 y controles cerrados en **Parte IV**.

Pendiente **bloqueante** tras cierre de diseño:

1. Aceptación humana de **H-OWNER-TABLE** (o H-VAULT) — C9.  
2. Confirmación de fail-closed sin GRANT EXECUTE de producto en 4A-1C-1 — C3.  
3. Ejecución futura de suite N/S/C en el PR de implementación — C7 (no en este doc).  
4. Gate de merge/deploy — C10.

**4A-1C-1 sigue bloqueado.**

---

# Parte III — Veredicto final de viabilidad y seguridad

Fecha de verificación documental: re-chequeo contra HEADs anteriores, docs públicas PostgreSQL `pgcrypto`, lista `supautils.privileged_extensions` de la imagen Supabase, y docs Supabase Vault/pgsodium. Sin acceso a producción ni mutación de esquemas.

## III.1 Hallazgos técnicos (resumen ejecutivo)

| # | Tema | Veredicto |
|---|---|---|
| 1 | Ed25519 desde SQL | **No viable** con `pgcrypto` (sin API Ed25519). `pg_ed25519` no whitelisted. `pgsodium.crypto_sign_verify_detached` existiría pero **deprecado / no recomendado**. Vault ≠ verify de firmas. |
| 2 | Prueba suficiente de `#23` / autoridad | **Rechazadas** como únicas: `current_user`, checksum no vacío, `actorId`, `sealAuthorityRef`. |
| 3 | Camino SQL directo DRAFT→VALIDATED | Impedible solo con **controles conjuntos**: MAC HMAC + sin `UPDATE(status)` crudo + sin `EXECUTE` para app + fail-closed (sin grant/emisión) + secret no legible por login sealer. |
| 4 | Locks solo en padre del seal | **Insuficiente.** INSERT/UPDATE/DELETE/traslados en tablas 2–10 y evidencia requieren lock de padre(s) + bump `contentRevision` (H1–H10). |
| 5 | Arquitectura | **ALT-H** recomendada; Ed25519-in-SQL descartada; roles solos (ALT-R) insuficientes; `current_user`-only rechazado. |

## III.2 Alternativas evaluadas

| Id | Descripción | Decisión |
|---|---|---|
| B | Ed25519 verify en SQL | **Descartada** (no viable en objetivo sin pgsodium) |
| ALT-P | `pgsodium` sign verify | **No recomendada** (deprecación Supabase) |
| ALT-0 | Trigger + `current_user` | **Rechazada** (no prueba `#23`) |
| ALT-R | Solo credencial sealer | **Insuficiente sola** (psql elude `#23`) |
| ALT-H | HMAC-SHA256 (`pgcrypto.hmac`) + roles + fail-closed | **Recomendada** |

## III.3 Arquitectura recomendada (normativa para un futuro 4A-1C-1)

1. **Validación:** solo `validateCrmReadPolicyBundle` / `validateCrmReadPolicySuccession` + checksum `#23` en SealService (TS).  
2. **Autoridad:** `FailClosedSealAuthority` → deny hasta verifier real aprobado; sin allow no hay emisión de MAC.  
3. **Atestación:** HMAC-SHA256 sobre payload que incluye org/bundle/version/checksum/`contentRevision`/predecesor/nonce/`issuedAt`.  
4. **Escritura:** `crm_read_policy_seal_bundle` SECURITY DEFINER verifica MAC (secreto solo-owner/Vault), revision, predecesor VALIDATED si `version>1`, luego UPDATE mínimo.  
5. **Privilegios:** `nexora_app` sin EXECUTE seal y sin UPDATE de `status` a VALIDATED; Data API sigue REVOKE/#24; sealer distinto de `DATABASE_URL` general.  
6. **Concurrencia:** `SERIALIZABLE` + `FOR UPDATE` bundle + triggers en tablas 1–10 (locks ordenados + bump revision; evidencia bumpea candidato).  
7. **Inmutabilidad / aislamiento:** invariantes `#24` (OLD+NEW, FKs same-org, RLS/REVOKE) se conservan; sellar ≠ activar.  
8. **Sin GUC / booleanos de sesión** como bypass de inmutabilidad.

## III.4 Riesgos pendientes (aceptación explícita requerida)

| Riesgo | Severidad | Tratamiento propuesto |
|---|---|---|
| Poseedor de secreto HMAC + `EXECUTE` puede fabricar MAC sin correr `#23` | Alta residual | Fail-closed hasta autoridad; un solo emisor SealService; rotación; auditoría; tests N/S |
| Elección Vault vs secreto solo-owner en hosting real | Media | Decisión de ops antes de migrar (sin inspeccionar prod aquí) |
| Olvidar trigger en alguna tabla del inventario | Alta | Test de inventario + sensibilidad S3/S4 |
| `TRUNCATE` / replication role / DISABLE TRIGGER | Alta | REVOKE; roles ≠ owner; tests S5/H4–H6 |
| Confundir sellado con activación CRM | Alta producto | Fuera de alcance; pending `activation_not_in_scope` |
| Auto-deploy Vercel al merge a `main` | Alta proceso | Gate humano; este doc no autoriza merge |

## III.5 Condiciones C1–C10 — matriz actualizada (cierre de decisiones)

Leyenda de estado:

- **Resuelta (arquitectura):** decisión de diseño cerrada en este documento; no bloquea por ambigüedad.
- **Riesgo aceptado:** residual consciente; no se “elimina”, se mitiga.
- **Solo pruebas reales:** la garantía no se da por redactada; exige suite Postgres desechable en 4A-1C-1.
- **Bloqueante:** debe haber aceptación humana explícita **antes** de autorizar código 4A-1C-1.

| Id | Condición | Estado | Notas |
|---|---|---|---|
| **C1** | Descarte Ed25519-in-SQL; ALT-H candidata | **Resuelta (arquitectura)** | Aceptada en revisión de cierre; detalle HMAC = Parte IV §IV.1 |
| **C2** | `current_user` / checksum / `actorId` / `sealAuthorityRef` no prueban `#23` ni auth | **Resuelta (arquitectura)** | Controles conjuntos §IV.2 |
| **C3** | Fail-closed: sin autoridad → sin emisión MAC / sin EXECUTE útil / cero sellados ordinarios | **Riesgo aceptado** + **Bloqueante** hasta confirmación humana de que el corte 4A-1C-1 **no** otorgará EXECUTE de producto | Mitigación normativa §IV.1.5 |
| **C4** | Frontera residual: HMAC secreto + EXECUTE ⇒ forja de MAC sin `#23` | **Riesgo aceptado** | Mitigado por C3, emisor único SealService, rotación §IV.1.6; no eliminable sin crypto en-proceso distinto |
| **C5** | Inventario locks/revision tablas 1–10 + H1–H10 | **Resuelta (arquitectura)** + **Solo pruebas reales** | Especificación §IV.3; cumplimiento demostrable solo con N/S/C en desechable |
| **C6** | Predecesor VALIDATED; metadatos fuera de canónico; vacíos OK; sin activación | **Resuelta (arquitectura)** | Decisiones fijadas al inicio del doc |
| **C7** | Suite N1–N10, S1–S6, concurrencia por tabla | **Solo pruebas reales** + **Bloqueante** para merge de 4A-1C-1 | Definida; **no ejecutada** en este PR de diseño |
| **C8** | No usar `pgsodium` | **Resuelta (arquitectura)** | Confirmado |
| **C9** | Alojamiento concreto del secreto HMAC | **Resuelta (arquitectura candidata)** + **Bloqueante** | Norma §IV.1 (**H-OWNER-TABLE**); aceptar excepción de tabla mínima de claves o rechazar y elegir H-VAULT |
| **C10** | No modificar #22/#23/#24; no merge a `main` sin gate deploy | **Bloqueante** (proceso) | Vigente |

**4A-1C-1 permanece bloqueado** mientras C3 (grant fail-closed), C7 (pruebas aún no corridas en implementación), C9 (aceptación del almacén de secreto) y C10 (gate de merge) no estén cerrados por revisor humano. C1/C2/C5-diseño/C6/C8 ya no son ambigüedad arquitectónica.

## III.6 Entrega de esta verificación

| Campo | Valor |
|---|---|
| Documento | `docs/point-8-4a1c-crm-read-policy-seal-design.md` |
| PR | https://github.com/mariamayorcruz/Nexora/pull/25 |
| Código operativo | Ninguno |
| Migraciones / APIs / merge / deploy / prod | No |
| Próximo paso | Revisar Parte IV; **4A-1C-1 sigue bloqueado** |

---

# Parte IV — Cierre de controles de seguridad (ALT-H)

Precisión normativa pedida por revisión. Sin implementación. **4A-1C-1 permanece bloqueado.**

## IV.1 Arquitectura concreta del secreto HMAC

### IV.1.1 Identidad del secreto

| Campo | Valor normativo |
|---|---|
| Algoritmo | HMAC-SHA256 vía `pgcrypto` (`hmac(bytea, bytea, 'sha256')`) |
| `keyId` | Estable en atestación, p. ej. `crm-seal-hmac/v1`, `crm-seal-hmac/v2`, … |
| Material | ≥ 32 bytes aleatorios criptográficos |
| Canónico del mensaje MAC | Bytes UTF-8 del JSON canónico de `SealAttestation` (mismo orden de campos que firme SealService; **sin** el MAC) |
| Comparación | Igualdad en tiempo constante en SQL (`hmac(...) = mac` sobre `bytea` completos; rechazar longitudes distintas antes) |

Payload de atestación (emisión y verify):

```text
SealAttestation = {
  v: 1,
  keyId,
  organizationId, bundleId, version,
  canonicalVersion: "crm-read-policy-canonical/v1",
  contentChecksum, contentRevision,
  predecessorVersion, predecessorChecksum,  // nulls si version=1
  issuedAt, nonce
}
mac = HMAC-SHA256(canonical_bytes(SealAttestation), secret[keyId])
```

### IV.1.2 Almacenamiento y emisión en SealService

| Aspecto | Norma |
|---|---|
| Dónde vive el material para **firmar** | Secret manager / env del **proceso SealService únicamente** (p. ej. `CRM_READ_POLICY_SEAL_HMAC_SECRETS_JSON` mapa `keyId → secret`). **Nunca** en el repo, ni en `NEXT_PUBLIC_*`, ni en el `DATABASE_URL` general de la app. |
| Quién emite MAC | **Solo** SealService, y solo después de: (1) autoridad fail-closed = allow (hoy: **nunca** en producto), (2) hydrate bajo locks, (3) `#23` ok (+ sucesión si aplica), (4) lectura de `contentRevision`. |
| Quién no emite | Rutas HTTP CRM, jobs genéricos, scripts de migración, consolas de operador ordinario, rol `nexora_app`. |
| Fail-closed de emisión | Si el verifier de autoridad deniega **o** no hay secreto cargado **o** `keyId` activo ausente → no se calcula MAC → no se llama a la función SQL. |
| Auditoría de emisión | Log estructurado interno: `organizationId`, `bundleId`, `version`, `keyId`, `contentRevision`, `nonce`, resultado autoridad — **sin** material del secreto ni MAC completo si la política de logs lo restringe (al menos no el secreto). |

### IV.1.3 Verificación dentro de PostgreSQL

Función única (nombre de diseño): `crm_read_policy_seal_bundle(attestation jsonb, mac bytea, audit jsonb)`.

Orden fijo del cuerpo (SECURITY DEFINER, `search_path` fijo p. ej. `pg_catalog, public, extensions`):

1. Parsear `attestation`; exigir `keyId`, campos de identidad, `contentChecksum`, `contentRevision`, `issuedAt`, `nonce`.  
2. Rechazar si TTL excedido (p. ej. `issuedAt` no en `[now()-60s, now()+5s]`).  
3. **Cargar material** de verify para `keyId` desde el almacén SQL (§IV.1.4) con `status IN ('active','verify_only')`; si no hay fila → rechazo.  
4. `expected := extensions.hmac(canonical_bytes(attestation), secret_material, 'sha256')`; si `mac` distinto → rechazo.  
5. `SELECT … FROM "CrmReadPolicyBundle" WHERE org+id FOR UPDATE`; exigir `DRAFT`, version/org coincidentes, `contentRevision` igual al de la atestación.  
6. Si `version > 1`: predecesor same-org, **VALIDATED**, checksum de predecesor coincide.  
7. UPDATE mínimo: `status=VALIDATED`, `contentChecksum`, columnas de auditoría de sellado; **no** mutar hijos.  
8. Registrar `keyId` + `nonce` en columnas de auditoría del bundle (anti-reuso observable).

La función **no** ejecuta validadores `#23`. El MAC solo prueba que un poseedor del secreto atestiguó ese digest/revision; el emisor productivo está obligado por §IV.1.2 a calcularlo solo tras `#23`.

### IV.1.4 Acceso del propietario de la función SQL (almacén de verify)

**Elección candidata normativa: H-OWNER-TABLE** (excepción mínima de tabla, no de contenido de política).

| Objeto | Diseño |
|---|---|
| Schema | `crm_internal` (sin USAGE para `PUBLIC` / `anon` / `authenticated` / `nexora_app` / `nexora_sealer`) |
| Tabla | `crm_internal.seal_hmac_key` |
| Columnas | `key_id text PRIMARY KEY`, `secret bytea NOT NULL`, `status text CHECK (status IN ('active','verify_only','revoked'))`, `created_at`, `retired_at` |
| Owner | Mismo rol dueño de `crm_read_policy_seal_bundle` (rol de migración / table owner de políticas candidatas) |
| Privilegios | `REVOKE ALL ON SCHEMA crm_internal FROM PUBLIC`; `REVOKE ALL ON TABLE … FROM PUBLIC`; **sin** GRANT a `nexora_app` ni `nexora_sealer`. Solo el owner (vía definer) lee `secret`. |
| Filas | Exactamente un `status='active'` a la vez (CHECK parcial / unique index). Varias `verify_only` durante ventana de rotación. |

**Alternativa H-VAULT** (si se rechaza cualquier tabla nueva): secreto en `vault.secrets` con nombre estable por `keyId`; la función definer lee `vault.decrypted_secrets`; **obligatorio** demostrar con pruebas que `nexora_app` / `nexora_sealer` / clientes **no** pueden `SELECT` el material. Misma semántica `active|verify_only|revoked` vía metadata.

**Prohibido:** embeber el secreto en `prosrc` de la función; GUC; columna en `CrmReadPolicyBundle`; secreto en filas de política candidata.

### IV.1.5 Privilegios: rol sealer vs rol general de aplicación

| Capacidad | `nexora_app` | `nexora_sealer` | Owner / migración |
|---|---|---|---|
| DML DRAFT en tablas 2–10 | Sí (mientras DRAFT) | Solo lectura necesaria para seal, o ninguno si SealService usa app+EXECUTE separado — **norma:** sealer **sin** DML de contenido | Según DDL |
| `UPDATE "CrmReadPolicyBundle"(status)` a VALIDATED | **No** (`REVOKE UPDATE (status)` + trigger) | **No** directo; solo efecto vía `EXECUTE` de la función | Vía definer |
| `EXECUTE crm_read_policy_seal_bundle` | **No** | **Sí solo cuando** autoridad real exista y se levante fail-closed; en 4A-1C-1 producto: **No grant** (fail-closed) | Define |
| `SELECT` secreto HMAC / schema `crm_internal` | **No** | **No** | Sí |
| `CREATE/ALTER/DROP TRIGGER` en tablas #24 | **No** | **No** | Sí |
| `GRANT`/`REVOKE` sobre tablas/función seal | **No** | **No** | Sí |
| `TRUNCATE` tablas #24 | **No** | **No** | Evitar; no usar en app |
| Data API `anon`/`authenticated` | Sin privilegios (#24) | N/A | N/A |

Credenciales: `DATABASE_URL` de la app API = `nexora_app` (o rol equivalente). SealService, cuando exista autoridad, usa conexión con `EXECUTE` sealer **distinta**. Hasta entonces SealService **no** dispone de grant ni de secreto de emisión en producto.

### IV.1.6 Rotación y revocación

| Operación | Pasos |
|---|---|
| **Rotar** | 1) Generar `keyId` nuevo + material. 2) Insertar fila SQL `active`; pasar anterior a `verify_only`. 3) Cargar el nuevo mapa en SealService; dejar el anterior en SealService solo si aún hay atestaciones in-flight (TTL ≤ 60s). 4) Tras TTL + margen, anterior puede quedarse `verify_only` o pasar a `revoked`. |
| **Revocar de emergencia** | 1) `status='revoked'` (o delete material) en SQL para ese `keyId`. 2) Quitar secreto del env de SealService. 3) Cualquier MAC con ese `keyId` falla verify. 4) No “unseal” bundles ya VALIDATED. |
| **Revocar EXECUTE** | `REVOKE EXECUTE ON FUNCTION crm_read_policy_seal_bundle FROM nexora_sealer` — camino de escritura cerrado sin tocar filas VALIDATED. |
| **Fail-closed de producto** | Estado inicial post-migración 4A-1C-1: función creada, **sin** GRANT a sealer de producto, **sin** secreto de emisión en SealService productivo, verifier always-deny. |

---

## IV.2 Ningún rol ordinario: demostración de controles (diseño)

“Rol ordinario” = `nexora_app`, `anon`, `authenticated`, `authenticator`, o cualquier login sin ownership de tablas #24.

| Ataque | Por qué falla (diseño) | Prueba real que lo demostrará |
|---|---|---|
| `UPDATE` directo DRAFT→VALIDATED | `REVOKE UPDATE (status)` + trigger de bundle que solo permite el UPDATE mínimo **dentro** de la función tras MAC ok | N1, N6 |
| `EXECUTE` seal sin ser sealer autorizado | Sin GRANT; fail-closed inicial sin GRANT a producto | N2, N8, N9 |
| Llamar seal con checksum/actorId/authorityRef sin MAC | Función exige MAC verificado | N3, N10 |
| Fabricar MAC sin secreto | Sin `SELECT` de `crm_internal.seal_hmac_key` / vault | N3, N7 |
| Leer secreto y fabricar autorización “válida” (MAC) | Schema/table sin USAGE/SELECT para ordinarios y sealer login | N7; S2 si se otorga SELECT por error |
| `ALTER FUNCTION` / cambiar cuerpo seal | No owner | Privilegio denied (añadir N11 en suite) |
| `DROP/DISABLE TRIGGER` immutability o lock/revision | No owner; no `session_replication_role` | N12 / H5–H6; S5 |
| `GRANT EXECUTE` a sí mismo | No es grantor | N13 |
| `TRUNCATE` para vaciar contenido sin bump | `REVOKE TRUNCATE` | S5 / H4 |
| Usar `current_user` como atajo en mutante | Norma: trigger/función no tratan current_user como prueba de `#23` | S6 |

**Límite explícito (riesgo C4 aceptado):** quien sea **owner** o posea **a la vez** material HMAC + `EXECUTE` puede producir un MAC sin correr `#23`. Mitigación: no es “rol ordinario”; fail-closed evita que producto tenga ambos; SealService es el único emisor previsto.

---

## IV.3 Estabilidad del contenido — las diez tablas

Regla general en toda txn de escritura de contenido:

1. BEFORE INSERT/UPDATE/DELETE: adquirir `FOR UPDATE` de padre(s) en orden determinista.  
2. Aplicar immutability `#24` si algún padre tocado es VALIDATED.  
3. Si el DML altera contenido canónico o evidencia de sucesión del candidato: `contentRevision = contentRevision + 1` en el/los bundles afectados.  
4. Seal: `SERIALIZABLE` + `FOR UPDATE` del candidato durante hydrate→MAC→seal; atestación lleva `contentRevision`; mismatch ⇒ rechazo.

### Por tabla

| # | Tabla | Concurrent INSERT | UPDATE in-place | Traslado (cambio de padre/versión) | DELETE | TRUNCATE |
|---|---|---|---|---|---|---|
| 1 | `CrmReadPolicyBundle` | N/A (identidad nueva) | Lock self; bump si cambian `canonicalVersion` / `version` / `organizationId` / `predecessor*`; **no** bump en solo audit/seal | N/A | Lock self; VALIDATED bloqueado por trigger | REVOKE; no path app |
| 2 | `…MembershipLink` | Lock bundle; bump | Lock; bump | Lock OLD+NEW bundles ordenados; bump ambos | Lock; bump | REVOKE |
| 3 | `…LeadLink` | Igual | Igual | Igual | Igual | REVOKE |
| 4 | `…RetiredGrantLogicalId` | Igual | Igual (PK) | Lock OLD+NEW; bump ambos | Lock; bump | REVOKE |
| 5 | `…Grant` | Lock bundle; bump | Lock; bump | Lock OLD+NEW `(org,bundleId)`; bump ambos | Lock; bump | REVOKE |
| 6 | `…GrantFieldClass` | Lock bundle del grant; bump | Lock; bump | Lock OLD+NEW si cambia grant/bundle; bump ambos | Lock; bump | REVOKE |
| 7 | `…Restriction` | Como grant | Como grant | Como grant | Como grant | REVOKE |
| 8 | `…RestrictionFieldClass` | Como grant FC | Como grant FC | Como grant FC | Como grant FC | REVOKE |
| 9 | `…ChangeEvidence` | Lock bundles `fromVersion` **y** `toVersion`; bump **candidato `toVersion`** (y from si aplica) | Lock OLD from/to + NEW from/to (ordenados); bump candidatos afectados | Cambio de from/to = traslado de vínculo de sucesión: lock todos; bump | Lock from/to; bump candidato | REVOKE |
| 10 | `…ChangeEvidenceFieldClass` | Resolver evidence → lock from/to; bump `toVersion` | Igual OLD/NEW evidence | Si `evidenceRowId` cambia: lock ambos evidence→bundles; bump | Lock; bump | REVOKE |

### Escenarios transversales

| Escenario | Garantía de diseño |
|---|---|
| Editor INSERT grant mientras seal sostiene candidato | Trigger del INSERT espera `FOR UPDATE` del bundle; tras COMMIT VALIDATED → immutability rechaza; si seal aborta → INSERT procede y sube revision |
| Evidencia mutada tras hydrate y antes del seal | Bump `contentRevision` del candidato; MAC con revision vieja falla en SQL |
| Traslado grant DRAFT_A → DRAFT_B durante seal de A | Lock ordenado evita deadlock; A y B suben revision; atestación de A invalidada |
| Dos seals del mismo DRAFT | Serialización por lock de fila; segundo ve VALIDATED → idempotente o conflicto |
| `TRUNCATE` por rol ordinario | Permission denied (no silent empty) |
| Aislamiento entre empresas | FKs composed `#24` + locks por `(organizationId, …)`; seal de org A no toma filas de org B |

Estas garantías de IV.3 son **Solo pruebas reales** (C5/C7): el diseño fija el comportamiento; 4A-1C-1 deberá demostrarlas en Postgres desechable.

---

## IV.4 Estado de bloqueo tras este cierre

| Ítem | Estado |
|---|---|
| ALT-H como candidata | Aceptada en revisión |
| Secreto HMAC concreto (H-OWNER-TABLE) | Especificado; **aceptación C9 aún bloqueante** |
| Privilegios ordinarios / no forja | Especificado; demostración = pruebas N/S |
| Estabilidad 10 tablas | Especificada; demostración = pruebas C |
| Conflicto evidencia #24 vs sucesión | Resuelto en **diseño** en Parte V; requiere migración correctiva aditiva + pruebas |
| Implementar 4A-1C-1 | **BLOQUEADO** hasta aceptación Parte V + C3/C9/C10 + suite |

---

# Parte V — Conflicto de evidencia PR #24 vs sucesión 4A-1C (cierre de diseño)

**Referencias:** PR #24 HEAD `b57c233043bbde2c74f71c29a9296ae9bc494ff3`; PR #25 este diseño; PR #26 laboratorio ALT-H HEAD `d7b4b047fca2146b6b1b5447a0b4e87d4e41b7f8`.  
**Alcance de esta parte:** solo documental. No edita migraciones `#24`, no implementa 4A-1C-1, no toca el lab `#26`.

## V.1 Inspección de la regla actual (#24 hardening)

Migración correctiva `20261031210000_crm_read_policy_candidate_persistence_hardening`:

```sql
-- Helper actual (simplificado)
crm_read_policy_evidence_touches_validated(org, fromVersion, toVersion)
  := EXISTS (
       SELECT 1 FROM "CrmReadPolicyBundle" b
       WHERE b."organizationId" = org
         AND b."version" IN (fromVersion, toVersion)   -- ← CUALQUIER extremo
         AND b."status" = 'VALIDATED'
     );

crm_read_policy_evidence_row_touches_validated(org, evidenceRowId)
  := EXISTS (evidence e JOIN bundle b
             ON b.version IN (e.fromVersion, e.toVersion) AND b.status = VALIDATED);
```

En `crm_read_policy_child_immutability()` para `CrmReadPolicyChangeEvidence` / `…FieldClass`:

| Op | Comprobación |
|---|---|
| DELETE | OLD toca VALIDATED (either endpoint) → rechazo |
| UPDATE | OLD toca VALIDATED → rechazo; luego NEW toca VALIDATED → rechazo |
| INSERT | NEW toca VALIDATED → rechazo |

Misma lógica vía `evidence_row_touches_validated` para `CrmReadPolicyChangeEvidenceFieldClass` (resuelve la fila de evidencia y aplica either-endpoint).

**Sin GUC** en el hardening actual (correcto); el problema no es bypass sino **anclaje excesivo**.

## V.2 Por qué bloquea la sucesión VALIDATED → DRAFT

Secuencia exigida por 4A-1C (decisiones fijadas + ALT-H):

1. Sellar `version = N` → `VALIDATED` (inmutable).  
2. Crear candidato `version = N+1` en `DRAFT` con `predecessorVersion = N`.  
3. Persistir filas de `CrmReadPolicyChangeEvidence` con `fromVersion = N`, `toVersion = N+1` (+ field classes) **antes** del sellado de `N+1`.  
4. SealService corre `validateCrmReadPolicySuccession` sobre esa evidencia y sella `N+1`.

Con la regla either-endpoint, el paso 3 ejecuta:

`touches_validated(org, N, N+1) = true` porque el bundle `N` ya es `VALIDATED`.

Por tanto **todo INSERT/UPDATE/DELETE de evidencia (y de EvidenceFieldClass) queda prohibido** en cuanto existe un predecesor sellado, aunque el candidato siga en `DRAFT`. Eso hace imposible preparar la sucesión que el propio diseño 4A-1C exige. El laboratorio PR #26 reprodujo el conflicto y adoptó temporalmente la ancla en el candidato; Parte V fija la norma de producto.

La evidencia **no** forma parte del checksum canónico `#23` del predecesor; congelar el contenido del predecesor no requiere congelar filas de sucesión futuras que solo lo referencian como `fromVersion`.

## V.3 Regla exacta recomendada — ancla en el candidato (`toVersion`)

### Definición

Sea el **candidato de una fila de evidencia** el bundle `(organizationId, toVersion)`.

**Una fila de evidencia (y sus field classes) es inmutable si y solo si su candidato está `VALIDATED`.**

El estado `VALIDATED` del bundle `fromVersion` (predecesor) **no** por sí solo congela la evidencia de una sucesión hacia un candidato aún `DRAFT`.

### Helpers normativos (reemplazo semántico)

```text
crm_read_policy_evidence_candidate_is_validated(org, toVersion)
  := EXISTS bundle WHERE organizationId=org AND version=toVersion AND status=VALIDATED

crm_read_policy_evidence_row_candidate_is_validated(org, evidenceRowId)
  := candidate_is_validated(org, evidence.toVersion)  -- via join a la fila
```

Los nombres antiguos `*_touches_validated` deben dejar de usarse con semántica either-endpoint (evitar trampas). Preferible `CREATE OR REPLACE` de las funciones existentes **cambiando el cuerpo** a solo `toVersion`, **o** funciones nuevas + triggers actualizados que dejen de llamar a la semántica vieja. En cualquier caso: **migración aditiva nueva**, sin reescribir `20261031200000` ni `20261031210000`.

### Invariantes

1. **Preparación:** INSERT/UPDATE/DELETE de evidencia y field classes permitidos mientras `toVersion` es `DRAFT` (aunque `fromVersion` sea `VALIDATED`).  
2. **Sellado del candidato:** una vez `toVersion` es `VALIDATED`, toda mutación de esas filas (y field classes ligadas) se rechaza — OLD y NEW.  
3. **Historia del predecesor:** el contenido del bundle `VALIDATED` (grants/restrictions/…) sigue inmutable por triggers de hijos `#24` (sin cambio). La evidencia nueva **no** reescribe filas del predecesor.  
4. **Anti-elusión por traslado:** todo UPDATE que mueva `organizationId` / `fromVersion` / `toVersion` / `evidenceRowId` evalúa **OLD y NEW**; si el candidato OLD o NEW está `VALIDATED` → rechazo. No se puede “huir” de un candidato sellado ni “aportar” evidencia a un candidato ya sellado.  
5. **Aislamiento org:** FKs compuestas `#24` + comprobaciones siempre scoped por `organizationId` de OLD/NEW; rechazo si NEW.organizationId ≠ contexto del bundle referenciado.  
6. **Sin GUC / session markers / replication_role de producto** para autorizar evidencia.

### Qué no cambia

- Inmutabilidad de bundles `VALIDATED` y de hijos con `bundleId` (grants, etc.).  
- RLS/REVOKE de clientes.  
- ALT-H / fail-closed / HMAC (Parte IV).  
- Prohibición de INSERT directo `VALIDATED` y de UPDATE crudo DRAFT→VALIDATED fuera del seal.

## V.4 Matriz de operaciones (evidencia y field classes)

Leyenda: **P** = permitido; **X** = prohibido.  
`Cand` = bundle de `toVersion` (o del `toVersion` de la evidencia apuntada por field class).  
`Pred` = bundle de `fromVersion`.

### `CrmReadPolicyChangeEvidence`

| Op | Pred DRAFT / Cand DRAFT | Pred VALIDATED / Cand DRAFT | Pred * / Cand VALIDATED | Cambio de org / retarget a otra org |
|---|---|---|---|---|
| INSERT | P | **P** (sucesión 4A-1C) | X | X (FK/org) |
| UPDATE (payload/kind/ids sin mover cand a VALIDATED) | P | P | X (OLD o NEW) | X |
| UPDATE `toVersion` → otro DRAFT same-org | P | P | X si OLD o NEW cand VALIDATED | X cross-org |
| UPDATE `fromVersion` (pred puede ser VALIDATED) | P | P | X si cand VALIDATED | X cross-org |
| DELETE | P | P | X | — |

### `CrmReadPolicyChangeEvidenceFieldClass`

| Op | Evidencia cuyo Cand es DRAFT | Evidencia cuyo Cand es VALIDATED | UPDATE `evidenceRowId` OLD→NEW |
|---|---|---|---|
| INSERT | P | X | — |
| UPDATE (fieldClass/direction) | P | X | — |
| UPDATE `evidenceRowId` | P solo si **ambos** candidatos OLD y NEW son DRAFT | X si cualquiera VALIDATED | Evaluar OLD+NEW |
| DELETE | P | X | — |

### Traslados / elusiones explícitamente cubiertos

| Intento | Resultado |
|---|---|
| Tras sellar cand V2, DELETE evidencia `1→2` | X |
| Tras sellar V2, INSERT field class en evidencia `1→2` | X |
| UPDATE evidencia `toVersion` de V2(VALIDATED) a V3(DRAFT) para “editar historia” | X (OLD cand VALIDATED) |
| UPDATE evidencia `toVersion` de V3(DRAFT) a V2(VALIDATED) | X (NEW cand VALIDATED) |
| Mover `organizationId` a otra empresa | X (FK + trigger) |
| Mutar grants del pred VALIDATED “para cuadrar evidencia” | X (immutability de hijos `#24`, intacta) |

## V.5 Casos de prueba requeridos

### A. Postgres desechable + esquema **real** PR #24 (tras migración correctiva propuesta)

| Id | Caso | Esperado |
|---|---|---|
| E-FIX-1 | Pred V1 VALIDATED, cand V2 DRAFT: INSERT evidence `1→2` | **P** |
| E-FIX-2 | Mismo: INSERT EvidenceFieldClass | **P** |
| E-FIX-3 | UPDATE evidence kind/target mientras V2 DRAFT | **P** |
| E-FIX-4 | DELETE evidence mientras V2 DRAFT | **P** |
| E-FIX-5 | Sellar V2; luego INSERT/UPDATE/DELETE evidence `1→2` | **X** |
| E-FIX-6 | Sellar V2; luego DML field class de esa evidence | **X** |
| E-FIX-7 | UPDATE `toVersion` 2→3 con V2 ya VALIDATED | **X** |
| E-FIX-8 | UPDATE `toVersion` 3→2 con V2 VALIDATED y V3 DRAFT | **X** |
| E-FIX-9 | Cross-org evidence INSERT | **X** |
| E-FIX-10 | Mutar grant de V1 VALIDATED | **X** (regresión hijos) |
| E-FIX-11 | Pred DRAFT, cand DRAFT: evidence DML | **P** (ambos draft) |
| E-FIX-12 | Sensibilidad: restaurar helper either-endpoint → E-FIX-1 debe **fallar**; prueba falla si el control nuevo no está | S |

### B. Extensión del laboratorio ALT-H (PR #26) — opcional alineación

Actualizar el lab para citar esta norma (mismo ancla `toVersion`) y añadir E-FIX-* sintéticos. **No** se hace en este corte documental del PR #25.

### C. Sin usar

GUC, `set_config` de producto, `session_replication_role` en caminos productivos, DISABLE TRIGGER por roles app/sealer.

## V.6 Migración correctiva aditiva (propuesta; no aplicada aquí)

| Pregunta | Respuesta |
|---|---|
| ¿Hace falta migración? | **Sí**, si se adopta esta norma en producto |
| ¿Editar `20261031200000` / `…210000`? | **No** |
| ¿Forma? | Nueva migración posterior, p. ej. `20YYMMDDHHMMSS_crm_read_policy_evidence_candidate_anchor` |
| ¿Contenido? | `CREATE OR REPLACE` de helpers de evidencia para anclar solo en `toVersion`; triggers siguen llamando helpers (o se actualizan a nombres nuevos); `REVOKE` de funciones actualizadas a `PUBLIC`/clientes como en hardening; tests desechables E-FIX-* |
| ¿Datos existentes? | Solo DRAFT operativo hoy en producto (VALIDATED bloqueado); correctiva es segura en greenfield y en DBs que solo tengan DRAFT |
| ¿GUC? | Ninguno |

**Esta migración correctiva es un corte previo o el primer paso de 4A-1C-1**, no un rewrite de `#24`. PR `#24` permanece históricamente intacto.

## V.7 Riesgos residuales

| Riesgo | Mitigación |
|---|---|
| Evidencia editable mientras cand DRAFT podría divergir del contenido del pred | SealService + `#23` succession + `contentRevision`; pred inmutable |
| Operador borra evidencia necesaria antes del seal | Fallo de succession validation; no sellado |
| Olvidar field-class helper en la correctiva | E-FIX-2/6 + sensibilidad S |
| Confundir ancla `toVersion` con “cualquier VALIDATED en la org” | Helpers explícitos; pruebas E-FIX-1 vs E-FIX-5 |
| Lab `#26` ya alineado en espíritu pero no sobre schema `#24` | Portar E-FIX al schema real en el PR de migración |

## V.8 Impacto en C1–C10 y desbloqueo de 4A-1C-1

| Ítem | Tras Parte V |
|---|---|
| Conflicto estructural lab `#26` | **Cerrado en diseño** con regla candidata-ancla |
| C5 (evidencia en inventario) | Norma actualizada; sigue **Solo pruebas reales** en schema `#24` |
| Migración correctiva evidencia | **Nueva condición bloqueante de implementación** hasta aceptarse y aterrizar |
| 4A-1C-1 | Sigue **bloqueado** |

### Recomendación sobre desbloqueo de 4A-1C-1

**Aún no desbloquear 4A-1C-1 completo.** Orden recomendado tras aceptación humana de Parte V:

1. **Corte 4A-1C-0b (o primer commit de 4A-1C-1):** migración aditiva candidate-anchor + suite E-FIX sobre schema real `#24` en Postgres desechable.  
2. Confirmar C3/C9/C10 (fail-closed grants, H-OWNER-TABLE, gate merge).  
3. Solo entonces autorizar el resto de 4A-1C-1 (seal HMAC operativo sin HTTP/activación).

Si Parte V se rechaza, 4A-1C-1 permanece bloqueado: el hardening actual `#24` es incompatible con sucesión post-sellado del predecesor.

## V.9 Resumen ejecutivo

| Pregunta | Respuesta |
|---|---|
| ¿Regla actual? | Either-endpoint VALIDATED ⇒ evidencia inmutable |
| ¿Por qué falla 4A-1C? | Bloquea evidencia `VALIDATED→DRAFT` necesaria antes del seal del candidato |
| ¿Regla nueva? | Inmutabilidad anclada solo si **`toVersion` (candidato) es VALIDATED** |
| ¿GUC/bypass? | No |
| ¿Migración? | Aditiva posterior al hardening; no reescribir `#24` |
| ¿4A-1C-1 ahora? | **No** — aceptar Parte V, aterrizar correctiva + E-FIX, luego resto |

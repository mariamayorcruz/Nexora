# Punto 8 — Paso 4A-1C: diseño del sellado transaccional CRM (revisión de seguridad)

**Estado:** diseño documental — **no aprobado para implementación** (verificación final de viabilidad/seguridad; Partes II–III).  
**Alcance:** solo lectura/diseño. Sin código operativo, sin migraciones aplicadas, sin APIs, sin merge, sin deploy, sin producción.  
**No modifica** PR #22, #23 ni #24.

### Bloqueo de viabilidad (hallazgo confirmado)

La verificación **Ed25519 dentro de SQL** **no es viable** en el PostgreSQL objetivo (Supabase hosted) vía `pgcrypto`. Ver Parte II §V1 y Parte III. La arquitectura recomendada es **ALT-H** (HMAC-SHA256 con `pgcrypto` + separación de roles + fail-closed), no Ed25519-in-SQL.

## HEADs de referencia (re-verificados en verificación final)

| Artefacto | HEAD | Draft |
|---|---|---|
| PR #22 evaluador | `368fb25c7bf7a4674013c51d28b8a6919fbf7239` | sí |
| PR #23 validadores | `02c8a573b967d7656c8f5e057003b49ae214d0c5` | sí |
| PR #24 persistencia + hardening | `b57c233043bbde2c74f71c29a9296ae9bc494ff3` | sí |
| PR #25 este diseño | *(actualizar al commit de esta revisión)* | sí |

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

1. Aceptar **descarte** de Ed25519-in-SQL en favor de **ALT-H** (HMAC + roles).  
2. Aceptar frontera residual: poseedor de secreto HMAC + EXECUTE ≡ puede atestar sin `#23` (mitigada por fail-closed y proceso único).  
3. Aceptar inventario H1–H10 (esp. evidencia fuera del checksum pero dentro de revision; `TRUNCATE`/replication).  
4. Estrategia exacta de almacenamiento del secreto (Vault vs secreto de migración solo-owner) en el hosting real — **sin** inspeccionar producción en este corte.  
5. Confirmación de que no se usará `pgsodium` pese a estar listado.

**Estado tras esta verificación:** diseño actualizado; **sigue sin aprobación** para implementar 4A-1C-1.

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

## III.5 Condiciones exactas para aprobar 4A-1C-1

4A-1C-1 (migración + función seal + suite Postgres desechable) **solo** podrá autorizarse cuando un revisor humano confirme **todas** las casillas siguientes:

- [ ] **C1.** Se acepta el descarte de Ed25519-in-SQL y la adopción de **ALT-H** (`pgcrypto.hmac` + roles).  
- [ ] **C2.** Se acepta que `current_user` / checksum / `actorId` / `sealAuthorityRef` **no** son prueba de validación `#23` ni de autorización.  
- [ ] **C3.** Se acepta el modelo fail-closed: en producto, sin autoridad verificable → sin `GRANT EXECUTE` útil / sin emisión de MAC / cero sellados ordinarios.  
- [ ] **C4.** Se acepta la frontera residual HMAC+EXECUTE (mitigada por C3 y emisor único).  
- [ ] **C5.** Se acepta el inventario de locks/revision tablas 1–10 y huecos **H1–H10** (incl. evidencia fuera del checksum pero dentro de revision; TRUNCATE/replication).  
- [ ] **C6.** Se acepta predecesor **VALIDATED** obligatorio para `version > 1`; metadatos de sellado fuera del canónico; candidatos vacíos OK; **sin** activación operativa.  
- [ ] **C7.** Se acepta la suite mínima N1–N10, S1–S6 y concurrencia por tabla antes de merge de 4A-1C-1.  
- [ ] **C8.** Se confirma **no** usar `pgsodium` como dependencia nueva.  
- [ ] **C9.** Se define (aunque sea “aplazar a 4A-1C-1 con Vault|solo-owner”) el alojamiento del secreto HMAC **sin** inspeccionar producción en este PR.  
- [ ] **C10.** PR #22 / #23 / #24 permanecen sin modificar por el corte 4A-1C-1; este diseño (#25) no se mergea a `main` sin gate de deploy.

**Mientras C1–C10 no estén explícitamente aprobados, 4A-1C-1 permanece bloqueado.**

## III.6 Entrega de esta verificación

| Campo | Valor |
|---|---|
| Documento | `docs/point-8-4a1c-crm-read-policy-seal-design.md` |
| PR | https://github.com/mariamayorcruz/Nexora/pull/25 |
| Código operativo | Ninguno |
| Migraciones / APIs / merge / deploy / prod | No |
| Próximo paso | Revisión humana de C1–C10; **detener** antes de implementar |

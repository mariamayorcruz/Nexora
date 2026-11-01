# Punto 8 — Paso 4A-1C: diseño del sellado transaccional CRM (revisión de seguridad)

**Estado:** diseño documental — **no aprobado para implementación**.  
**Alcance:** solo lectura/diseño. Sin código operativo, sin migraciones aplicadas, sin APIs, sin merge, sin deploy, sin producción.  
**No modifica** PR #22, #23 ni #24.

## HEADs de referencia (verificados al redactar)

| Artefacto | HEAD |
|---|---|
| PR #22 evaluador | `368fb25c7bf7a4674013c51d28b8a6919fbf7239` |
| PR #23 validadores | `02c8a573b967d7656c8f5e057003b49ae214d0c5` |
| PR #24 persistencia + hardening | `b57c233043bbde2c74f71c29a9296ae9bc494ff3` |

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
- **Atestación firmada** que vincula el resultado `#23` al contenido DB.
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

### Elección recomendada: **B + A (defensa en profundidad)**

1. **Atestación de sellado** (argumento de la función, no prueba por sí sola de autoridad):

```text
SealAttestation = {
  v: 1,
  organizationId,
  bundleId,
  version,
  canonicalVersion: "crm-read-policy-canonical/v1",
  contentChecksum,          // digest #23 del contenido hidratado
  contentRevision,          // contador DB del bundle (ver §2)
  predecessorVersion,       // null si version=1; si no, versión VALIDATED
  predecessorChecksum,      // checksum del predecesor VALIDATED
  issuedAt,                 // timestamptz
  nonce                     // uuid anti-reuso en ventana DRAFT
}
signature = Ed25519_Sign(SEAL_ATTESTATION_PRIVATE_KEY, canonical_bytes(SealAttestation))
```

2. Emisión **únicamente** en SealService **después** de:

   - autoridad fail-closed = allow (hoy: nunca; ver §3),
   - hidratar desde DB,
   - `validateCrmReadPolicyBundle` = ok,
   - si `version > 1`: predecesor **VALIDATED** + `validateCrmReadPolicySuccession` = ok,
   - `computeCrmReadPolicyBundleChecksum` = `contentChecksum`,
   - leer `contentRevision` bajo el mismo lock de transacción.

3. Función SQL `crm_read_policy_seal_bundle(attestation jsonb, signature bytea, audit jsonb)`:

   - Verifica firma con **clave pública** embebida/configurada en DB (no secreto privado).
   - Parsea campos; rechaza atestación caducada (p. ej. TTL ≤ 60s desde `issuedAt`).
   - Relee el bundle `FOR UPDATE`; exige `DRAFT`, mismos `organizationId`/`id`/`version`.
   - Exige `bundle.contentRevision = attestation.contentRevision`.
   - Exige `version = 1` ⇒ sin predecesor; `version > 1` ⇒ predecesor existe, same-org, **VALIDATED**, checksum de predecesor coincide.
   - **No** acepta sellar por checksum suelto, `actorId` ni `sealAuthorityRef` sin firma válida.
   - UPDATE mínimo: `status=VALIDATED`, `contentChecksum=attestation.contentChecksum`, columnas de auditoría (§4). Metadatos de sellado **no** alteran el checksum canónico.

4. **Defensa en profundidad (A):** `REVOKE EXECUTE … FROM PUBLIC` y del rol app genérico si es distinto; `GRANT EXECUTE` solo al rol de conexión del SealService. Así un cliente Data API u otro rol no intenta ni verificar firmas.

5. Clave privada: solo en entorno del proceso SealService (secret manager). **Nunca** en SQL, ni en GUC, ni en filas.

### Por qué checksum / actor / authorityRef no bastan (explícito)

| Señal | Por qué falla como prueba de `#23` |
|---|---|
| Checksum no vacío | Puede inventarse o copiarse; no implica reglas de sucesión/evidencia/retired |
| `actorId` | Identidad de invocación, no validación estructural |
| `sealAuthorityRef` | Referencia opaca; forjable sin verifier real |
| Columna “ready” escribible | El mismo rol que llama a seal puede ponerla |

La **firma sobre el digest `#23` + `contentRevision` + identidad del bundle** es la prueba de que un poseedor de la clave privada atestiguó ese resultado. El proceso que posee la clave **solo firma tras `#23` ok** (invariante de implementación + tests).

### Invariantes verificables (Postgres real)

1. `EXECUTE` de `crm_read_policy_seal_bundle` con checksum inventado y **sin** firma → rechazo.  
2. Firma válida pero payload con `contentChecksum` que no corresponde al contenido hidratable / revision → rechazo (revision o precondiciones).  
3. Firma sobre attestation de bundle A aplicada a bundle B → rechazo.  
4. Rol `anon`/`authenticated` sin `EXECUTE`.  
5. Atestación expirada → rechazo.  
6. Tras mutar un grant (revision↑) reutilizar atestación antigua → rechazo por `contentRevision`.

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
| E1 | Seal SQL con checksum libre, sin firma | rechazo |
| E2 | Firma con clave incorrecta | rechazo |
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

Harness de laboratorio para E/C (firma de test) **separado** de A1–A3 (camino productivo deny-all).

---

## 7. Riesgos residuales

| Riesgo | Mitigación |
|---|---|
| Compromiso de la clave privada de atestación | Equivale a compromiso SealService; rotación; F3 limita EXECUTE |
| Olvidar una tabla hija en triggers de lock/revision | Lista explícita en migración + test que falle si se añade tabla sin trigger (inventory assert) |
| Deriva SQL vs checksum `#23` | SQL **no** recalcula FNV canónico; vincula revision + checksum atestiguado tras hydrate TS |
| Confundir auditoría `sealedByActorId` con allow | Fail-closed ignora actor para allow; tests A2 |
| Auto-deploy Vercel al merge | Gate humano; este doc no autoriza merge |

---

## 8. Cortes de implementación (solo tras nueva aprobación)

| Corte | Contenido | ¿Código operativo? |
|---|---|---|
| **4A-1C-0** | Este diseño (doc) | No |
| **4A-1C-1** | Migración: `contentRevision`, columnas auditoría mínimas, locks en triggers hijo, función seal + verify firma, REVOKE/GRANT; suite Postgres E/C/R | Sí — **requiere aprobación explícita** |
| **4A-1C-2** | SealService TS: fail-closed authority, hydrate, `#23`, firmar, llamar seal; sin HTTP | Sí — tras 4A-1C-1 |
| **4A-1C-3** | Concurrencia/aislamiento org + sensibilidad | Sí |
| **Futuro** | Verifier de autoridad real | Otro PR; sustituye fail-closed |

---

## 9. Resumen ejecutivo para revisores

1. **Sin `#23` no hay seal:** la función privilegiada exige atestación Ed25519 firmada solo tras validadores; checksum/actor/ref no bastan.  
2. **Contenido estable:** DML hijo/evidencia toma `FOR UPDATE` de padres + `contentRevision` firmado + txn `SERIALIZABLE`.  
3. **Fail-closed:** ninguna identidad ordinaria sella hasta existir autoridad verificable; el camino productivo no emite atestaciones.

**No implementar 4A-1C-1 hasta nueva aprobación explícita de este diseño revisado.**

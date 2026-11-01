# Punto 8 — Paso 4A-1A: validadores puros de formato y sucesión

Contrato de módulos TypeScript puros para políticas **candidatas** de lectura CRM (`crm.lead.read`). No hay base de datos, rutas, activación ni autoridad operativa.

Código: `src/lib/tenancy/crm-read-policy-format.ts`  
Pruebas: `npm run tenancy:validate-point8-4a1a`

## Qué valida

1. `validateCrmReadPolicyBundle` — estructura de un bundle candidato.
2. `validateCrmReadPolicySuccession` — sucesión entre un bundle de referencia y un candidato, con predecesor esperado, evidencia de cambio y `AuthorityContext` sintético.

Un resultado `ok: true` significa solo **estructura/sucesión válida**. Siempre enumera `pendingExternalChecks` (autoridad de plataforma, roots, activación, concurrencia e inmutabilidad en base). No concede lectura, no aprueba activación y no certifica actores reales.

## Identidad

- `logicalId`: identidad estable de la concesión o restricción entre versiones.
- `versionId`: identidad de la fila en **esta** versión del bundle.

Reactivar como `active` el mismo `logicalId` que estaba `revoked`/`invalidated` se rechaza. Una concesión nueva usa otro `logicalId` y evidencia `add_grant`.

## Checksum

Versión canónica: `crm-read-policy-canonical/v1`.  
Incluye organización, versión, catálogos de membresías/leads, grants y restrictions con alcance, clases ordenadas, validez, cadena (`parentVersionId`), vigencia, origen y procedencia.  
Ordenaciones irrelevantes no cambian el digest; un cambio semántico sí. No se usa `JSON.stringify` de objetos de entrada sin canonicalizar.

- `status: 'validated'` exige `contentChecksum` presente e igual al digest canónico.
- `status: 'draft'` admite `contentChecksum: null`; si se declara, debe coincidir.
- La misma regla se aplica al bundle suelto y a referencia/candidato en sucesión.

## Sucesión y evidencia

Las diferencias de clases se calculan como conjuntos (`añadidas = candidato \ referencia`, `retiradas = referencia \ candidato`). Añadir clases a una restricción no compensa retirar otras.

Contrato por `changeKind` (campos obligatorios y admitidos):

| changeKind | Obligatorio | Admitido además |
|---|---|---|
| `add_grant` / `add_restriction` | `after` con huella (membershipId, fieldClasses, scopeKind, scopeLeadId) igual al objeto nuevo | — |
| `lift_restriction` / `remove_grant` / `revoke_grant` / `invalidate_grant` | `before` con la misma huella del objeto de referencia | — |
| `widen_grant_classes` | `fieldClassesAdded` exacto | `before`/`after` solo con `fieldClasses` |
| `narrow_*` | `fieldClassesRemoved` exacto | `before`/`after` solo con `fieldClasses` |
| `reassign_grant` | `before`/`after.membershipId` | solo esos campos |
| `widen_grant_scope` / `extend_grant_window` / `change_grant_parent` / `change_grant_origin` | `before`/`after` del atributo cambiado | solo campos de ese atributo |

Una etiqueta + `logicalId` no bastan. Snapshots contradictorios o campos no admitidos → `evidencia_inexacta`. Evidencia hacia un id ausente → `objeto_inexistente`. Filas que no cubren un cambio real se rechazan.

Toda reducción de restricción pasa auto-levantamiento del `AuthorityContext` sintético (también parcial).

## Formato de entrada admitido

- Objetos propios con prototipo `Object.prototype` o `null`, sin accessors propios.
- Arrays densos con prototipo `Array.prototype`, sin accessors ni huecos.
- Instantes UTC reales `YYYY-MM-DDTHH:mm:ss[.sss]Z` (misma disciplina de calendario que el evaluador del paso 3).
- No se ejecutan getters, métodos del valor recibido ni comprobaciones de etiqueta de marca del host object.
- Scope `assigned` rechazado. Acción distinta de `crm.lead.read` rechazada.
- Colecciones `grants`, `restrictions`, `membershipIds` y `leadIds` deben **estar presentes**; `[]` es vacío explícito válido.

## Límites de este corte

- No impide escrituras en base de datos ni prueba locks reales.
- No implementa inventarios operativos, binding legacy, activación, suspensión, adaptador ni rutas.
- `AuthorityContext` es fixture de test; no es un sistema de administración de Nexora.
- El evaluador del PR #22 no se importa ni se modifica.

## Profundidad de cadena

`CRM_READ_POLICY_MAX_CHAIN_DEPTH = 8`, alineado con el evaluador aprobado del paso 3.

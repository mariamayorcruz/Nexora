# Punto 8 — Paso 3: evaluador puro de lectura CRM

Evaluador desconectado. No autentica, no abre rutas y no inicia el paso 4.

Diseño aplicado, por el commit revisado y no por borradores anteriores:

https://github.com/mariamayorcruz/Nexora/blob/fe75b28ff54c92d16de544ce5187fbf7c24ac0e8/docs/point-8-step-02-company-access-contract.md

Secciones usadas: 2, 3, 5, 8 y 9. La identidad de cuenta, empresa y membresía sigue siendo la `Membership` ya existente. Este módulo no crea otro motor de roles.

## Uso

```ts
import { evaluateCrmLeadRead } from '@/lib/tenancy/crm-read-evaluator';

const decision = evaluateCrmLeadRead(snapshot, request);
if (decision.decision === 'allow') {
  // records ya proyectados; count === records.length
}
```

`decision === 'allow'` es la única salida que permite leer. `permitted: true` solo aparece ahí. `legacy_actual` devuelve `permitted: false` y no es un permiso.

La función es pura: no modifica el snapshot, no llama callbacks, no lee el reloj del sistema y no importa cliente de base de datos, variables de entorno ni utilidades con efectos.

La entrada tiene que ser dato propio. Un objeto de política o de petición solo se acepta si su prototipo es `Object.prototype` o `null`. Un accessor propio o un prototipo heredado cierra en `entrada_invalida` sin ejecutar el getter ni el setter. Un array de política o de consulta solo se acepta si su prototipo es `Array.prototype`, sin accessors y sin índices huecos; si no, la evaluación es `entrada_invalida`. No se leen propiedades heredadas. La fecha de un lead se copia con los métodos de `Date.prototype` capturados al cargar el módulo, así que un `getTime` sustituido en la instancia no se ejecuta.

## Entrada

El adaptador futuro entrega un snapshot coherente y vigente. Este módulo no lo busca.

| Dato | Regla |
|---|---|
| `transitionMode` | `contrato_activo` aplica la política. `legacy_actual` delega sin datos. Cualquier otro valor, o la ausencia, deniega. |
| `platformOffersCrmLeadRead` | Tiene que ser `true`. Si falta o es falso, la lectura se deniega. |
| `principal` | `authenticated: true`, `exists: true` y `userId` no vacío. |
| `organizations` / `memberships` | La empresa de la petición está `ACTIVE`. La membresía del par exacto `organizationId` + `userId` está `ACTIVE`. `INVITED`, `SUSPENDED` y `REMOVED` deniegan. El rol no se lee. |
| `grants` | Concesiones de lectura ya normalizadas. No hay expansión de `OWNER`, `ADMIN` o `MEMBER`. |
| `restrictions` | Negaciones ya normalizadas. Solo `validity: 'lifted'` deja de aplicar. Otro valor, o la ausencia, mantiene la restricción. El autor no se consulta. |
| `assignments` | Pares explícitos empresa + membresía + lead. `userId` del lead es procedencia y no asigna. |
| `leads` | Registros sintéticos o de snapshot. La lista tiene que estar completa: este módulo no descubre leads faltantes. |
| `evaluatedAt` | Instante UTC real `YYYY-MM-DDTHH:mm:ss[.sss]Z`. Si está presente y no es un instante de calendario, la evaluación es `entrada_invalida`. Hace falta cuando una concesión trae ventana. |

Una concesión de lectura lleva `action: 'crm.lead.read'`, `accessMode: 'read'`, ámbito, clases de campo, `validity: 'active'`, origen y `parentGrantId`. `null` en el padre significa que la concesión se presenta como raíz. La raíz efectiva solo puede ser `company_authority` o `legacy_snapshot` con `rootValidated: true` y la misma empresa. `delegated_chain` y `agency_relation` necesitan un padre vigente. `origin.revoked: true` apaga esa concesión. El módulo no comprueba propiedad legal ni una etiqueta `ADMIN`: `rootValidated` lo aporta el adaptador.

Ámbitos: `{ kind: 'company' }`, `{ kind: 'assigned' }` o `{ kind: 'record', leadId }`. Un ámbito de empresa o asignados que además trae `leadId` no autoriza.

Petición de lectura: `operation: 'list'` con ámbito `company` o `assigned`, u `operation: 'read_record'` con `leadId`. Cualquier otra operación o acción del catálogo se deniega sin datos.

Dependencias de consulta, si existen, van en `query.filterFields`, `query.sortFields` y `query.aggregateFields`. No se acepta otra clave. Esas listas no se ejecutan: solo se valida que cada campo sea legible en todo el ámbito de la petición.

## Salida

| `decision` | Significado |
|---|---|
| `deny` | No hay datos de leads. El `reason` no nombra registros ni campos ajenos. |
| `legacy_actual` | Delegación explícita. No es permitir y no incluye leads. |
| `allow` | `records` proyectados, `count` igual a esa lista, `scopeKind` y `queryDependencies` aceptadas. |

Razones de denegación: `modo_no_definido`, `persona_no_autenticada`, `persona_inexistente`, `empresa_no_activa`, `membresia_inexistente`, `membresia_no_activa`, `accion_no_ofrecida`, `accion_fuera_de_corte`, `operacion_no_definida`, `entrada_invalida`, `politica_incompleta`, `sin_permiso`, `campo_no_legible`.

Un listado de asignados autorizado y sin coincidencias es `allow` con `records: []`. Un listado de empresa sin concesión de ese ámbito es `sin_permiso`, aunque exista un registro compartido. Una lectura puntual sin ningún campo visible es `sin_permiso`, no un objeto vacío.

## Campos

El mapeo está fijo en `CRM_LEAD_READ_FIELDS`. No sale de las claves del lead.

| Clase | Columnas |
|---|---|
| `identidad` | `id`, `name` |
| `canal` | `email`, `phone` |
| `gestion` | `company`, `source`, `stage`, `status`, `nextAction`, `lastContactedAt`, `confidence`, `createdAt`, `updatedAt` |
| `reservado` | `value`, `notes` |

La tupla usa la clase, no la columna suelta: `notes` y `value` se conceden o se restringen juntos. Una clase desconocida en una concesión se ignora y no proyecta nada. Una clase desconocida en una restricción de esta membresía y empresa invalida la evaluación. `userId`, `organizationId`, `campaignId` y cualquier otro campo quedan fuera. Un valor que no es escalar, booleano, número finito o fecha no se copia. La fecha de un lead se devuelve como texto UTC, sin cambiar el objeto de entrada.

## Cadena y restricciones

En cada eslabón hacen falta origen coherente con la empresa, vigencia `active`, ventana horaria cumplida, padre existente, sin ciclos y con profundidad de hasta `CRM_READ_MAX_CHAIN_DEPTH` (8, contando la concesión). La ventana es inclusiva: `validFrom <= evaluatedAt <= validUntil`. Un límite que no es un instante real, o `validFrom` posterior a `validUntil`, anula esa concesión y no se normaliza. Sin `evaluatedAt`, una concesión con ventana no está vigente. El padre tiene que cubrir todas las clases del hijo y un ámbito suficiente:

- empresa cubre empresa, asignados y un registro de esa empresa;
- asignados cubre un registro solo si ese lead está asignado a la membresía del padre;
- asignados cubre el ámbito asignado del hijo solo si cada asignación del hijo en esa empresa también está asignada al padre;
- un registro cubre solo ese mismo identificador.

Si el padre no cubre la tupla entera, la concesión hija no se parte: no autoriza. Reactivar al padre no revive una hija con `validity: 'invalidated'`. Otra concesión nueva y vigente sí puede autorizar, porque es otro acto ya presente en el snapshot. El evaluador no escribe esa vigencia.

Una restricción de la misma empresa, acción, ámbito y clase se conserva para la membresía a la que nombra, no solo para el lector. En cada eslabón, el campo de un lead es legible solo si ese eslabón incluye la clase, su ámbito cubre el lead para su propia membresía y ninguna restricción vigente de esa membresía lo alcanza. Una restricción del padre o del abuelo oculta esa clase en la delegación y no apaga el resto de clases: identidad puede seguir si solo `reservado` está restringido. Una concesión directa del lector, con otra cadena, no hereda la restricción del otorgante. La de otra empresa no entra. La de otra membresía no afecta a una concesión que no cuelga de ella. Suspender o retirar al autor no la levanta.

Una restricción de empresa bloquea esa clase en cualquier ámbito pedido de ese eslabón. Una de asignados bloquea el listado de asignados y un registro solo si ese lead está asignado a esa membresía; no bloquea un listado de empresa vacío. Una de registro bloquea ese identificador y no un listado de empresa o de asignados vacío.

## Consultas

Antes de mirar filtros, orden o agregados se apartan los registros sin ninguna clase legible. No se proyectan, no cuentan y no cambian `allow` ni `deny`: el resultado con esa ficha es el mismo que sin ella, tanto si el resto está vacío como si hay otra ficha visible. Una ficha parcialmente visible sí entra. Si el campo de la consulta no es legible en cada una de esas fichas, la petición se rechaza con `campo_no_legible` y sin registros. Si no queda ninguna ficha visible, el campo se juzga solo por el ámbito y la cadena, no por filas invisibles. No se filtra, no se ordena y no se agrega.

## Ajustes de denegación

Estos límites no estaban escritos como código en el diseño y se cerraron hacia denegar:

1. La lectura de un id de otra empresa, inexistente o sin cobertura usa `sin_permiso` y no devuelve el registro. No se emite `registro_otra_empresa`, para no confirmar que el id existe en otro sitio.
2. Un fallo de cadena también es `sin_permiso`. La respuesta no describe el eslabón roto.
3. Falta de `grants`, `restrictions`, `assignments`, `leads`, `organizations` o `memberships` es `politica_incompleta`. Un array vacío significa que el snapshot sí vino vacío. No se interpreta como “sin restricciones” ni como “sin asignaciones” si la clave no está.
4. Una concesión cuya tupla el padre no cubre por completo no autoriza la parte que sí coincidiría.
5. La profundidad de cadena por encima de 8 deniega.
6. `legacy_actual` se resuelve antes de la operación. Exportar o enviar en ese modo sigue siendo delegación sin datos, no un permiso de contrato. En `contrato_activo`, esas operaciones salen `accion_fuera_de_corte`.

## TOCTOU y frontera

El resultado vale para el snapshot recibido, no para un instante posterior. El integrador tiene que volver a cargar empresa, membresía, concesiones, restricciones, asignaciones y leads juntos, y volver a llamar al evaluador antes de responder. No debe fiarse de ids, roles o listas armadas en el navegador. `rootValidated` no demuestra por sí solo una raíz legal: solo registra que un adaptador de confianza ya separó esa evidencia. Este paso no es ese adaptador.

La proyección no autoriza a enviar, exportar, editar, archivar, compartir ni borrar. Esas acciones se deniegan aquí aunque la lectura esté permitida.

## Prueba

```bash
npm run tenancy:validate-point8-step03
```

Resultado de esta revisión: 34 escenarios sintéticos, todos en verde. Cubren lectura autorizada, denegación por identidad, empresa y membresía, aislamiento entre empresas, rol sin concesión, campos reservados y metadatos, acciones fuera de corte, cruce de registro y campo, restricciones de la cadena por registro y campo, instantes UTC reales, dato propio sin accessors, fichas totalmente invisibles, asignaciones, modos, consultas y entradas malformadas. Los datos son ficticios. La suite también comprueba que el módulo no importa runtime con efectos y que ningún otro archivo TypeScript o JavaScript de la aplicación lo referencia.

No está conectado a `GET /api/crm/leads` ni a ninguna pantalla. Un módulo probado y desconectado no es una función desplegada.

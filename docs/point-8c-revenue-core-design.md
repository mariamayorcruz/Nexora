# Point 8C — Revenue Core

Este documento describe el comportamiento implementado en la rama de Point 8C y el despliegue que **aún no está autorizado**.

Point 8B-6 en producción sigue **COMPLETE**. Esta fase no lo repite, no usa `DATABASE_URL` de producción y no mueve la facturación a `Organization`.

## 1. Decisiones aprobadas

El usuario autorizó estas reglas. Ya no son preguntas abiertas.

1. El MRR sale de la proyección local de suscripciones Stripe, no del catálogo (`29` / `79` / `199`) y no de `Analytics.revenue` ni de `CrmLead.value`.
2. Un precio anual se divide entre 12. `interval_count` entra en el divisor: mes usa `interval_count`; año usa `12 * interval_count`.
3. `trialing` no entra en el MRR. Solo `stripeStatus = active` con precio completo de mes o año.
4. El ingreso cobrado es la suma de facturas `paid` con `amountMinor`. No es el MRR y no reemplaza a un campo `totalRevenue`.
5. La facturación sigue por `User` en esta fase. `Subscription.userId` e `Invoice.userId` se conservan. No se añade `organizationId`.
6. La idempotencia es persistente por `event.id`.

## 2. Proyección que escribe el webhook

El webhook sigue verificando la firma sobre el cuerpo crudo (`request.text()` + `constructEvent`). Una firma inválida responde `400` y no inserta fila.

Después de la firma, `processStripeEvent` abre una transacción:

1. `INSERT` de `StripeWebhookEvent` con `ON CONFLICT (id) DO NOTHING`.
2. Si la fila ya estaba `processed`, responde duplicado y no reaplica.
3. Si la fila existe en otro estado, lanza error. La petición responde `500` para que Stripe reintente. No se marca `processed`.
4. Aplica el efecto y solo entonces pasa la fila a `processed`.
5. Si el efecto falla, la transacción revierte el insert. El `event.id` puede reintentarse.

`checkout.session.completed` recupera la suscripción en Stripe antes de abrir la transacción. Si esa lectura falla, no hay fila de evento.

### Suscripción

Se guardan el status crudo de Stripe (`status` y `stripeStatus`), el ciclo, `interval_count`, la suma `unit_amount * quantity` en unidades menores, la moneda en mayúsculas y `event.created`.

- Un price id del catálogo de `billing.ts` conserva su plan.
- Un price id desconocido queda `unrecognized`. No se convierte en `starter` ni en 29.
- Cupones y descuentos no se restan. El MRR usa el precio de lista.
- Varios ítems se suman solo si comparten moneda, intervalo e `interval_count` y todos tienen `unit_amount` y `recurring`. Si no, el precio queda incompleto y no hay suma parcial.
- `day` y `week` se almacenan y quedan fuera del MRR. No se inventa un divisor.
- Si `metadata.userId` falta, la transacción falla y Stripe puede reintentar.

### Factura

`amount_paid` se guarda como entero menor en `Invoice.amountMinor`. No se divide entre 100. El `Float` `amount` queda solo como espejo de compatibilidad y no es la fuente de los totales.

Si la factura llega antes de que exista la suscripción local del customer, se guarda en `PendingStripeInvoice`. Cuando llega la suscripción de ese customer, la misma transacción la promueve a `Invoice` con el `userId` y borra la pendiente. No se descarta en silencio.

### Orden

Una mutación cuyo `event.created` es estrictamente menor que `sourceEventCreated` no pisa la suscripción ni la factura. El evento igual queda `processed`: ignorarlo es el efecto. Una marca de tiempo igual sí puede aplicar.

### MRR

| Condición | Tratamiento |
|---|---|
| `stripeStatus` nulo, o sin importe, ciclo, moneda o `interval_count` | Legacy o precio incompleto. No entra como 0 ni como precio de catálogo |
| `trialing` | Excluido |
| Otro status distinto de `active` | Excluido (`past_due`, `canceled`, `incomplete`, etc.) |
| `active` con intervalo `day` o `week` | Excluido |
| `active` mensual | `roundHalfUp(importe / interval_count)` |
| `active` anual | `roundHalfUp(importe / (12 * interval_count))` |

El redondeo positivo es `(numerador + denominador / 2) / denominador` en enteros menores. ARR es ese mensual por 12, por moneda. Las monedas no se suman.

El exponente sale de la documentación de monedas de Stripe para importes de API, no de “dividir siempre entre 100”:

- Exponente 0: BIF, CLP, DJF, GNF, JPY, KMF, KRW, MGA, PYG, RWF, VND, VUV, XAF, XOF, XPF.
- Exponente 2 aunque sean casos especiales de Stripe: UGX, ISK, HUF y TWD, y el resto de códigos de tres letras.
- Un código que no tiene tres letras no tiene exponente y no se divide.

Churn y trial a pago no se calculan. La API devuelve `null` y la UI dice «No calculado».

## 3. Contrato de lectura

`GET /api/admin/revenue` exige admin. Devuelve `mrrByCurrency`, `arrByCurrency`, `collectedByCurrency`, conteos de exclusión, facturas pendientes y facturas legacy sin `amountMinor`. No devuelve un MRR escalar ni un `totalRevenue` igual al MRR.

`GET /api/admin/stats` y la analítica dejan de sumar el `Float` entre monedas. Un desglose por plan o por fuente solo aparece cuando todas las facturas pagadas comparten moneda y tienen `amountMinor`. Si no, el ingreso por lead y el desglose no se presentan como cero.

`GET /api/billing/invoices` sigue filtrando por el `userId` del JWT. Devuelve `amountMinor` como string. La página de billing usa ese entero y el exponente. Una factura vieja sin `amountMinor` se muestra como histórica, no como cifra verificada.

## 4. Migración

Solo se añade `prisma/migrations/20261028040000_point8c_revenue_projection`.

- Columnas nuevas de `Subscription` e `Invoice`, todas nulables.
- Tablas `StripeWebhookEvent` y `PendingStripeInvoice`.
- No altera `CrmLead`, no añade `organizationId` y no edita migraciones históricas.

Los validadores de tenencia esperan la cadena de cinco migraciones activas. La fase histórica de 8B-1 sigue copiando solo baseline, Slice 0 y 8B-1.

### Preflight antes de un deploy de producción

Este preflight no se ejecutó contra producción. Hace falta una autorización aparte.

1. Confirmar que el único pendiente es `20261028040000_point8c_revenue_projection`.
2. Confirmar que no hay migraciones fallidas ni filas legacy reescritas.
3. Leer, sin escribir, cuántas filas hay en `Subscription` e `Invoice`.
4. Confirmar que las columnas y tablas nuevas todavía no existen.
5. No usar `db push`, `migrate dev`, `migrate resolve` ni SQL manual.

### Rollout

1. `npx prisma migrate deploy` de esta migración aditiva.
2. Desplegar la aplicación que lee las columnas nuevas.
3. Los eventos nuevos de Stripe rellenan la proyección. Las filas viejas siguen fuera del MRR hasta que llegue un evento.

### Rollback

No se edita esta migración ni `_prisma_migrations` a mano.

- La aplicación anterior tolera columnas y tablas extra porque no las lee.
- Quitar el esquema, si hiciera falta, sería otra migración nueva que borra las tablas y columnas añadidas.
- Revertir la aplicación antes de esa migración de rollback deja de escribir la proyección, pero no recupera el MRR de catálogo: ese cálculo ya no está en esta rama.

## 5. Prueba local

`npm run tenancy:validate-point8c` exige `FR004_DATABASE_URL` de un Postgres desechable. No acepta `DATABASE_URL` como respaldo. Rechaza hosts alojados. No llama a la red de Stripe: la firma de prueba usa `generateTestHeaderString` con un secreto local.

Cubre mensual, anual, `interval_count`, redondeo, JPY, monedas separadas, trial, `past_due`, semana, precio desconocido, fila legacy, duplicado, concurrencia, reintento tras un usuario ausente, factura temprana, evento viejo, empate de `event.created`, evento atascado en `processing`, `amount_paid` no entero, checkout sin suscripción recuperada, firma inválida, auth de admin y aislamiento por `userId`.

## 6. Limitaciones

- No hay conciliación en vivo con Stripe ni backfill de filas viejas. Una suscripción anterior a esta proyección no tiene MRR verificable.
- Una factura vieja con solo `amount` Float no entra en el cobrado.
- Los cupones no bajan el MRR.
- `day` y `week` no tienen fórmula de MRR.
- Churn y conversión de trial no están calculados.
- El corte de mes del cobrado admin es UTC.
- `sourceEventCreated` es un entero de 32 bits.
- El ingreso sigue siendo del usuario, no de la organización.
- RLS, RBAC y el CRM no cambian.
- El deploy de producción de esta migración no está autorizado.

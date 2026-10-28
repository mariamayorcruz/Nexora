# Point 8C — Revenue Core: diseño para revisión

Este documento es una revisión de diseño. **No autoriza implementación, migración ni cambios de producción.**

Cada sección marca **Hecho** (lo que el código y los documentos del repositorio muestran hoy) o **Propuesta** (un orden posible para una revisión posterior). Las preguntas abiertas no tienen decisión de negocio.

Base de trabajo: `main` `324e4e9b7f57f740a7869ff86d1006648b54b196`, más la corrección del validador 8B-1 en esta rama. No hay especificación previa de Point 8C en el repositorio. Los documentos 8B solo nombran «Point 8C / RLS / RBAC» como exclusión.

## 1. Estado de Point 8B-6 y del validador 8B-1

**Hecho.** Point 8B-6 en producción está **COMPLETE**.

- `prisma migrate deploy` registró `20261004120000_crmlead_organization_id_not_null`.
- `CrmLead.organizationId` quedó `NOT NULL`. `userId` sigue presente y `NOT NULL`.
- La FK `CrmLead_organizationId_fkey` sigue `ON DELETE RESTRICT`.
- Siguen los índices `(organizationId, updatedAt)`, `(organizationId, stage)` y `(userId)`.
- Antes del registro, la columna ya era `NOT NULL` y faltaba la fila de migración. El deploy autorizado repitió el `SET NOT NULL` versionado y Prisma escribió la fila. Las seis filas legacy documentadas no se modificaron.

**Hecho.** El validador `tenancy:validate-point8b1` era incompatible con ese estado final: desplegaba la cadena completa, exigía `NOT NULL` y después insertaba un `CrmLead` sin `organizationId` esperando `NULL`.

**Hecho, en esta rama.** El validador ahora tiene dos fases sobre Postgres desechable:

1. Copia temporal de migraciones hasta Point 8B-1, sin `20261004120000_crmlead_organization_id_not_null`. Ahí se conservan la nulabilidad, la ausencia de backfill, la FK `RESTRICT` y el `ON DELETE CASCADE` de `userId`.
2. Deploy de `prisma/migrations` real. Ahí `organizationId` debe ser `NOT NULL`, y fallan el insert sin organización y el `SET NULL`.

La carpeta `prisma/migrations` y `prisma/schema.prisma` no se reescriben. No hay cambio de producto. La simulación `--before-point8b1` se mantiene.

## 2. Qué es Revenue Core hoy

**Hecho.** No existe un módulo con ese nombre. El núcleo de ingresos de plataforma que sí está en el código es la suscripción de Nexora cobrada por Stripe y reflejada en tablas locales. Hay otras cifras monetarias que no son ese núcleo.

| Superficie | Qué representa | Límite de tenencia hoy |
|---|---|---|
| `Subscription` | Plan de la cuenta, 1:1 con `User` | `userId`. Sin `organizationId` |
| `Invoice` | Factura Stripe copiada al usuario de la suscripción | `userId`. Sin `organizationId` |
| `LeadCapture.paid` | Marca de funnel admin por email del pagador | Sin organización. No escribe `CrmLead` |
| `PaymentSettings` | Secreto de webhook, PayPal, comisión y payout mínimo | Fila global, no por tenant |
| `Analytics.revenue` | Ingreso atribuido a una campaña publicitaria | `Campaign` → `userId`. Sin `organizationId` |
| `CrmLead.value` | Valor comercial del lead | El lead ya es de `organizationId`; el valor no es MRR |

Fuentes: `prisma/schema.prisma`, `src/lib/billing.ts`, `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/webhook/route.ts`, `src/lib/stripe-funnel-sync.ts`, `src/app/api/billing/invoices/route.ts`, `src/app/api/admin/revenue/route.ts`, `src/app/admin/revenue/page.tsx`, `src/app/dashboard/billing/page.tsx`.

## 3. Fuentes de verdad

**Hecho.**

- El catálogo de planes vive en `src/lib/billing.ts`: `starter`, `professional`, `enterprise`, con precio mensual y anual en unidades mayores (`29` / `79` / `199` y `300` / `790` / `1990`) y price ids de Stripe por entorno, con defaults en código.
- Checkout crea o reutiliza un customer de Stripe y hace `upsert` de `Subscription` por `userId`. El metadata de la sesión lleva `userId`, `plan` y `billingCycle`. Hay un price id fijo de fee de trial en `src/app/api/stripe/checkout/route.ts`.
- El webhook verifica firma con `STRIPE_WEBHOOK_SECRET` o, si falta, con `PaymentSettings.stripeWebhookSecret`.
- `syncSubscriptionRecord` exige `subscription.metadata.userId`. Si no está, no escribe. Mapea el price id al plan y, si no lo reconoce, guarda `starter`. Traduce `active` y `trialing` de Stripe al status local `active`. El resto de status de Stripe se copia tal cual.
- `syncInvoiceRecord` busca `Subscription` por `stripeCustomerId`. Si no hay fila local, **no guarda la factura**. El `upsert` es por `stripeInvoiceId`.
- `GET /api/admin/revenue` no llama a Stripe. Suma suscripciones locales con `status = 'active'` usando otro mapa de precios: `starter 29`, `professional 79`, `enterprise 199`, `scale 199`, `growth 79`. `arr` es `mrr * 12`. `totalRevenue` es el mismo MRR, no la suma de facturas. `churnRate` y `trialToPaid` están fijos en `0`.
- La página admin dice que los datos se calculan desde Stripe. El route que consume no lo hace.
- `GET /api/billing/invoices` lista hasta 50 facturas del `userId` del JWT. No lee el header de organización.
- La página `/dashboard/billing` envía headers de tenant a `/api/users/me` y a `/api/billing/invoices`, pero el route de facturas ignora ese header.
- `GET /api/admin/subscriptions` lista todas las suscripciones con email y nombre. Es global y de admin.

**Propuesta, no decidida.** Tratar a Stripe como fuente de los importes cobrados y del ciclo, y a las tablas locales como proyección. El catálogo de `billing.ts` seguiría siendo la fuente de los planes que el producto ofrece, no del dinero ya cobrado. Hace falta una decisión explícita antes de cambiar el MRR admin.

## 4. Flujo de ingresos

**Hecho.**

1. El usuario autenticado pide checkout con plan y ciclo.
2. Stripe cobra. El webhook recibe `checkout.session.completed`, `customer.subscription.created|updated|deleted` o `invoice.payment_succeeded|payment_failed|finalized`.
3. La suscripción local se crea o se actualiza por `userId`.
4. Si el status de Stripe es `active` o `trialing`, `syncPaidLeadCapturesForAdmin` marca `LeadCapture.paid = true` en filas cuyo email coincide con el del usuario, y escribe `convertedToPaidAt` solo si estaba vacío.
5. `onPayingSubscriptionSynced` escribe `User.onboardingStartedAt` la primera vez que ve un status de pago.
6. La factura local se escribe solo si ya existe una suscripción con ese customer.

No hay tabla de eventos de Stripe. El route no guarda `event.id`.

## 5. Reconciliación e idempotencia

**Hecho.**

- Repetir un webhook de suscripción vuelve a hacer `upsert` por `userId`. No crea una segunda suscripción: `userId` es único.
- Repetir un webhook de factura vuelve a hacer `upsert` por `stripeInvoiceId`.
- `convertedToPaidAt` no se pisa gracias a `COALESCE`. `paid` pasa a `true` y el código actual no lo devuelve a `false` si la suscripción deja de estar pagada: la función sale antes.
- Una factura que llega antes que la suscripción local se descarta.
- Un price id desconocido se guarda como plan `starter` y el MRR admin le asigna 29 si el status local es `active`.
- Una suscripción anual local sigue sumando el precio mensual del mapa admin, porque ese mapa no distingue ciclo. El modelo `Subscription` tampoco guarda el ciclo.
- `trialing` de Stripe queda como `active` local, así que entra en el MRR admin igual que una suscripción cobrada.
- `totalRevenue`, `churnRate` y `trialToPaid` no se reconcilian con facturas ni con bajas.

**Propuesta, no decidida.** Una reconciliación mínima, antes de cualquier cambio de tenencia, sería de solo lectura y desechable:

- contar suscripciones `active` cuyo plan no está en `billing.ts`;
- contar facturas `paid` cuya suma no puede compararse con el MRR del catálogo, y mostrar por qué (ciclo ausente, `amount_paid` frente a precio de lista);
- contar eventos de webhook que hoy se perderían si la suscripción aún no existe.

Eso no escribe producción. No está implementado en esta rama.

## 6. Aislamiento `organizationId`

**Hecho.** El corte de lectura y escritura por `organizationId` existe en CRM (`CrmLead`). No existe en `Subscription`, `Invoice`, `PaymentSettings` ni `LeadCapture`. La membresía y la organización existen desde Point 7 / 8B, y el CRM ya exige `organizationId` no nulo.

La UI de billing ya tiene organización seleccionada. La API de facturas sigue autorizando solo al usuario del JWT.

**Propuesta, no decidida.** No añadir `organizationId` a tablas de ingreso en el primer corte de 8C. El modelo actual es una suscripción por usuario, no por organización. Copiar el patrón de `CrmLead` implicaría elegir si el pagador es el usuario o la organización, qué pasa con varias membresías y si una factura histórica sin organización puede volverse `NOT NULL`. Esas decisiones no están en el repositorio.

## 7. Contratos y datos monetarios

**Hecho.**

- `Invoice.amount`, `Analytics.revenue`, `Analytics.spend`, `CrmLead.value`, `Campaign.budget`, `PaymentSettings.commissionRate` y `PaymentSettings.minimumPayout` son `Float`.
- El webhook guarda `invoice.amount_paid / 100`. No guarda `amount_due`, descuentos ni el fee de trial como línea propia.
- La moneda de la factura pasa a mayúsculas. El default del esquema es `USD`.
- Los precios de lista y el MRR admin están en unidades mayores, no en centavos.
- No hay un tipo dinero compartido ni redondeo explícito.

**Propuesta, no decidida.** No cambiar `Float` a entero en esta fase de diseño. Si más adelante se aprueba, sería una migración propia, con backfill revisado y sin mezclarla con tenencia.

## 8. Alcance y exclusiones

**Propuesta de alcance para una implementación futura, sujeta a aprobación.** Reconciliar la proyección local de suscripción y factura con Stripe, y hacer que las cifras admin dejen de contradecir el catálogo, sin mover el límite de tenant.

**Hecho como exclusiones ya escritas en 8B, y que este diseño mantiene.**

- RLS y políticas de Supabase. Siguen fuera de Prisma. Ver `docs/database/fr-004-migration-integrity-runbook.md`.
- RBAC granular. Point 30. El comentario de `resolve-crm-write-organization.ts` lo deja así.
- Borrar `userId`.
- Migrar `Campaign`, `LeadCapture`, `AdAccount` o `TenantAutomationConfig` a `organizationId`.
- Renombrar Company / Contact, conversaciones, Point 9 o Cleaning Pack.

**Propuesta de exclusión adicional hasta una decisión aparte.**

- No tratar `Analytics.revenue` ni `CrmLead.value` como MRR.
- No cambiar el match por email de `LeadCapture.paid`.
- No desplegar nada a producción dentro de 8C-diseño.

## 9. Secuencia incremental

**Propuesta.** Cada paso necesita su propia autorización. Esta rama solo entrega el paso 0.

| Paso | Contenido | Escritura |
|---|---|---|
| 0 | Este diseño y la corrección del validador 8B-1 | Ninguna en producción |
| 1 | Inventario de solo lectura de las contradicciones de la sección 5, en Postgres desechable | No |
| 2 | Definir, por escrito, la fórmula de MRR/ARR y si `trialing` cuenta | No |
| 3 | Si se aprueba, ajustar la lectura admin para usar esa fórmula sin nueva tabla | Código de lectura, sin DDL |
| 4 | Si se aprueba, guardar `event.id` o dejar de descartar facturas que llegan antes de la suscripción | Migración nueva y autorizada aparte |
| 5 | Tenencia de ingresos por organización, solo si la decisión abierta 6 tiene respuesta | Fuera de este diseño hasta una revisión nueva |

## 10. Riesgos y decisiones abiertas

**Hecho, riesgos visibles en el código actual.**

- El MRR admin puede contar un trial como ingreso de lista mensual.
- Una suscripción anual se valora como un mes.
- `totalRevenue` no es dinero cobrado.
- Una factura temprana se pierde.
- Dos mapas de nombres de plan (`professional` en billing, `growth` / `scale` en el route admin) no coinciden con el comentario del esquema (`pro`).
- El webhook puede leer el secreto desde la base si falta la variable de entorno.
- Marcar `LeadCapture.paid` por email puede tocar varias capturas del mismo email.

**Decisiones abiertas. No resueltas aquí.**

1. ¿El MRR sale del catálogo, de los ítems de Stripe o de las facturas pagadas?
2. ¿`trialing` cuenta como MRR?
3. ¿El ciclo anual debe guardarse en `Subscription`?
4. ¿La factura que llega antes que la suscripción se reintenta, se encola o se sigue descartando?
5. ¿Hace falta idempotencia por `event.id`, o basta el `upsert` actual?
6. ¿El ingreso de plataforma sigue siendo del `User` o pasa a `Organization`?
7. ¿`LeadCapture.paid` entra en Revenue Core o se queda en el funnel admin?
8. ¿Los importes pasan a unidades menores enteras o se documenta el `Float` actual como contrato?

## 11. Criterios de aceptación propuestos

Para una implementación futura, no para esta rama:

- Ningún route de lectura de ingresos usa el secreto de producción en pruebas.
- El MRR admin usa una fórmula escrita y unos fixtures desechables que cubren mensual, anual, trial y plan desconocido.
- Repetir el mismo webhook de suscripción y de factura no duplica filas.
- Una factura sin suscripción local tiene un comportamiento definido y probado.
- `userId` de `Subscription` e `Invoice` sigue presente.
- No aparece RLS ni RBAC de Point 30.
- `npx prisma validate`, `npx tsc --noEmit` y los validadores de tenencia ya verdes siguen verdes.
- Cualquier DDL nuevo tiene migración versionada, validador desechable y autorización de producción separada.

## 12. Plan de pruebas y migración

**Hecho en esta rama.** No hay migración 8C. Las pruebas son las del validador 8B-1 corregido, `tenancy:validate-point8b6` y las regresiones de tenencia ya existentes, contra Postgres local. `DATABASE_URL` de producción no entra en ese proceso.

**Propuesta.** Si un paso futuro añade columnas o una tabla de eventos:

- migración nueva bajo `prisma/migrations`, sin editar las cuatro actuales;
- validador desechable que rehúsa hosts alojados;
- `prisma migrate deploy` de producción solo con autorización explícita, después de un preflight de solo lectura;
- prohibido `db push`, `migrate dev` contra producción y SQL manual.

No hay CI en `.github/`. Los validadores se ejecutan a mano con `FR004_DATABASE_URL` local.

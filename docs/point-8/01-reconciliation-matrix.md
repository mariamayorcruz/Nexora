# Point 8 — matriz de reconciliación

Inventario leído en `main` `b35b3a21afa48005eb49a2f7231e455eeeef35b6`. No describe el código del PR 18 como si ya estuviera integrado. Ese draft se resume en `03-stages-diagrams-decisions.md`.

Los nombres de concepto son orientativos. La disposición no crea una tabla por nombre.

Leyenda:

- **Hecho:** está en Prisma, migraciones, servicios, rutas, UI o pruebas de este `main`.
- **Propuesta:** diseño de este paquete. No está aceptada.
- **Decisión vigente:** solo lo que un documento o instrucción ya congeló. Las recomendaciones nuevas no cuentan.
- **Disposición:** `reutilizar`, `extender`, `crear`, `diferir` o `no aplica`. `diferir` y `no aplica` quedan como propuesta y exigen aprobación humana. Ninguna está aprobada aquí.
- **Registro:** estado del concepto Point 8. Una tabla ya desplegada no cierra el concepto si el alcance de la lista sigue abierto.

Modelos Prisma en este `main`: `User`, `Organization`, `Membership`, `Subscription`, `AdAccount`, `Campaign`, `Analytics`, `Invoice`, `CrmLead`, `CrmWorkspaceSettings`, `TenantAutomationConfig`, `AiWorkspaceUsage`, `AiWorkspaceJob`, `AiVideoProject`, `AiVideoProjectVersion`, `AiVideoAsset`, `LeadCapture`, `VerificationToken`, `PaymentSettings`, `ConnectionRequest`, `AdminWorkspaceConfig`, `AttributionSession`, `AttributionEvent`. Fuente: `prisma/schema.prisma`.

## concepto: organizations

- **Hecho.** `model Organization` con `id`, `name`, `slug` único, `status` (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`). Migración `prisma/migrations/20260918020000_add_organization_membership/migration.sql`. El comentario del modelo dice que es el límite de tenant futuro y que la autorización por organización todavía no se aplica a todo el producto.
- **Hecho.** `resolveTenantContext` en `src/lib/tenancy/tenant-context.ts` exige membresía y organización activas. El header es `x-nexora-organization-id`. El JWT solo lleva `userId`.
- **Cobertura.** El tenant existe. Campañas, facturación, automatización e IA siguen en `userId`. Solo `CrmLead.organizationId` es obligatorio.
- **Duplicados.** No hay otra tabla de tenant. `TenantAutomationConfig` está mapeada a `tenant_automation_configs` pero cuelga de `userId`, no de `Organization`.
- **Disposición.** Reutilizar `Organization` como tenant. No usarla como empresa cliente.
- **Relaciones.** 1 organización : N `Membership`. 1 organización : N `CrmLead` (`ON DELETE RESTRICT`).
- **Ámbito y acceso.** Raíz de tenant. No hay RLS de Prisma sobre `Organization`. `middleware.ts` no autoriza; solo redirige tracking.
- **Riesgo.** Tratar el tenant como la empresa del cliente final.
- **Dependencia.** El resto de conceptos de tenant dependen de esta fila.
- **Etapa y aceptación.** La fundación Point 7 está integrada. El concepto Point 8 no acepta todavía qué más cuelga del tenant.
- **Registro.** `pendiente decisión`.

## concepto: users

- **Hecho.** `model User`: email único, password, perfil, nurture, onboarding y relaciones 1:1 o 1:N con suscripción, campañas, CRM, IA y facturas. Alta en `src/app/api/auth/register/route.ts` y `src/app/api/auth/login/route.ts`. Identidad del JWT: `getUserIdFromAuthorizationHeader` vía `src/lib/jwt.ts`, usado por `resolveTenantContext`.
- **Decisión vigente.** Este prompt prohíbe borrar `userId`. `CrmLead.userId` sigue como actor (`docs/point-8b6-crmlead-org-not-null.md`).
- **Cobertura.** Cuenta de acceso humana. No hay ficha laboral.
- **Duplicados.** No hay segundo modelo de login. `LeadCapture.userId` es opcional y no es la cuenta.
- **Disposición.** Reutilizar `User` como identidad de acceso. No equipararlo a empleado.
- **Relaciones.** 1 usuario : N `Membership`. 1 usuario : 0..1 `Subscription`.
- **Ámbito y acceso.** Identidad global. El acceso a datos de negocio no se deduce solo del usuario: CRM de leads usa organización; muchas rutas siguen filtrando por `userId`.
- **Riesgo.** Crear empleados copiando `User`, o borrar `userId` al pasar todo a la organización.
- **Registro.** `pendiente decisión` para el papel completo dentro de Point 8. La tabla ya está desplegada como cuenta.

## concepto: organization_members

- **Hecho.** `model Membership`: par único `(organizationId, userId)`, `role` y `status`. Borrado en cascada desde `Organization` y desde `User`. Índices `(userId, status)` y `(organizationId, status)`.
- **Hecho.** `src/lib/tenancy/ensure-user-organization.ts` y el backfill de Point 7 crean la membresía legacy. La UI de selección está en `src/components/TenantOrganizationProvider.tsx` y `GET /api/tenant/organizations`.
- **Cobertura.** Pertenencia sí. Invitación `INVITED` existe en el enum y no hay flujo de invitación revisado en estas rutas.
- **Disposición.** Reutilizar `Membership`. No crear `organization_members`.
- **Relaciones.** N:M entre `User` y `Organization`.
- **Ámbito y acceso.** Por tenant. `resolveTenantContext` rechaza membresía inactiva.
- **Riesgo.** Interpretar `MEMBER` como un permiso fino.
- **Registro.** `pendiente decisión` sobre invitaciones y baja. La tabla de pertenencia ya existe.

## concepto: roles

- **Hecho.** `enum MembershipRole`: `OWNER`, `ADMIN`, `MEMBER`. No hay modelo `Role`.
- **Hecho.** El admin de plataforma no sale de ese enum. `verifyAdmin` en `src/lib/admin.ts` usa `isAdminEmail` e `isFounderEmail` de `src/lib/access.ts`. La lista por defecto es un correo concreto en código, ampliable con `ADMIN_EMAILS` y `FOUNDER_EMAILS`.
- **Decisión vigente.** 8B excluyó RBAC. Este prompt prohíbe implementarlo por inferencia.
- **Cobertura.** Tres etiquetas de membresía y un admin global por correo. No hay roles de negocio (ventas, operaciones, solo lectura).
- **Disposición.** Extender, cuando haya decisión, sin reemplazar el enum a ciegas. Propuesta no aprobada: no abrir una tabla `Role` hasta fijar la lista.
- **Relaciones.** N membresías : 1 valor del enum. El admin de plataforma no es una fila.
- **Ámbito.** El enum es de tenant. El correo admin es global.
- **Riesgo.** Inventar roles o tratar `ADMIN` de membresía como admin de toda la plataforma.
- **Pregunta.** Q2 en el documento de etapas.
- **Registro.** `pendiente decisión`.

## concepto: permissions

- **Hecho.** No hay modelo `Permission` ni comprobación de `Membership.role` en las rutas CRM leídas para esta matriz. `src/lib/entitlements.ts` describe topes del plan de pago (`PlanCapabilities`), no permisos de una persona.
- **Cobertura.** Brecha total de autorización fina. Los límites de plan no son permisos.
- **Disposición.** Crear solo después de una lista aceptada. Propuesta no aprobada: no sembrar permisos de ejemplo.
- **Relaciones propuestas.** N permisos por rol de membresía, evaluados junto al tenant. Sin cardinalidad cerrada.
- **Ámbito.** Tenant, con una excepción ya existente: admin de plataforma por correo.
- **Riesgo.** Codificar la matriz en la aplicación y llamar a eso RBAC.
- **Dependencia.** Roles, auditoría y RLS quedan descritos y fuera de esta etapa.
- **Registro.** `pendiente decisión`.

## concepto: contacts

- **Hecho.** No hay `Contact`. La persona comercial está en `CrmLead` (`name`, `email`, `phone`) y, antes del CRM, en `LeadCapture`.
- **Hecho.** `LeadCapture` puede señalar `crmLeadId` y no es el contacto permanente. El funnel admin marca `paid` por email y el comentario del esquema dice que no asigna el CRM a otro tenant.
- **Disposición.** Propuesta no aprobada: crear `Contact` distinto de `CrmLead` y de `User`. No renombrar el lead.
- **Relaciones propuestas.** 1 contacto : N leads u oportunidades, dentro de un tenant. Un contacto no es un login.
- **Ámbito.** Tenant. Hoy el lead se lee por `organizationId` en `src/app/api/crm/leads/route.ts`.
- **Riesgo.** Llamar contacto al lead y perder la captura de marketing.
- **Registro.** `pendiente decisión`.

## concepto: companies

- **Hecho.** `CrmLead.company` es un `String?`. No hay modelo `Company`.
- **Decisión vigente.** `Organization` es el tenant, no la empresa del cliente. Point 7 Slice 0 y el comentario en `Organization`.
- **Disposición.** Propuesta no aprobada: crear `Company` del cliente final,  N por tenant. No copiar `Organization`.
- **Relaciones propuestas.** 1 tenant : N empresas cliente. 1 empresa : N contactos y oportunidades. El string actual sería backfill solo con reglas aceptadas; hoy no hay regla de unicidad.
- **Riesgo.** Unicidad falsa por nombre libre, y mezclar tenant con cliente.
- **Registro.** `pendiente decisión`.

## concepto: locations

- **Hecho.** No hay modelo de sede. `Campaign.targeting` es `Json?` de anuncios, no una ubicación operativa. `websiteUrl` en `ConnectionRequest` es un texto de alta.
- **Disposición.** Crear, si el producto operativo lo exige. Propuesta no aprobada: no deducir sedes desde targeting.
- **Relaciones propuestas.** 1 empresa cliente : N sedes. Sin empresa, la sede no tiene dueño de negocio.
- **Ámbito.** Tenant.
- **Registro.** `pendiente decisión`.

## concepto: employees

- **Hecho.** No hay modelo de empleado. `User` es la cuenta. `Membership` es la pertenencia al tenant.
- **Disposición.** Crear solo si se acepta un dominio laboral. Propuesta no aprobada: no añadir columnas de empleado a `User`.
- **Relaciones propuestas.** 0..1 empleado : 0..1 `User`. Un empleado puede no tener login. Un usuario puede no ser empleado.
- **Riesgo.** Borrar o sobrecargar `User`.
- **Registro.** `pendiente decisión`.

## concepto: channels

- **Hecho.** No hay catálogo `Channel`. Canales aparecen como strings: `AdAccount.platform`, el body `channel` de `src/app/api/crm/leads/[leadId]/message/route.ts` (`sms`, `whatsapp`), banderas de `CrmWorkspaceSettings` y `TenantAutomationConfig`, y el filtro de UI `ConversationFilter` en `src/app/dashboard/conversaciones/page.tsx`.
- **Disposición.** Propuesta no aprobada: un canal conectado del tenant, distinto de la credencial y distinto del hilo.
- **Relaciones propuestas.** 1 integración : N canales direccionables. 1 conversación : 1 canal.
- **Registro.** `pendiente decisión`.

## concepto: conversations

- **Hecho.** No hay tabla. `src/app/dashboard/conversaciones/page.tsx` carga leads y `buildMessages` fabrica tres burbujas con `notes`, un texto fijo de IA y `nextAction`. No es un hilo guardado.
- **Disposición.** Crear un hilo por contacto o lead y canal. Propuesta no aprobada. No tratar la página como persistencia.
- **Relaciones propuestas.** 1 lead o contacto : N conversaciones. 1 conversación : N mensajes.
- **Ámbito.** Tenant, el mismo de `CrmLead`.
- **Riesgo.** Mostrar historial que el servidor no guardó.
- **Registro.** `pendiente decisión`.

## concepto: messages

- **Hecho.** No hay tabla. `POST /api/crm/leads/[leadId]/message` envía SMS o WhatsApp por Twilio si hay teléfono y secreto de entorno, y en todos los casos concatena el texto en `CrmLead.notes` y toca `lastContactedAt`. El `where` incluye `organizationId`.
- **Disposición.** Crear `Message` append-only. Propuesta no aprobada: dejar de usar `notes` como buzón. El backfill del texto ya concatenado no tiene formato garantizado.
- **Relaciones propuestas.** N mensajes : 1 conversación. El envío externo no es la fila.
- **Ámbito.** Tenant.
- **Registro.** `pendiente decisión`.

## concepto: pipelines

- **Hecho.** No hay modelo. `src/app/dashboard/pipeline/page.tsx` redirige a `/dashboard/crm`. El tablero usa `CrmLead.stage`.
- **Disposición.** Propuesta no aprobada: 1..N pipelines por tenant. El producto de hoy se comporta como un solo embudo.
- **Relaciones propuestas.** 1 pipeline : N etapas. 1 oportunidad : 1 etapa de un pipeline.
- **Registro.** `pendiente decisión`.

## concepto: pipeline_stages

- **Hecho.** No hay tabla de etapas. `SalesStage` y `CRM_ALLOWED_STAGES` en `src/lib/sales-playbook.ts` fijan `lead`, `contacted`, `qualified`, `proposal`, `won`. `CrmLead.stage` default `lead`. Las rutas CRM rechazan otras cadenas porque el set sale de esa constante.
- **Disposición.** Extender a filas solo si se acepta que esas cinco cadenas dejan de ser la lista cerrada, o se acepta copiarlas como semilla. Esa copia no está aprobada: sería inventar la lista de negocio a partir de un constante de código.
- **Relaciones.** Hoy N leads : 1 string. Propuesta: N etapas : 1 pipeline, orden explícito.
- **Registro.** `pendiente decisión`.

## concepto: opportunities

- **Hecho.** No hay modelo. `src/app/dashboard/opportunities/page.tsx` redirige a `/dashboard/crm`. `CrmLead.value` (Float, default 0) y `confidence` son campos del lead, no una oportunidad con ciclo propio. `Analytics.revenue` es métrica de campaña.
- **Disposición.** Propuesta no aprobada: crear oportunidad separada del lead cuando un contacto puede tener varios tratos. Hasta esa decisión, no renombrar `value` a MRR ni a ingreso cobrado.
- **Relaciones propuestas.** 1 lead o contacto : N oportunidades. 1 oportunidad : 1 etapa.
- **Registro.** `pendiente decisión`.

## concepto: activities

- **Hecho.** No hay modelo. `CrmLead.lastContactedAt` es un instante. El mensaje nuevo se pierde dentro de `notes`.
- **Disposición.** Crear actividad append-only (llamada, nota, cambio de etapa) distinta del mensaje de canal. Propuesta no aprobada.
- **Relaciones propuestas.** N actividades : 1 lead u oportunidad. Actor = `User` cuando hay login.
- **Registro.** `pendiente decisión`.

## concepto: tasks

- **Hecho.** No hay modelo. `CrmLead.nextAction` es un string. `computeNextBestActions` en `src/lib/next-best-action.ts` calcula sugerencias en memoria y no las guarda. `src/app/api/crm/followups/route.ts` envía correo; no abre una tarea.
- **Disposición.** Crear tarea con estado y vencimiento solo si se acepta que `nextAction` no basta. Propuesta no aprobada.
- **Relaciones propuestas.** N tareas : 1 oportunidad o lead. Asignado opcional a un `User` del tenant, no a un empleado inexistente.
- **Registro.** `pendiente decisión`.

## concepto: documents

- **Hecho.** No hay modelo de documento de negocio. El PDF de auditoría se genera al vuelo en `src/lib/pdf/generateAuditPdf.ts` y se adjunta al correo en el route de followups. No queda una fila.
- **Disposición.** Crear documento de negocio, distinto del asset de video. Propuesta no aprobada.
- **Relaciones propuestas.** 1 documento : N versiones. Puede colgar de oportunidad, contrato o inspección cuando esos existan.
- **Ámbito.** Tenant.
- **Registro.** `pendiente decisión`.

## concepto: document_versions

- **Hecho.** No hay versiones de documento. `AiVideoProjectVersion` versiona el JSON de un proyecto de video (`@@unique([projectId, version])`), no un contrato ni un PDF.
- **Disposición.** Crear versiones inmutables del documento de negocio. Reutilizar el patrón de versión monotónica, no la tabla de video.
- **Registro.** `pendiente decisión`.

## concepto: document_chunks

- **Hecho.** No hay chunks ni índice de recuperación.
- **Disposición.** Propuesta no aprobada: una sola tabla de chunks compartida con conocimiento, discriminada por tipo de fuente. No crear dos almacenamientos de vectores.
- **Relaciones propuestas.** N chunks : 1 versión de documento. El chunk apunta a la versión, no al documento mutable.
- **Registro.** `pendiente decisión`.

## concepto: contracts

- **Hecho.** No hay modelo. `Subscription` es el plan de Nexora cobrado al `User`, no un contrato con cláusulas. `Invoice` es la factura de esa suscripción.
- **Decisión vigente de implementación futura.** No mover la facturación a `Organization` y no borrar `userId`. Eso no convierte la suscripción en contrato.
- **Disposición.** Crear contrato de cliente solo con estados aceptados. Propuesta no aprobada: no derivar el contrato del `status` de Stripe.
- **Registro.** `pendiente decisión`.

## concepto: contract_clauses

- **Hecho.** No hay cláusulas. El precio de catálogo está en `src/lib/billing.ts`, no en filas por cliente.
- **Disposición.** Crear cláusulas versionadas con el contrato. Propuesta no aprobada. La lista de cláusulas es una decisión de negocio ausente.
- **Registro.** `pendiente decisión`.

## concepto: contract_obligations

- **Hecho.** No hay obligaciones. `CrmLead.nextAction` y los followups no son una obligación contractual.
- **Disposición.** Crear obligación ligada a una versión de contrato. Propuesta no aprobada. Sin calendario de cumplimiento decidido.
- **Registro.** `pendiente decisión`.

## concepto: knowledge_sources

- **Hecho.** No hay fuente de conocimiento persistida. El asistente de `src/app/api/support/assistant/route.ts` arma un mensaje con la página actual y llama a un proveedor. No guarda la fuente.
- **Disposición.** Crear fuente (archivo, URL o texto) por tenant, más una clase global de producto si se acepta. Propuesta no aprobada.
- **Registro.** `pendiente decisión`.

## concepto: knowledge_chunks

- **Hecho.** No hay chunks de conocimiento.
- **Disposición.** Misma tabla compartida que `document_chunks`, con `sourceKind`. Propuesta no aprobada.
- **Registro.** `pendiente decisión`.

## concepto: company_rules

- **Hecho.** No hay reglas por empresa cliente. Lo más cercano son textos de tenant-por-usuario en `TenantAutomationConfig` (`qualificationPrompt`, `aiTone`, acciones hot/warm/cold) y el JSON de `CrmWorkspaceSettings.defaultCadence`, que puede guardar `salesEngine` (`src/lib/crm-sequences.ts`).
- **Disposición.** Crear reglas versionadas por tenant, no por el string `CrmLead.company`. Propuesta no aprobada. No promover esos prompts a reglamento sin decisión.
- **Registro.** `pendiente decisión`.

## concepto: playbooks

- **Hecho.** `StagePlaybook` y `PLAYBOOK` en `src/lib/sales-playbook.ts` son constantes de código para las cinco etapas. `getPlaybook` cae a `lead` si la cadena no coincide. No hay filas ni playbooks por tenant.
- **Disposición.** Reutilizar el constante como comportamiento actual. Extenderlo a datos solo si se acepta personalización. Propuesta no aprobada.
- **Relaciones.** Hoy 1 etapa de código : 1 guía. No es 1 empresa : N playbooks.
- **Registro.** `pendiente decisión`.

## concepto: alerts

- **Hecho.** `buildAdminAlerts` en `src/lib/admin-ops.ts` calcula avisos de admin (cobros abiertos, suscripciones por vencer, campañas) y no los persiste. No hay modelo `Alert`.
- **Disposición.** Crear alerta persistida solo si debe reconocerse, asignarse o sobrevivir al refresh. Propuesta no aprobada: los avisos de admin pueden seguir calculándose.
- **Ámbito.** Los avisos actuales son globales de admin, no del tenant.
- **Registro.** `pendiente decisión`.

## concepto: insights

- **Hecho.** No hay modelo. `computeNextBestActions` calcula urgencia en memoria. `Analytics` guarda métricas de campaña (`impressions`, `clicks`, `revenue` Float). El radar de tendencias es otra superficie (`src/lib/trends.ts`, `GET /api/trends/radar`) y no es un insight de CRM.
- **Disposición.** Crear insight solo si el resultado debe quedar citado y revisable. Propuesta no aprobada: no guardar cada sugerencia de pantalla.
- **Registro.** `pendiente decisión`.

## concepto: incidents

- **Hecho.** No hay modelo de incidente operativo. No confundir con `status` de suscripción o con el error HTTP de una ruta.
- **Disposición.** Crear incidente genérico distinto de `equipment_incidents` si se acepta el dominio. Propuesta no aprobada. 8B-1 dejó Cleaning Pack fuera de aquel corte; eso no acepta diferir este concepto.
- **Registro.** `pendiente decisión`.

## concepto: equipment

- **Hecho.** No hay modelo, ruta ni prueba. Búsqueda de esquema sin `Equipment`.
- **Disposición.** Crear si el dominio físico entra en Point 8. Propuesta de diferir: no está aprobada. Hace falta la pregunta Q6.
- **Relaciones propuestas.** 1 sede o empresa : N equipos. 1 equipo : N incidentes de equipo.
- **Registro.** `pendiente decisión`.

## concepto: equipment_incidents

- **Hecho.** No hay modelo.
- **Disposición.** Crear como hecho sobre un equipo, no reutilizar un incidente genérico sin decisión. Propuesta no aprobada.
- **Registro.** `pendiente decisión`.

## concepto: supplies

- **Hecho.** No hay modelo de insumo.
- **Disposición.** Crear catálogo de insumo distinto del nivel. Propuesta no aprobada. Misma pregunta de dominio físico que equipment.
- **Registro.** `pendiente decisión`.

## concepto: supply_levels

- **Hecho.** No hay existencias.
- **Disposición.** Crear saldo o movimiento por sede e insumo. Propuesta no aprobada: no guardar un entero suelto sin movimiento si se exige auditoría. La forma exacta está bloqueada.
- **Registro.** `pendiente decisión`.

## concepto: inspections

- **Hecho.** No hay inspección operativa. `src/lib/audit-flow.ts` arma textos y enlaces del lead magnet «auditoría»; no es una corrida con respuestas.
- **Disposición.** Crear el agregado de inspección (plantilla, snapshot, corrida, respuestas). Propuesta no aprobada. No reutilizar el PDF comercial.
- **Registro.** `pendiente decisión`.

## concepto: inspection_templates

- **Hecho.** No hay plantilla persistida.
- **Disposición.** Crear definición editable. Propuesta no aprobada.
- **Registro.** `pendiente decisión`.

## concepto: inspection_runs

- **Hecho.** No hay corrida.
- **Disposición.** Crear corrida que copie un snapshot de la plantilla. Propuesta no aprobada. Editar la plantilla no reescribe corridas cerradas.
- **Registro.** `pendiente decisión`.

## concepto: inspection_items

- **Hecho.** No hay ítems ni respuestas.
- **Disposición.** Crear ítems de plantilla e ítems respondidos en la corrida como filas distintas. Propuesta no aprobada. Una sola tabla mezclaría definición y respuesta.
- **Registro.** `pendiente decisión`.

## concepto: attachments

- **Hecho.** No hay tabla. El PDF de followup vive en el correo. `AiVideoAsset` guarda `url`, `storageKey` y `mimeType` de video por `userId`. `uploadVideoToSupabase` en `src/lib/storage.ts` escribe `{userId}/{timestamp}-{fileName}` en el bucket `nexora-videos` si hay configuración.
- **Disposición.** Crear un adjunto polimórfico por tenant. Propuesta no aprobada: no duplicar esa tabla para cada dominio. El asset de video puede seguir hasta una etapa de unificación.
- **Registro.** `pendiente decisión`.

## concepto: photos

- **Hecho.** No hay modelo `Photo`. No hay subida de foto de inspección. Los estáticos de marketing no son fotos de negocio.
- **Disposición.** Propuesta no aprobada: una foto es un adjunto con tipo, no una tabla propia. Eso no es `no aplica` aprobado; el concepto sigue en la lista y se cumple con el adjunto.
- **Registro.** `pendiente decisión`.

## concepto: workflows

- **Hecho.** No hay definición persistida de workflow. Hay automatización por usuario: `TenantAutomationConfig.automationActive`, `n8nWebhookUrl`, acciones por temperatura, y páginas `src/app/dashboard/automations/page.tsx` y `src/app/dashboard/automatizaciones/page.tsx`. `src/lib/video-pipeline.ts` es un pipeline de render local, no un workflow de negocio.
- **Disposición.** Crear definición de workflow del tenant. Propuesta no aprobada: no llamar workflow a la fila de automatización ni al render de video.
- **Registro.** `pendiente decisión`.

## concepto: workflow_versions

- **Hecho.** No hay versión de workflow. Cambiar `TenantAutomationConfig` pisa la fila (`updatedAt`).
- **Disposición.** Crear versión inmutable publicada. Propuesta no aprobada. La corrida apunta a la versión, no a la definición editable.
- **Registro.** `pendiente decisión`.

## concepto: workflow_runs

- **Hecho.** No hay corrida. Un POST a n8n o un cron (`src/app/api/cron/sales-recovery-followup/route.ts`) no deja una ejecución consultable.
- **Disposición.** Crear corrida. Propuesta no aprobada. No usar `AiWorkspaceJob` como corrida de workflow.
- **Registro.** `pendiente decisión`.

## concepto: workflow_steps

- **Hecho.** No hay pasos persistidos. `DEFAULT_FOLLOWUP_TEMPLATES` en `src/lib/crm-sales-engine-defaults.ts` es código, y una copia puede vivir dentro del JSON de cadence.
- **Disposición.** Crear pasos de la versión y pasos de la corrida por separado. Propuesta no aprobada.
- **Registro.** `pendiente decisión`.

## concepto: integrations

- **Hecho.** Conexiones reales, sin modelo `Integration`: `AdAccount` (plataforma, `accountId`, `connected`), `ConnectionRequest`, `TenantAutomationConfig` (WhatsApp, Meta, OpenPhone, Instagram, n8n), OAuth en `src/app/api/connect/oauth/start/route.ts` y provision `src/app/api/v1/integrations/gotnexora/provision/route.ts`. UI: `src/app/dashboard/integraciones/page.tsx` y `src/app/dashboard/connect/page.tsx`.
- **Disposición.** Propuesta no aprobada: una integración por tenant y proveedor, y migrar estas tablas solo en una etapa posterior. Hasta entonces se reutilizan las tablas actuales.
- **Relaciones.** Hoy cuelgan de `User`, no de `Organization`.
- **Registro.** `pendiente decisión`.

## concepto: integration_credentials

- **Hecho.** Secretos en columnas: `AdAccount.accessToken` y `refreshToken`; `TenantAutomationConfig.whatsappAccessToken`, `metaAdsToken`, `openPhoneApiKey`; `PaymentSettings.stripeWebhookSecret`. No hay tabla de credencial ni referencia a un almacén externo.
- **Hecho.** RLS de Supabase solo en `supabase/migrations/20260605121000_tenant_automation_config_rls.sql`, comparando `auth.uid()::text` con `user_id`. Prisma identifica al usuario con `cuid()`, no con ese `auth.uid()`. El runbook `docs/database/fr-004-migration-integrity-runbook.md` separa ese historial del de Prisma.
- **Disposición.** Crear credencial que no copie el texto del secreto a nuevas columnas. Propuesta no aprobada. Rotar lo ya guardado es otra etapa y otra decisión.
- **Registro.** `pendiente decisión`.

## concepto: webhook_events

- **Hecho en main.** No hay tabla de evento de webhook. `src/app/api/stripe/webhook/route.ts` verifica firma y aplica suscripción o factura. `docs/point-8c-revenue-core-design.md` en este `main` dice que no se guarda `event.id`. `POST /api/webhooks/meta-leads` recibe leads de Meta. `AttributionEvent` es analítica de navegación, no un webhook.
- **Hecho fuera de main.** El PR 18 draft añade `StripeWebhookEvent` y `PendingStripeInvoice` en el commit `60c1787`. No está integrado. No es el evento genérico de Point 8 ni una corrida de workflow.
- **Disposición.** Crear recepción genérica solo con decisión de alcance. Propuesta no aprobada: el evento de facturación del PR 18, si se integra, sigue siendo de Stripe y no se renombra a ejecución.
- **Registro.** `pendiente decisión`.

## concepto: ai_agents

- **Hecho.** No hay agente persistido. Hay llamadas: `src/lib/support-llm.ts`, `src/lib/admin-code-assistant.ts`, `src/lib/automation/ia-meta-claude.ts` y rutas `ia-ollama`, `ia-meta`, `campaign-copy-assist`. El proveedor y la clave pueden venir en el body del asistente de soporte.
- **Disposición.** Crear definición de agente (instrucción, herramientas permitidas) distinta de cada llamada. Propuesta no aprobada.
- **Registro.** `pendiente decisión`.

## concepto: ai_agent_runs

- **Hecho.** `AiWorkspaceJob` guarda `tool`, `prompt`, `status`, `creditsUsed` y `output` por `userId`. Es un trabajo de estudio, no la corrida de un agente con versión. El asistente de soporte no inserta esa fila.
- **Disposición.** Crear corrida de agente. Reutilizar `AiWorkspaceJob` solo para el estudio de IA. Propuesta no aprobada: no fusionar los dos.
- **Registro.** `pendiente decisión`.

## concepto: ai_tool_calls

- **Hecho.** `AiWorkspaceJob.tool` es un string del trabajo completo. No hay una fila por invocación de herramienta ni por aprobación.
- **Disposición.** Crear llamada de herramienta hija de la corrida. Propuesta no aprobada.
- **Registro.** `pendiente decisión`.

## concepto: approvals

- **Hecho.** No hay modelo. `ConnectionRequest.status` default `pending` es una solicitud de conexión, no una aprobación genérica. No hay quién aprueba un paso de workflow o una herramienta de IA.
- **Disposición.** Crear aprobación ligada a una corrida, un paso o una llamada de herramienta. Propuesta no aprobada. Quién puede aprobar depende de la decisión de permisos.
- **Registro.** `pendiente decisión`.

## concepto: audit_logs

- **Hecho.** No hay `AuditLog`. `src/lib/audit-flow.ts` no escribe bitácora. Las sesiones de `src/lib/user-sessions.ts` guardan agente e IP dentro de `VerificationToken.identifier`, con TTL de 30 días en código. Eso no es la auditoría de negocio. `AttributionEvent` registra eventos de tracking con `dedupKey` único.
- **Disposición.** Crear bitácora append-only de acciones de tenant y de plataforma. Propuesta no aprobada. El catálogo de acciones y la retención no existen.
- **Riesgo.** Usar la sesión o el tracking como auditoría, o guardar secretos en el payload.
- **Registro.** `pendiente decisión`.

## Cierre de la matriz

Los 52 conceptos quedan en `pendiente decisión`. Ninguno pasa a `diseñado`, `implementado` o `verificado` por este documento. Las tablas ya desplegadas se reutilizan donde la evidencia lo permite y no cierran el concepto más amplio.

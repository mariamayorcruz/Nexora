# Point 8 — diseño por dominio

Todo lo que sigue es **propuesta**. No modifica `prisma/schema.prisma` ni migraciones. No fija roles, retención ni reglas de negocio: donde falten, el campo dice «decisión bloqueante» y el valor queda sin sembrar.

La forma común, si se acepta, es pocas tablas compartidas. No una tabla por cada nombre de la matriz.

## 1. Identidad y tenencia

Conceptos: `organizations`, `users`, `organization_members`, `roles`, `permissions`, `employees`.

### Qué se reutiliza

| Actual | Se mantiene |
|---|---|
| `Organization` | Tenant. `slug` único. `status` actual. |
| `User` | Login. `email` único. `userId` no se borra. |
| `Membership` | Pertenencia. Único `(organizationId, userId)`. Cascada al borrar usuario u organización, como hoy. |
| `MembershipRole` | `OWNER`, `ADMIN`, `MEMBER` hasta que exista otra lista aceptada. |
| `CrmLead.organizationId` | `NOT NULL`, FK `ON DELETE RESTRICT`, índices `(organizationId, updatedAt)` y `(organizationId, stage)`. |

### Qué no se añade en la primera etapa de código

No hay `Employee`, `Role` ni `Permission`. `verifyAdmin` sigue siendo la lista de correos. `entitlements.ts` sigue siendo el tope del plan, no un permiso.

### Propuesta posterior, bloqueada

`Employee`, solo tras Q1:

- `id`, `organizationId`, `userId` opcional y único cuando existe, `displayName`, `status` sin catálogo inventado.
- Unicidad: un `userId` no se repite dentro del tenant.
- Borrado: quitar el login no borra la ficha si se acepta conservar historia; la FK del usuario sería `ON DELETE SET NULL`. Hoy no se implementa.
- Índice: `(organizationId, status)`.

`Permission` y la unión rol-permiso, solo tras Q2. Sin filas de ejemplo. El chequeo sería servidor, junto a `resolveTenantContext`, y no un reemplazo del admin por correo hasta una etapa propia.

### Aislamiento

El tenant de lectura y escritura de CRM de leads ya es `organizationId` resuelto en servidor (`resolveCrmWriteOrganization`, `src/app/api/crm/leads/route.ts`). Campañas, facturas, automatización e IA siguen por `userId`. Extender el tenant a esas tablas es una etapa distinta. RLS adicional no se diseña como política concreta: la dependencia está en la sección 7.

## 2. Comercial

Conceptos: `contacts`, `companies`, `locations`, `channels`, `conversations`, `messages`, `pipelines`, `pipeline_stages`, `opportunities`, `activities`, `tasks`.

### Hecho que el diseño no pisa

`CrmLead` sigue siendo el lead. `LeadCapture` sigue siendo la captura. `SalesStage` sigue siendo el embudo de código mientras no se acepte otra lista. `notes` sigue siendo el único rastro de mensaje.

### Propuesta de entidades

Nombres de tabla orientativos. Cardinalidad propuesta:

- `Company` N por `Organization`. No es el tenant. Nombre no único: no hay regla para fusionar «Acme» y «ACME».
- `Location` N por `Company`.
- `Contact` N por `Organization`, empresa opcional. No es `User`. Email no único en todo el producto; unicidad propuesta `(organizationId, email)` solo cuando email no es nulo, y eso es una decisión (Q3).
- `Pipeline` N por tenant. Si no se acepta más de uno, no se crea la tabla y se sigue con el constante.
- `PipelineStage` N por pipeline, `position` entero, único `(pipelineId, position)` y único `(pipelineId, key)`.
- `Opportunity` N por contacto o lead, una etapa, `value` en unidades menores y moneda si se llega a aceptar dinero de trato. Hasta entonces no se copia `CrmLead.value` Float como si fuera dinero verificado.
- `ChannelEndpoint` N por integración del tenant. Identificador externo único por tenant y canal.
- `Conversation` N por contacto y canal. Único abierto no definido: Q4.
- `Message` N por conversación. Append-only. `direction`, `body`, `externalId` único cuando el proveedor lo da.
- `Activity` N por lead u oportunidad. Tipo sin catálogo cerrado.
- `Task` N por lead u oportunidad. `status` sin lista inventada. Asignación a `User` del tenant, no a empleado.

### Borrado

Propuesta: borrar tenant no borra en cascada el CRM ya restringido. Las hijas nuevas usarían `ON DELETE RESTRICT` hacia `Organization` y `ON DELETE CASCADE` solo desde el agregado que no tiene sentido solo (mensaje al borrar conversación, etapa al borrar pipeline vacío). Borrar un lead que ya tiene mensajes guardados quedaría `RESTRICT` hasta decidir el archivo.

### Índices según consultas que ya existen o que la UI pide

- Leads por tenant y fecha: ya existe `(organizationId, updatedAt)`.
- Leads por tenant y etapa: ya existe `(organizationId, stage)`.
- Conversación abierta por contacto y canal: `(organizationId, contactId, channelEndpointId, status)`.
- Mensajes del hilo: `(conversationId, createdAt)`.
- Tareas vencidas del tenant: `(organizationId, dueAt)` cuando `dueAt` exista.

### Ciclo de vida

Lead, oportunidad, conversación y tarea tienen estados. Las listas no se escriben aquí. Mensaje y actividad no se editan; una corrección es otra fila. `CrmLead.notes` deja de recibir mensajes nuevos solo en la etapa que cree `Message`, con backfill opcional y no destructivo: no se borra `notes` al copiar.

### Compatibilidad

`src/app/dashboard/pipeline/page.tsx` y `opportunities/page.tsx` siguen redirigiendo a `/dashboard/crm` hasta que haya filas reales. `buildMessages` en conversaciones no se presenta como historial.

## 3. Documentos, conocimiento y contratos

Conceptos: `documents`, `document_versions`, `document_chunks`, `contracts`, `contract_clauses`, `contract_obligations`, `knowledge_sources`, `knowledge_chunks`, `company_rules`, `playbooks`.

### Infraestructura compartida propuesta

Un archivo binario no se modela cinco veces. El blob es un adjunto (sección 6). El documento y la fuente de conocimiento apuntan a una versión. El texto recuperable es un chunk de esa versión.

`ContentChunk` propuesto:

- `id`, `organizationId` nulo solo si se acepta contenido global de producto.
- `sourceKind`: `document_version` o `knowledge_source_version`.
- `sourceId`, `ordinal` único por fuente.
- `text`, `tokenCount` opcional, `locator` (página o carácter) sin vector obligatorio.
- Borrado: cascada desde la versión. No desde el documento padre, para no borrar chunks de versiones viejas por error.

No hay dimensión de embedding en esta propuesta. Elegir motor y dimensión es una decisión bloqueante (Q7).

### Documento y versión

- `Document`: tenant, título, agregado opaco (`ownerKind`, `ownerId`) sin FK polimórfica de base. La integridad del dueño la comprueba la aplicación hasta que el dueño exista como tabla.
- `DocumentVersion`: único `(documentId, version)`, inmutable, `attachmentId` opcional, `createdByUserId`.
- La versión vigente es la máxima `version` o una marca `publishedAt`. No se reescribe una versión publicada.

### Conocimiento

- `KnowledgeSource` y `KnowledgeSourceVersion`, mismo patrón. Distinto de `Document` porque una URL o un texto de ayuda no es un archivo de un trato.
- Chunks en `ContentChunk`.

### Contratos

- `Contract` no es `Subscription` ni `Invoice`.
- `ContractVersion` inmutable.
- `ContractClause` N por versión, `ordinal` único.
- `ContractObligation` N por versión, vencimiento y estado. La lista de estados está bloqueada (Q5).
- Borrar una versión con obligaciones cumplidas: `RESTRICT`.

### Reglas y playbooks

- `CompanyRuleSet` versionado por tenant. No por `CrmLead.company`.
- `Playbook` sigue en código hasta Q8. Si se acepta personalización: `Playbook` por tenant y `PlaybookStep` por versión, sin copiar todavía el texto de `PLAYBOOK` como si fuera política oficial. Copiarlo sería una decisión explícita de semilla.

### Retención

No hay plazo. Q9. Hasta entonces no se borra solo por fecha.

## 4. Inspección y operación física

Conceptos: `inspections`, `inspection_templates`, `inspection_runs`, `inspection_items`, `equipment`, `equipment_incidents`, `supplies`, `supply_levels`, `incidents`, `photos`.

Este dominio no está en el código. 8B-1 lo dejó fuera de aquel corte con el nombre Cleaning Pack. Eso no acepta `diferir`.

### Inspección, si se autoriza el dominio

Separar definición, copia y respuesta:

- `InspectionTemplate`: tenant, nombre, estado editable.
- `InspectionTemplateItem`: `ordinal` único por plantilla, texto, tipo de respuesta sin catálogo inventado.
- `InspectionRun`: tenant, plantilla, `templateVersion` copiada, sede o equipo opcional, estado, actor `User`.
- `InspectionRunItem`: snapshot del ítem más `answer` y `attachmentId` opcional. Único `(runId, ordinal)`.
- Cambiar la plantilla no actualiza corridas ya creadas.

### Equipo, insumo e incidente

- `Equipment` por sede o empresa cliente.
- `EquipmentIncident` por equipo, distinto de un `Incident` genérico. Unificarlos es Q6, no una decisión.
- `Supply` catálogo del tenant. `SupplyLevel` por insumo y sede, o un libro de movimientos si Q6 pide auditoría de stock. No se elige aquí.
- `Incident` genérico queda sin columnas de negocio hasta esa pregunta.

### Fotos

Una foto de inspección es un adjunto de `InspectionRunItem`. No hay tabla `Photo`.

## 5. Workflows, agentes y aprobaciones

Conceptos: `workflows`, `workflow_versions`, `workflow_runs`, `workflow_steps`, `ai_agents`, `ai_agent_runs`, `ai_tool_calls`, `approvals`.

### Workflow

- `Workflow`: tenant, nombre, estado de borrador.
- `WorkflowVersion`: inmutable, única publicación activa por workflow si se acepta esa regla. La regla no está decidida.
- `WorkflowVersionStep`: `ordinal` único, tipo opaco, configuración `Json` sin secretos.
- `WorkflowRun`: apunta a `workflowVersionId`, no a la definición editable. Estado de corrida bloqueado (Q5).
- `WorkflowRunStep`: uno por paso de esa versión, intento, error, tiempos.
- `n8nWebhookUrl` y los cron actuales no se convierten solos en corridas. Un adaptador sería otra etapa.
- `AiWorkspaceJob` y `video-pipeline` no se reutilizan como este agregado.

### Agente

- `AiAgent`: tenant o global de producto, instrucción, versión.
- `AiAgentVersion`: inmutable.
- `AiAgentRun`: versión, actor, entrada, estado. No es `AiWorkspaceJob`.
- `AiToolCall`: N por corrida, nombre de herramienta, entrada y salida sin secretos, enlace opcional a `Approval`.
- El body `aiApiKey` de `src/app/api/support/assistant/route.ts` no entra en estas tablas.

### Aprobación

- `Approval`: un sujeto (`workflow_run_step` o `ai_tool_call`), `requestedByUserId`, `decidedByUserId` opcional, decisión. Quién puede decidir sale de permisos (Q2). Sin permisos, la tabla no se crea.

Un evento de webhook no es una corrida. La corrida puede nacer a partir de un evento ya guardado, con FK opcional `webhookEventId`.

## 6. Adjuntos, almacenamiento, credenciales y auditoría

Conceptos: `attachments`, `photos`, `integrations`, `integration_credentials`, `webhook_events`, `alerts`, `insights`, `audit_logs`.

### Adjunto

`Attachment`:

- `id`, `organizationId`, `storageKey` único, `mimeType`, `sizeBytes`, `sha256`, `createdByUserId`.
- El dueño polimórfico (`ownerKind`, `ownerId`) no lleva FK de base.
- Blob en el bucket ya usado por `src/lib/storage.ts`, con prefijo de tenant cuando el archivo sea de tenant. El prefijo actual es `userId`. Cambiarlo es etapa de migración de objetos, no de este documento.
- Borrado de la fila no borra el objeto hasta una tarea explícita. Retención: Q9.

`photos` no añade tabla.

### Integración y credencial

Propuesta de destino, sin mover todavía `AdAccount` ni `TenantAutomationConfig`:

- `Integration`: tenant, proveedor, estado, identificador externo.
- `IntegrationCredential`: `integrationId`, `secretRef` (puntero, no el secreto), `expiresAt`. Único secreto vigente por integración si se acepta.
- Las columnas actuales de tokens se quedan hasta una etapa de rotación aceptada. No se copian a la tabla nueva.

### Webhook

`WebhookReceipt` genérico, distinto de la corrida y distinto de `AttributionEvent`:

- `id` propio y `externalId` único por proveedor.
- `provider`, `payloadRef` o cuerpo acotado, `status` de recepción, `receivedAt`.
- Efecto de negocio en otra transacción, después de guardar la recepción. El PR 18 hace eso para Stripe y no está en `main`. Si se integra, no se funde con esta tabla sin una etapa que lo diga.

### Alertas e insights

Siguen calculados (`buildAdminAlerts`, `computeNextBestActions`) mientras no se acepte persistirlos. Si se acepta: `Alert` con reconocimiento y `Insight` con cita a las filas que lo produjeron. Sin eso, no hay tabla.

### Auditoría

`AuditLog` append-only:

- `organizationId` nulo para acciones de plataforma.
- `actorUserId`, `action` (catálogo bloqueado, Q10), `subjectKind`, `subjectId`, `at`, `requestId`.
- Sin secretos, sin cuerpo de mensaje completo, sin IP obligatoria. La IP ya vive, con otro fin, en `VerificationToken` vía `upsertUserSession`. No se promociona esa fila a bitácora.
- Sin `UPDATE` ni `DELETE` de aplicación. Retención: Q9.

## 7. Aislamiento, RLS y facturación

**Hecho.** No hay políticas RLS en las migraciones Prisma. Hay una política Supabase sobre `tenant_automation_configs` que compara `auth.uid()` con `user_id`. El usuario de Prisma es `cuid()`.

**Dependencia, no diseño de política.** Cualquier etapa que mueva lecturas al tenant tiene que decir si el aislamiento es de aplicación (`resolveTenantContext`), de base, o los dos, y cómo se relaciona con `auth.uid()`. Este paquete no escribe `ENABLE ROW LEVEL SECURITY`.

**Facturación.** `Subscription` y `Invoice` siguen por `userId`. `PaymentSettings` sigue global. No se añade `organizationId` a esas tablas en el diseño aplicable de Point 8 mientras la instrucción prohíba mover la facturación. El dinero de un trato de cliente, si algún día existe, es `Opportunity`, no la factura de Nexora.

## 8. Consultas que el diseño deja servir

Si las etapas de esquema se autorizan, cada una debe poder responder sin unir monedas ni tenants:

- Leads e oportunidades del tenant ordenados por actualización.
- Mensajes de una conversación en orden de creación.
- Versión publicada de un documento y sus chunks en orden.
- Corrida de inspección con respuestas, aunque la plantilla cambie después.
- Corrida de workflow con la versión que la inició.
- Recepciones de webhook por `externalId` sin ejecutar dos veces el efecto.
- Bitácora del tenant por sujeto y tiempo.

Los índices de las secciones anteriores cubren esas lecturas. No se añaden índices especulativos para dominios todavía rechazados.

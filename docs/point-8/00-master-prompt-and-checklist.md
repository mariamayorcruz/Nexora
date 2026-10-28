# Point 8 — prompt maestro y checklist de continuidad

Este archivo guarda la instrucción humana que abre el modelo de datos completo de Point 8. No autoriza implementación, migración ni deploy.

Base de esta rama: `main` `b35b3a21afa48005eb49a2f7231e455eeeef35b6` (merge del PR 17).  
PR 18 no forma parte de esta rama.

## Prompt maestro

PROMPT MAESTRO PUNTO 8 — nueva instrucción humana: detallar TODO Core Data Model, reconciliar antes de implementar, luego seguir etapas hasta cierre real. No confundir 8B CRM/8C ingresos con el punto8 completo. Ejecutar AHORA solo inventario/matriz/diseño/plan documental en NUEVA rama desde main, PR separado de 18, sin perder cambios previos. Verificar main/HEAD/PR estado real. PR17 integrado; PR18 Revenue Core sigue draft (último conocido 60c1787), no merge/deploy ni modificarlo aquí. Guardar este prompt maestro y checklist de continuidad en docs del repo. Alcance completo obligatorio (una fila por concepto): organizations, users, organization_members, roles, permissions, contacts, companies, locations, employees, channels, conversations, messages, pipelines, pipeline_stages, opportunities, activities, tasks, documents, document_versions, document_chunks, contracts, contract_clauses, contract_obligations, knowledge_sources, knowledge_chunks, company_rules, playbooks, alerts, insights, incidents, equipment, equipment_incidents, supplies, supply_levels, inspections, inspection_templates, inspection_runs, inspection_items, attachments, photos, workflows, workflow_versions, workflow_runs, workflow_steps, integrations, integration_credentials, webhook_events, ai_agents, ai_agent_runs, ai_tool_calls, approvals, audit_logs. Nombres orientativos: NO una tabla por nombre; reconciliar contra Prisma/migraciones/servicios/rutas/UI/pruebas actuales evitando duplicados. No equiparar usuario con empleado, tenant con empresa cliente, lead con contacto ni evento con ejecución sin justificar. Leer instrucciones/planes existentes. Evidencia con rutas/símbolos reales; distinguir hechos/propuestas/decisiones/preguntas. Matriz: concepto, entidad actual/evidencia, cobertura/brecha/duplicados, reutilizar/extender/crear/diferir/no aplica con justificación, relaciones/cardinalidad, ámbito tenant/global y acceso, riesgo/dependencia/etapa/aceptación. NO diferir/no aplica por conveniencia: requiere aprobación humana. Diseño detallado por dominio: campos/tipos/estados, claves y unicidad, relaciones/borrado, índices por consultas, historial/versiones/ciclo de vida/retención, storage, credenciales, auditoría, aislamiento. Analizar documentos/fuentes/versiones/chunks, infraestructura compartida; workflows/agentes definición/versión/ejecución/pasos/tools/approvals; inspección plantilla/snapshot/run/respuestas; adjuntos/fotos. Diagramas actual/propuesto y etapas pequeñas ordenadas por dependencias con esquema/API/UI, compatibilidad/backfill, pruebas, rollout/rollback y aceptación. No inventar reglas de negocio/roles/retención: presentar decisiones bloqueantes con recomendación. Después se implementarán etapas autorizadas en ramas/PR separados, pruebas locales significativas, tipos/lint/build; no documento=funcionalidad. No modificar producto/modelos/migraciones/producción AHORA. No acceso filas personales ni secretos; inventario desde código, contraste DB solo lectura si necesario sin datos personales. Tests futuros solo Postgres local validado sin secreto prod. No db push/migrate dev producción/resolve/baseline ni editar migraciones aplicadas/_prisma_migrations. No borrar userId/mover billing a Organization ni implementar RLS/RBAC de otros puntos por inferencia: describir requisitos/dependencias sin omitirlos del análisis. No fusionar PR nuevos ni desplegar sin autorización etapa; coordinar auto-deploy y migrate deploy antes de código dependiente. Registro por concepto: pendiente decisión/diseñado/implementado/probado/PR/integrado/desplegado/verificado con evidencias; diferimiento no equivale implementación. Punto 8 COMPLETE solo todos conceptos decididos y etapas requeridas implementadas/verificadas o diferimientos aceptados explícitamente; no pasar 9 antes. Entregar ahora PR DOCUMENTAL con prompt maestro, matriz exhaustiva, diagramas, diseño detallado implementable, plan de etapas y preguntas pendientes priorizadas, primera etapa recomendada y estado real de 18. Validar cobertura automática de todos los conceptos, referencias reales y diff documental solamente.

## Qué es Point 8 y qué no es

**Hecho.** En el repositorio, «Point 8» ya se usó para cortes más chicos:

- 8B-1 a 8B-6: tenencia de `CrmLead` (`docs/point-8b1-database-foundation.md` y los documentos 8B-2 a 8B-6).
- 8C: diseño de ingresos en `main` (`docs/point-8c-revenue-core-design.md`) y, aparte, la implementación draft del PR 18.

**Hecho.** Esos cortes no cubren la lista de conceptos de este prompt. 8B-1 declara fuera de su alcance Company, Contact, Conversation, Message, Integration, Point 9, Cleaning Pack, RBAC y RLS.

**Decisión de este prompt.** El Core Data Model de Point 8 es la lista completa de arriba. Un documento no vuelve funcional un concepto. Point 8 no está COMPLETE. No se abre Point 9 desde este trabajo.

## Estado real verificado al abrir esta rama

| Pieza | Estado | Evidencia |
|---|---|---|
| `origin/main` | `b35b3a21afa48005eb49a2f7231e455eeeef35b6` | `git rev-parse origin/main` tras `git fetch origin main` |
| PR 17 | MERGED | Merge commit igual a `main`. Título: fix(tenancy): Point 8B-1 validator and Point 8C revenue design |
| PR 18 | OPEN, draft | Head `60c178716bec6b40003365e0bdc06856e0a067f3`, rama `cursor/point8c-revenue-core-930b`, base `main`. No se modifica aquí |
| Esta rama | `cursor/point8-core-data-model-930b` desde `main` | Solo documentación |

No se consultó la base de producción ni se leyeron filas. El inventario es de código, migraciones y documentos.

## Leyenda de registro

Cada concepto de la matriz usa exactamente uno de estos estados para el **concepto Point 8**, no para una tabla parecida:

1. `pendiente decisión` — falta una aceptación humana. El diseño de este PR no la sustituye.
2. `diseñado` — la decisión está aceptada y el diseño de esa etapa quedó fijado. Este PR no marca ningún concepto así.
3. `implementado` — el esquema y el código de esa etapa existen en la rama de trabajo.
4. `probado` — las pruebas locales de esa etapa pasaron.
5. `PR` — hay un pull request de esa etapa.
6. `integrado` — el pull request está en `main`.
7. `desplegado` — la migración de esa etapa se aplicó en el entorno autorizado.
8. `verificado` — el chequeo posterior al deploy coincide con la aceptación.

Una entidad que ya existe puede estar desplegada para otro trabajo (por ejemplo `Organization` en Point 7 y `CrmLead.organizationId` en 8B-6) y, a la vez, el concepto Point 8 seguir en `pendiente decisión` si su alcance completo no fue aceptado.

`diferir` y `no aplica` no son estados de implementación. Si aparecen en la matriz, son propuestas sin aprobación.

## Checklist de continuidad

Antes de cualquier etapa posterior:

- [ ] Confirmar que se trabaja en una rama nueva desde `main` actualizado, no en `cursor/point8c-revenue-core-930b`.
- [ ] Confirmar que el PR 18 sigue sin merge y sin deploy, salvo autorización distinta.
- [ ] Leer `01-reconciliation-matrix.md`, `02-domain-design.md` y `03-stages-diagrams-decisions.md`.
- [ ] No tratar como decididas las recomendaciones de este paquete.
- [ ] No borrar `userId`. No mover `Subscription` ni `Invoice` a `Organization`.
- [ ] No implementar RLS ni RBAC porque «el punto lo necesita». Describir la dependencia y esperar autorización de esa etapa.
- [ ] No editar migraciones ya aplicadas ni `_prisma_migrations`. No usar `db push`, `migrate dev`, `migrate resolve` ni baseline sobre producción.
- [ ] Coordinar el auto-deploy con `migrate deploy` antes de código que lea columnas nuevas.
- [ ] Pruebas de base solo contra Postgres local cuya URL se validó como desechable, sin secreto de producción.
- [ ] Actualizar el registro del concepto en la matriz. Un diferimiento aceptado debe citar la aceptación humana.
- [ ] No declarar Point 8 COMPLETE hasta que cada concepto esté decidido y sus etapas requeridas estén verificadas, o el diferimiento esté aceptado de forma explícita.
- [ ] No empezar Point 9 antes de ese cierre.

## Artefactos de este corte

- `docs/point-8/00-master-prompt-and-checklist.md` — este archivo.
- `docs/point-8/01-reconciliation-matrix.md` — una sección por concepto.
- `docs/point-8/02-domain-design.md` — diseño proponible, no aplicado.
- `docs/point-8/03-stages-diagrams-decisions.md` — diagramas, etapas, preguntas, estado del PR 18.

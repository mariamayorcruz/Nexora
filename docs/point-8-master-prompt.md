# Prompt maestro — Nexora, punto 8: Core Data Model

Objetivo: reconciliar y detallar el punto 8 y entregar su implementación por cortes verificables coordinados con el master completo. No duplicar conceptos ni interpretar los números de sección como fases rígidas; distinguir diseño de datos, fundación desplegada y golden workflows completos.

Repo: mariamayorcruz/Nexora. Leer instrucciones vigentes y verificar main, HEAD, ramas, cambios y PR abiertos antes de actuar. Preservar trabajo existente. 8B-6 se aplicó en producción; PR17 integró el arreglo del validador y diseño Revenue Core; verificar estado real del PR18, sin asumir que está integrado/desplegado. Nada de ello equivale al cierre integral del punto 8.

## Conceptos obligatorios a reconciliar
organizations, users, organization_members, roles, permissions, contacts, companies, locations, employees, channels, conversations, messages, pipelines, pipeline_stages, opportunities, activities, tasks, documents, document_versions, document_chunks, contracts, contract_clauses, contract_obligations, knowledge_sources, knowledge_chunks, company_rules, playbooks, alerts, insights, incidents, equipment, equipment_incidents, supplies, supply_levels, inspections, inspection_templates, inspection_runs, inspection_items, attachments, photos, workflows, workflow_versions, workflow_runs, workflow_steps, integrations, integration_credentials, webhook_events, ai_agents, ai_agent_runs, ai_tool_calls, approvals, audit_logs.

Son conceptos orientativos: NO crear una tabla por nombre. Reconciliar primero con entidades existentes y evitar duplicidades. No equiparar automáticamente usuario con empleado, organización tenant con empresa cliente, lead con contacto, evento externo con ejecución. Justificar equivalencias y separaciones.

## 1. Inventario
Inventariar Prisma, migraciones, claves, índices, restricciones y relaciones, así como rutas, servicios, UI y pruebas que los consumen. Leer planes/documentos del producto. Distinguir hechos comprobados, decisiones humanas, propuestas y preguntas abiertas. Citar rutas y símbolos concretos. No ampliar exploración ajena al alcance.

## 2. Matriz completa
Una fila por concepto, sin omisiones: modelo/tabla/servicio actual; evidencia; cobertura; brecha; duplicados; decisión propuesta (reutilizar/extender/crear/diferir/no aplica); justificación; relaciones/cardinalidad; propietario y ámbito tenant/global; acceso; riesgo; dependencias/etapa; aceptación. Desconocido si falta evidencia. No diferir ni marcar no aplica solo para reducir alcance: justificar y pedir decisión humana.

## 3. Diseño detallado
Por dominio: campos/tipos/estados, claves naturales, relaciones y borrado, unicidad, índices ligados a consultas, historial/versiones, ciclo de vida, retención, almacenamiento, credenciales, auditoría y aislamiento tenant.
Distinguir documentos/fuentes/versiones/fragmentos y decidir infraestructura compartida; definición/versión/ejecución de workflows, pasos, agentes, herramientas y aprobaciones; plantilla/snapshot/ejecución/respuestas de inspección; adjuntos/fotos sin duplicación injustificada.
Preparar diagramas actual/propuesto y etapas pequeñas ordenadas por dependencias. Cada etapa incluye alcance/exclusiones, esquema/API/UI, compatibilidad, backfill, pruebas, rollout, reversión y aceptación. No inventar reglas de negocio, roles ni retención: presentar decisiones necesarias con recomendación.

## 4. Implementación incremental
Después de la reconciliación y decisiones necesarias, implementar las etapas autorizadas en ramas separadas y PR revisables. Reutilizar PR existentes aprobados. No confundir documentación con funcionalidad. Cada etapa debe incluir el corte completo de comportamiento, migraciones versionadas aditivas, pruebas significativas locales y revisión del diff, tipos/lint/build. Actualizar validadores afectados sin debilitar cobertura. No incluir scripts temporales.
No editar migraciones aplicadas ni _prisma_migrations manualmente. No db push, migrate dev contra producción, baselining ni resolve como atajo. No borrar userId, mover billing a Organization ni introducir RLS/RBAC de otros puntos por inferencia; describir esas dependencias y obtener alcance explícito antes de implementarlas.

## 5. Producción
Supabase ref rzusbivnegohgbcvffzu. Nunca exponer/persistir secretos. Tests solo contra Postgres local desechable con guard explícito de destino y secreto prod fuera del proceso. El inventario debe partir del código; cualquier contraste con DB será solo lectura y metadatos/contadores necesarios, sin filas personales.
No fusionar PR nuevos ni desplegar sin autorización de la etapa. Preparar resultado y pruebas antes de pedir aprobación. Coordinar despliegue automático: migración antes de código que la necesita. Flujo producción: migrate status, preflight read-only, migrate deploy, status y verificaciones físicas/integridad. No SQL manual mutante. Si falla gate detener la mutación y reportar evidencia sanitizada.

## 6. Avance y cierre
Mantener registro por concepto/etapa: pendiente de decisión, diseñado, implementado, probado, PR, integrado, desplegado, verificado, con evidencia y fechas. No mezclar estados.
Cerrar el diseño del punto 8 con conceptos reconciliados, decisiones e integridad/acceso definidos. Registrar implementación/despliegue por corte. No exigir todos los productos operativos antes de diseñar eventos del punto 9: avanzar según dependencias de 47/57 y golden workflows46. Ningún diferimiento equivale a implementación.

## Ejecutar ahora
Pasos 1 a 3: inventario, matriz integral y plan detallado en PR documental separado. No modificar producto/esquema/migraciones/main/producción en esta fase. Mantener PR18 separado y reflejar estado real. Entregar decisiones pendientes y primera etapa concreta recomendada. Continuar después con implementación según aprobaciones, sin volver a solicitar autorizaciones ya dadas para idéntico alcance.



## Actualización humana — master completo y alcance multiempresa

Leer gotnexora-master-plan-original.md (59 secciones) y gotnexora-master-plan-review.md. La revisión complementa el original y prevalece sobre propuestas anteriores simplificadas.

Confirmado: empresas propias/socios y terceros/agencia combinadas; usuarios con diferentes permisos por empresa/equipo/módulo/acción/datos; CRM compartido opcional; permisos de staff Nexora por área; capacidades habilitadas por Nexora para cada cliente; soporte remoto con permiso del cliente; facturación plataforma, facturación de empresas clientes y finanzas Nexora separadas.

No confundir cuenta comercial, Organization empresa administrada y Company cliente comercial. Diseñar relaciones y delegación sin grants automáticos por ser socio/agencia/jefe. Entitlements, flags, permisos y consentimiento son controles distintos. Soporte asistido no significa control remoto del dispositivo: diseñar sesión temporal/revocable con actor real, scope, aprobación y auditoría; nunca compartir contraseñas ni dar acceso universal a staff.

PR18 es Platform Billing Revenue Projection, NO el Revenue Engine comercial de sección46 (WhatsApp a venta). Mantener dos golden workflows antes de expansión agresiva Finance/HR. Ningún dominio financiero puede leer otro por defecto.

Todavía pendientes: estructura comercial/pagador/transferencias; precedencia grants/denies; catálogo entitlements; scopes/tiempo/aprobador de soporte; retención/exportación/borrado; jurisdicciones/proveedor contable; granularidad sharing CRM. No inventar respuestas.

Acción siguiente: completar Current State Report6 y Transformation Plan58 A–P con evidencia faltante; detallar ADR cuenta/empresa y contrato de permisos con Point30; presentar decisiones concretas antes del primer cambio de producto. Solo documentación por esta instrucción, sin merge/despliegue ni acceso a cuentas de clientes reales.

# Punto 8 — 4A-1C-1A: estabilidad completa del contenido

## Estado

Corte incremental previo al SealService operativo.

Este corte **no** implementa HMAC, autoridad, secreto, función de sellado, HTTP, activación CRM ni grants productivos. Su único objetivo es cerrar C5 sobre el esquema real: locks de padre y `contentRevision` para todas las tablas que participan en contenido o evidencia.

Base: `main` posterior a PR #29.

## Motivación

PR #29 cerró:

- persistencia candidata 4A-1B;
- candidate-anchor 0b;
- locks de candidato para evidencia 0c;
- freeze de `organizationId` en evidencia;
- `contentRevision` para evidencia.

Todavía faltaba llevar el mismo principio de estabilidad a las demás tablas reales del bundle antes de introducir un sellador.

## Garantías de este corte

1. Todo INSERT/UPDATE/DELETE directo de contenido bundle-scoped bloquea su bundle padre antes de mutar.
2. Moves entre bundles DRAFT bloquean OLD+NEW en orden determinista y suben revisión en ambos.
3. Evidencia bloquea predecessor + candidate; solo el candidate `toVersion` recibe bump.
4. EvidenceFieldClass hereda la misma disciplina a través de su evidencia padre.
5. Un bundle DRAFT:
   - comienza en `contentRevision = 0`;
   - no puede cambiar `id`, `organizationId` o `version`;
   - cambia revisión si cambia `canonicalVersion` o el predecessor;
   - no permite rollback ni saltos arbitrarios de revisión.
6. VALIDATED continúa completamente inmutable.
7. `organizationId` de filas hijas no puede reescribirse entre empresas.
8. Roles cliente/ordinarios no reciben privilegios sobre helpers ni tablas de política.
9. Ningún objeto de SealService/HMAC se crea aquí.

## Inventario cubierto

- `CrmReadPolicyBundle`
- `CrmReadPolicyBundleMembershipLink`
- `CrmReadPolicyBundleLeadLink`
- `CrmReadPolicyRetiredGrantLogicalId`
- `CrmReadPolicyGrant`
- `CrmReadPolicyGrantFieldClass`
- `CrmReadPolicyRestriction`
- `CrmReadPolicyRestrictionFieldClass`
- `CrmReadPolicyChangeEvidence`
- `CrmReadPolicyChangeEvidenceFieldClass`

## Evidencia / candidate-anchor

Se mantiene la regla aceptada en 0b/0c:

- un predecessor VALIDATED puede participar como `fromVersion`;
- mientras el candidate `toVersion` siga DRAFT, se puede preparar su evidencia;
- cuando el candidate queda VALIDATED, su evidencia pasa a ser inmutable.

Los locks toman tanto predecessor como candidate para estabilizar la relación, pero el bump pertenece al candidate.

## Borrados en cascada

Los DELETE anidados provocados por una cascada no vuelven a incrementar revisión del padre:

- un DELETE directo del objeto raíz del cambio sí hace bump;
- sus cascadas internas se consideran parte de la misma mutación;
- un DELETE de bundle DRAFT conserva su comportamiento de borrado del snapshot completo.

## Seguridad de roles

La migración revoca acceso a helpers y tablas, cuando existan, para:

- `anon`
- `authenticated`
- `authenticator`
- `service_role`
- `nexora_app`
- `nexora_sealer`

No se otorga EXECUTE de ningún camino de sellado.

## C9 / secretos

Deliberadamente fuera de este corte.

La arquitectura histórica proponía H-OWNER-TABLE o Vault. La revisión actual de Supabase muestra que Vault concede privilegios propios a `service_role` y esos grants gestionados por Supabase no se revocan de la forma habitual. Por ello la decisión final de almacenamiento del secreto debe cerrarse en un corte posterior, junto con la separación real del rol de aplicación y del rol sealer.

## Prueba obligatoria

```bash
FR004_DATABASE_URL=postgresql://...@127.0.0.1:5432/... \
  npm run tenancy:validate-point8-4a1c-1a
```

El validador debe correr únicamente en PostgreSQL desechable/local.

Casos mínimos:

- identidad/revisión del bundle;
- INSERT en las 9 categorías hijas/evidencia;
- UPDATE/DELETE;
- move OLD→NEW;
- cross-org freeze;
- predecessor VALIDATED + candidate DRAFT;
- candidate VALIDATED immutable;
- concurrencia hijo↔candidate;
- concurrencia evidencia↔candidate;
- revocación de privilegios;
- ausencia de cualquier función/secret store de sellado.

## Gate

No mergear hasta:

1. Prisma validate PASS.
2. Migraciones desde esquema vacío PASS.
3. Suite `tenancy:validate-point8-4a1c-1a` PASS en PostgreSQL desechable.
4. Vercel 4/4 SUCCESS.
5. Revisión independiente de que no existe superficie HMAC/seal/HTTP.
6. Ninguna migración aplicada a producción como parte de este PR.

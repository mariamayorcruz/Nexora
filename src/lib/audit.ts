import { prisma } from '@/lib/prisma';

export interface AuditInput {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  headers?: Headers;
  meta?: Record<string, unknown>;
}

/** Registro de auditoría: nunca debe romper el flujo principal. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const ip =
      input.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      input.headers?.get('x-real-ip') ||
      null;
    await prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        entity: input.entity || null,
        entityId: input.entityId || null,
        ip,
        userAgent: input.headers?.get('user-agent') || null,
        meta: (input.meta as never) ?? undefined,
      },
    });
  } catch (error) {
    console.error('[audit] no se pudo registrar el evento', error);
  }
}

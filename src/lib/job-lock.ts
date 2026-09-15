import { prisma } from '@/lib/prisma';

/**
 * Bloqueo de ejecución única para tareas programadas.
 * Si otra ejecución ya tiene el lock vigente, esta sale sin hacer nada.
 */
export async function acquireJobLock(name: string, ttlMs = 10 * 60 * 1000): Promise<boolean> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);

  try {
    await prisma.jobLock.create({ data: { name, lockedUntil } });
    return true;
  } catch {
    const updated = await prisma.jobLock.updateMany({
      where: { name, lockedUntil: { lt: now } },
      data: { lockedUntil },
    });
    return updated.count > 0;
  }
}

export async function releaseJobLock(name: string): Promise<void> {
  try {
    await prisma.jobLock.updateMany({ where: { name }, data: { lockedUntil: new Date(0) } });
  } catch (error) {
    console.error('[job-lock] no se pudo liberar', name, error);
  }
}

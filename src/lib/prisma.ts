import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

/** Drop pooled client so the next request opens a fresh connection (Neon / serverless idle kills). */
export async function disconnectPrismaForRetry() {
  const client = globalForPrisma.prisma;
  if (client) {
    await client.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
}

function isTransientDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ['P1001', 'P1002', 'P1008', 'P1017'].includes(error.code);
  }
  if (error instanceof Error) {
    const msg = error.message;
    return (
      /terminating connection/i.test(msg) ||
      /connection.*closed/i.test(msg) ||
      /server has closed/i.test(msg) ||
      /E57P01/i.test(msg) ||
      /administrator command/i.test(msg) ||
      /ECONNRESET/i.test(msg)
    );
  }
  return false;
}

/** One retry after reset — covers stale connections after DB sleep or admin restarts. */
export async function withPrismaRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts && isTransientDbError(error)) {
        await disconnectPrismaForRetry();
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    return Reflect.get(client, property, receiver);
  },
});

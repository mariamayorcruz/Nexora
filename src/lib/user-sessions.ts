import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const SESSION_PREFIX = 'session';
const SESSION_TTL_DAYS = 30;

type SessionMetadata = {
  userId: string;
  sid: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
  ip: string;
};

function safeSegment(value: string) {
  return Buffer.from(value || '', 'utf-8').toString('base64url');
}

function decodeSegment(value: string) {
  try {
    return Buffer.from(value, 'base64url').toString('utf-8');
  } catch {
    return '';
  }
}

function buildIdentifier(meta: SessionMetadata) {
  return [
    SESSION_PREFIX,
    meta.userId,
    meta.createdAt,
    meta.lastSeenAt,
    safeSegment(meta.userAgent),
    safeSegment(meta.ip),
  ].join('|');
}

function parseIdentifier(identifier: string) {
  const [prefix, userId, createdAt, lastSeenAt, userAgentEncoded, ipEncoded] = identifier.split('|');
  if (prefix !== SESSION_PREFIX || !userId || !createdAt || !lastSeenAt) return null;

  return {
    userId,
    createdAt,
    lastSeenAt,
    userAgent: decodeSegment(userAgentEncoded || ''),
    ip: decodeSegment(ipEncoded || ''),
  };
}

function normalizeUserAgent(value: string | null) {
  const source = String(value || '').trim();
  return source ? source.slice(0, 180) : 'Dispositivo desconocido';
}

function normalizeIp(value: string | null) {
  const source = String(value || '').split(',')[0].trim();
  return source || 'ip-desconocida';
}

function getExpiryDate() {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function createSessionId() {
  return randomUUID();
}

export async function upsertUserSession(params: {
  userId: string;
  sid: string;
  userAgent: string | null;
  ip: string | null;
}) {
  const now = new Date();
  const existing = await prisma.verificationToken.findUnique({ where: { token: params.sid } });
  const parsed = existing ? parseIdentifier(existing.identifier) : null;
  const createdAt = parsed?.createdAt || now.toISOString();

  await prisma.verificationToken.upsert({
    where: { token: params.sid },
    update: {
      identifier: buildIdentifier({
        userId: params.userId,
        sid: params.sid,
        createdAt,
        lastSeenAt: now.toISOString(),
        userAgent: normalizeUserAgent(params.userAgent),
        ip: normalizeIp(params.ip),
      }),
      expires: getExpiryDate(),
    },
    create: {
      token: params.sid,
      identifier: buildIdentifier({
        userId: params.userId,
        sid: params.sid,
        createdAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
        userAgent: normalizeUserAgent(params.userAgent),
        ip: normalizeIp(params.ip),
      }),
      expires: getExpiryDate(),
    },
  });
}

export async function listUserSessions(userId: string, currentSid?: string) {
  const now = new Date();
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: { startsWith: `${SESSION_PREFIX}|${userId}|` },
      expires: { lt: now },
    },
  });

  const records = await prisma.verificationToken.findMany({
    where: {
      identifier: { startsWith: `${SESSION_PREFIX}|${userId}|` },
    },
    orderBy: { expires: 'desc' },
    take: 20,
  });

  return records
    .map((record) => {
      const parsed = parseIdentifier(record.identifier);
      if (!parsed) return null;

      return {
        id: record.token,
        userAgent: parsed.userAgent,
        ip: parsed.ip,
        createdAt: parsed.createdAt,
        lastSeenAt: parsed.lastSeenAt,
        expiresAt: record.expires.toISOString(),
        current: Boolean(currentSid && currentSid === record.token),
      };
    })
    .filter(Boolean);
}

export async function closeOtherSessions(userId: string, currentSid?: string) {
  const whereBase = {
    identifier: { startsWith: `${SESSION_PREFIX}|${userId}|` },
  } as const;

  if (currentSid) {
    const result = await prisma.verificationToken.deleteMany({
      where: {
        ...whereBase,
        token: { not: currentSid },
      },
    });

    return result.count;
  }

  const result = await prisma.verificationToken.deleteMany({ where: whereBase });
  return result.count;
}

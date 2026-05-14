/**
 * One-off diagnostic: which DATABASE_URL (after .env + .env.local) and which demo users exist.
 * Run: node scripts/diag-demo-login.mjs
 * Remove when no longer needed.
 */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const url = process.env.DATABASE_URL;
console.log('DATABASE_URL defined:', Boolean(url));
if (url) {
  const hostMatch = url.match(/@([^/?]+)/);
  console.log('Host:', hostMatch ? hostMatch[1] : '?');
  console.log('Uses Supabase pooler (6543):', url.includes('pooler.supabase') && url.includes('6543'));
}

const prisma = new PrismaClient();
try {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ email: 'demo@example.com' }, { email: 'demo@gotnexora.com' }],
    },
    select: {
      email: true,
      id: true,
      createdAt: true,
      onboardingCompletedAt: true,
      subscription: {
        select: {
          status: true,
          plan: true,
          currentPeriodEnd: true,
        },
      },
    },
    orderBy: { email: 'asc' },
  });
  console.log('Demo rows:', JSON.stringify(users, null, 2));
  console.log('Count:', users.length);
} catch (e) {
  console.error('Prisma query failed:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

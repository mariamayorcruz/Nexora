import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

/** Misma prioridad que Next: `.env` y luego `.env.local` sobrescribe. */
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL no está definida. Configúrala en .env o .env.local (copia desde Supabase → Database).');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@gotnexora.com';
  const password = 'Demo2026!';
  const name = 'Demo Nexora';

  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date(currentPeriodStart);
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      onboardingCompletedAt: null,
      onboardingData: null,
      onboardingStartedAt: null,
      subscription: {
        upsert: {
          update: {
            plan: 'professional',
            status: 'active',
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
          },
          create: {
            plan: 'professional',
            status: 'active',
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
          },
        },
      },
    },
    create: {
      email,
      name,
      password: hashedPassword,
      onboardingCompletedAt: null,
      onboardingData: null,
      onboardingStartedAt: null,
      subscription: {
        create: {
          plan: 'professional',
          status: 'active',
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      },
    },
    include: {
      subscription: true,
    },
  });

  console.log('Demo user ready:', {
    id: user.id,
    email: user.email,
    name: user.name,
    subscription: user.subscription,
    onboardingCompletedAt: user.onboardingCompletedAt,
  });
}

main()
  .catch((error) => {
    console.error('Failed to create demo user:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

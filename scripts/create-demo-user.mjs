import bcrypt from 'bcryptjs';
process.env.DATABASE_URL = 'postgresql://postgres.rzusbivnegohgbcvffzu:7demaster77vitoco@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

import { PrismaClient } from '@prisma/client';

console.log('DATABASE_URL:', process.env.DATABASE_URL);

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

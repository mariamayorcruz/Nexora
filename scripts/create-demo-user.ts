import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';
import { ensureUserOrganization } from '../src/lib/tenancy/ensure-user-organization';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@gotnexora.com';
  const password = 'Demo2026!';
  const name = 'Demo Nexora';

  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date(currentPeriodStart);
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

  const hashedPassword = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const upserted = await tx.user.upsert({
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

    await ensureUserOrganization(tx, {
      userId: upserted.id,
      onboardingData: upserted.onboardingData,
    });

    return upserted;
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

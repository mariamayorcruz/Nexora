// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create demo users
  const hashedPassword = await bcrypt.hash('DemoUser123!', 10);

  const user1 = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Usuario Demo',
      password: hashedPassword,
    },
  });

  // Create subscription for user1
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 14);

  await prisma.subscription.create({
    data: {
      userId: user1.id,
      plan: 'starter',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndDate,
    },
  });

  // Create sample ad accounts
  const account1 = await prisma.adAccount.create({
    data: {
      userId: user1.id,
      platform: 'instagram',
      accountId: 'inst_123456789',
      accessToken: 'encrypted_token_here',
      accountName: 'Mi Cuenta Instagram',
      accountEmail: 'instagram@example.com',
      connected: true,
    },
  });

  const account2 = await prisma.adAccount.create({
    data: {
      userId: user1.id,
      platform: 'facebook',
      accountId: 'fb_987654321',
      accessToken: 'encrypted_token_here',
      accountName: 'Mi Página Facebook',
      accountEmail: 'facebook@example.com',
      connected: true,
    },
  });

  // Create sample campaigns
  const campaign1 = await prisma.campaign.create({
    data: {
      userId: user1.id,
      adAccountId: account1.id,
      name: 'Campaña de Promoción de Verano',
      description: 'Promoción especial de verano en Instagram',
      budget: 500,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
      targeting: {
        locations: ['ES', 'MX'],
        ageRange: { min: 18, max: 65 },
        interests: ['fashion', 'travel', 'summer'],
      },
    },
  });

  // Create analytics for campaign1
  await prisma.analytics.create({
    data: {
      campaignId: campaign1.id,
      impressions: 45000,
      clicks: 1200,
      conversions: 89,
      spend: 450,
      revenue: 1350,
      ctr: 2.67,
      cpc: 0.375,
    },
  });

  const campaign2 = await prisma.campaign.create({
    data: {
      userId: user1.id,
      adAccountId: account2.id,
      name: 'Alcance Local - Facebook',
      description: 'Dirigirse a clientes locales en Facebook',
      budget: 300,
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      status: 'active',
      targeting: {
        locations: ['Madrid', 'Barcelona'],
        ageRange: { min: 25, max: 55 },
        interests: ['commerce', 'technology'],
      },
    },
  });

  // Create analytics for campaign2
  await prisma.analytics.create({
    data: {
      campaignId: campaign2.id,
      impressions: 28000,
      clicks: 850,
      conversions: 102,
      spend: 280,
      revenue: 1530,
      ctr: 3.04,
      cpc: 0.329,
    },
  });

  console.log('Seed completed successfully!');
  console.log('Demo user: demo@example.com / DemoUser123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

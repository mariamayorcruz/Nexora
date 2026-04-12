import { prisma } from '@/lib/prisma';
import { analyzeCampaignsAndAllocateBudget } from './ia-meta-logic';
import { getIaAutomationConfig } from '@/lib/admin-config';

export async function runRealtimeIaAutomation(userId: string) {
  const config = await getIaAutomationConfig();

  if (!config.enabled || !config.maxMonthlyBudget) {
    return { status: 'disabled' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { status: 'missing-user' };
  }

  const adAccounts = await prisma.adAccount.findMany({
    where: { userId, connected: true },
  });

  const campaigns = await prisma.campaign.findMany({
    where: { userId, status: 'active' },
    include: { analytics: true, adAccount: true },
  });

  const actions = await analyzeCampaignsAndAllocateBudget({
    user,
    adAccounts,
    campaigns,
    maxMonthlyBudget: config.maxMonthlyBudget,
  });

  return {
    status: 'ok',
    mode: config.mode,
    provider: config.provider,
    actions,
  };
}

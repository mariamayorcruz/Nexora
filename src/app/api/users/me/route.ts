import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFounderPlan, getFounderTrialDays, isAdminEmail, isFounderEmail } from '@/lib/access';
import { buildEntitlementSummary } from '@/lib/entitlements';
import { getHigherTierPlan } from '@/lib/billing';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';
import { hashPassword, validatePassword, verifyPassword } from '@/lib/auth';
import { getStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

async function getUserFromToken(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const decoded = verifyUserToken(token);
  if (!decoded?.userId) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: {
      subscription: true,
    },
  });

  if (!user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if ('error' in auth) return auth.error;
    const { user } = auth;
    const allowIncomplete = request.nextUrl.searchParams.get('allowIncomplete') === '1';

    const founderAccess = isFounderEmail(user.email);
    const adminAccess = isAdminEmail(user.email) || founderAccess;
    const founderPlan = founderAccess ? getFounderPlan() : null;
    const effectivePlan = founderAccess
      ? getHigherTierPlan(founderPlan, user.subscription?.plan)
      : user.subscription?.plan || 'starter';

    if (
      founderAccess &&
      user.subscription &&
      (user.subscription.plan !== effectivePlan || user.subscription.currentPeriodEnd < new Date())
    ) {
      const upgradedPeriodEnd = new Date();
      upgradedPeriodEnd.setDate(upgradedPeriodEnd.getDate() + getFounderTrialDays());

      const updatedSubscription = await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          plan: effectivePlan || user.subscription.plan,
          status: 'active',
          currentPeriodEnd: upgradedPeriodEnd,
        },
      });

      user.subscription = updatedSubscription;
    }

    const subscriptionStatus = user.subscription?.status?.toLowerCase() || null;
    const hasPaidAccess = Boolean(user.subscription) && ['active', 'trialing'].includes(subscriptionStatus || '');

    if (!allowIncomplete && !adminAccess && !hasPaidAccess) {
      return NextResponse.json(
        { error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' },
        { status: 403 }
      );
    }

    const adAccounts = await prisma.adAccount.findMany({
      where: { userId: user.id },
    });

    const campaigns = await prisma.campaign.findMany({
      where: { userId: user.id },
      include: {
        analytics: true,
        adAccount: {
          select: {
            platform: true,
            accountName: true,
          },
        },
      },
    });

    const [crmLeads, leadCapturesOpen, crmWon] = await Promise.all([
      prisma.crmLead.count({ where: { userId: user.id } }),
      prisma.leadCapture.count({ where: { userId: user.id, convertedToCrmAt: null } }),
      prisma.crmLead.count({ where: { userId: user.id, stage: 'won' } }),
    ]);

    const entitlements = buildEntitlementSummary(effectivePlan, {
      adAccounts: adAccounts.length,
      activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
        isAdmin: adminAccess,
        founderAccess,
        founderPlan: effectivePlan,
        entitlements,
      },
      adAccounts,
      campaigns,
      overviewFunnel: { crmLeads, leadCapturesOpen, crmWon },
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Error fetching user data' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    const body = (await request.json()) as {
      name?: string;
      marketingOptIn?: boolean;
      currentPassword?: string;
      newPassword?: string;
      cancelSubscription?: boolean;
    };

    const updateData: {
      name?: string;
      marketingOptIn?: boolean;
      marketingOptInAt?: Date | null;
      password?: string;
    } = {};

    if (body.name !== undefined) {
      const cleanName = String(body.name || '').trim();
      if (!cleanName) {
        return NextResponse.json({ error: 'El nombre no puede estar vacío.' }, { status: 400 });
      }
      updateData.name = cleanName;
    }

    if (body.marketingOptIn !== undefined) {
      updateData.marketingOptIn = Boolean(body.marketingOptIn);
      updateData.marketingOptInAt = body.marketingOptIn ? new Date() : null;
    }

    const wantsPasswordChange = Boolean(body.currentPassword || body.newPassword);
    if (wantsPasswordChange) {
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');

      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: 'Debes indicar contraseña actual y nueva contraseña.' },
          { status: 400 }
        );
      }

      const passwordMatches = await verifyPassword(currentPassword, user.password);
      if (!passwordMatches) {
        return NextResponse.json({ error: 'La contraseña actual no es correcta.' }, { status: 400 });
      }

      const validation = validatePassword(newPassword);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors.join('; ') }, { status: 400 });
      }

      updateData.password = await hashPassword(newPassword);
    }

    if (body.cancelSubscription === true) {
      const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });

      if (!subscription) {
        return NextResponse.json({ error: 'No se encontró una suscripción activa.' }, { status: 404 });
      }

      if (subscription.stripeSubId) {
        try {
          const stripe = getStripeClient();
          await stripe.subscriptions.update(subscription.stripeSubId, {
            cancel_at_period_end: true,
          });
        } catch (stripeError) {
          console.error('Stripe cancel_at_period_end error:', stripeError);
          return NextResponse.json(
            { error: 'No se pudo sincronizar la cancelación con Stripe.' },
            { status: 502 }
          );
        }
      }

      const updatedSubscription = await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          cancelAtPeriodEnd: true,
        },
        select: {
          id: true,
          plan: true,
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          stripeSubId: true,
        },
      });

      return NextResponse.json({
        ok: true,
        subscription: updatedSubscription,
        message: 'Suscripción cancelada al final del período actual.',
      });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No hay cambios para guardar.' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        marketingOptIn: true,
      },
    });

    return NextResponse.json({
      ok: true,
      user: updated,
      passwordChanged: Boolean(updateData.password),
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Error updating user data' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if ('error' in auth) return auth.error;

    await prisma.user.delete({
      where: { id: auth.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Error deleting account' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';
import {
  buildAdminAlerts,
  buildAutomationPlays,
  buildEmailCenterSummary,
  calculateHealthScore,
  calculateMrr,
} from '@/lib/admin-ops';
import { CRM_ALLOWED_STAGES } from '@/lib/sales-playbook';

export const dynamic = 'force-dynamic';

/** Normaliza email para claves; null si falta o vacío (evita .trim() sobre null/undefined). */
function safeNormEmail(value: string | null | undefined): string | null {
  if (value == null || typeof value !== 'string') return null;
  const t = value.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

function isPayingSubscriptionStatus(status: string) {
  return status === 'active' || status === 'trialing';
}

function safeDateToISO(value: Date | null | undefined): string | null {
  if (value == null || !(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

type AttributionFields = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  landingPath: string | null;
};

function buildAttributionByTrackerId(
  sessions: Array<{
    trackerId: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    referrer: string | null;
    landingPath: string | null;
  }>
): Map<string, AttributionFields> {
  const m = new Map<string, AttributionFields>();
  for (const s of sessions) {
    m.set(s.trackerId, {
      utmSource: s.utmSource ?? null,
      utmMedium: s.utmMedium ?? null,
      utmCampaign: s.utmCampaign ?? null,
      referrer: s.referrer ?? null,
      landingPath: s.landingPath ?? null,
    });
  }
  return m;
}

function attributionForTracker(
  trackerId: string | null | undefined,
  byTracker: Map<string, AttributionFields>
): AttributionFields | null {
  if (!trackerId) return null;
  return byTracker.get(trackerId) ?? null;
}

/** Claves estables para agrupar métricas UTM (solo lectura admin). */
function utmBucketKey(attr: AttributionFields | null): { source: string; campaign: string } {
  const source = (attr?.utmSource?.trim() || '(none)') as string;
  const campaign = (attr?.utmCampaign?.trim() || '(none)') as string;
  return { source, campaign };
}

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    console.log('[admin/stats] step: start handler');

    console.log('[admin/stats] before querying subscriptions + invoices + users (parallel)');
    const [users, subscriptions, invoices] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, createdAt: true },
      }),
      prisma.subscription.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          plan: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, userId: true, amount: true, status: true, createdAt: true },
      }),
    ]);
    console.log('[admin/stats] after users/subscriptions/invoices', {
      users: users.length,
      subscriptions: subscriptions.length,
      invoices: invoices.length,
    });

    console.log('[admin/stats] before querying campaigns + paymentSettings (parallel)');
    const [campaigns, paymentSettings] = await Promise.all([
      prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
        include: { analytics: true },
      }),
      prisma.paymentSettings.findFirst({
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    console.log('[admin/stats] after campaigns/paymentSettings', {
      campaigns: campaigns.length,
      hasPaymentSettings: Boolean(paymentSettings),
    });

    console.log('[admin/stats] before querying lead captures + CRM leads (parallel)');
    const [
      leadCaptureTotal,
      leadCaptureConvertedCount,
      paidCaptureEmailGroups,
      paidCaptureRows,
      leadCaptures,
      crmLeads,
      allCapturesForBusiness,
      needsSalesFollowupCount,
      paidLeadCapturesExcludedCount,
      onboardingStartedUsersCount,
      followupQueueSample,
    ] = await Promise.all([
      prisma.leadCapture.count(),
      prisma.leadCapture.count({ where: { convertedToCrmAt: { not: null } } }),
      prisma.leadCapture.findMany({
        where: { paid: true },
        distinct: ['email'],
        select: { email: true },
      }),
      prisma.leadCapture.findMany({
        where: { paid: true },
        orderBy: [{ convertedToPaidAt: 'desc' }, { createdAt: 'desc' }],
        take: 10000,
        select: {
          email: true,
          source: true,
          resource: true,
          convertedToPaidAt: true,
          createdAt: true,
          trackerId: true,
        },
      }),
      prisma.leadCapture.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          email: true,
          name: true,
          source: true,
          resource: true,
          createdAt: true,
          convertedToCrmAt: true,
          crmLeadId: true,
          paid: true,
          convertedToPaidAt: true,
          trackerId: true,
        },
      }),
      prisma.crmLead.findMany({
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          source: true,
          stage: true,
          value: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.leadCapture.findMany({
        select: { email: true, trackerId: true, paid: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.leadCapture.count({ where: { needsSalesFollowup: true } }),
      prisma.leadCapture.count({ where: { paid: true } }),
      prisma.user.count({ where: { onboardingStartedAt: { not: null } } }),
      prisma.leadCapture.findMany({
        where: { needsSalesFollowup: true },
        orderBy: [{ salesFollowupMarkedAt: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        select: {
          id: true,
          email: true,
          createdAt: true,
          salesFollowupMarkedAt: true,
          salesRecoveryFollowupSentAt: true,
          paid: true,
        },
      }),
    ]);
    console.log('[admin/stats] after lead captures + crm', {
      leadCaptureTotal,
      leadCaptureConvertedCount,
      paidDistinctEmails: paidCaptureEmailGroups.length,
      paidRowsSample: paidCaptureRows.length,
      recentCaptures: leadCaptures.length,
      crmLeads: crmLeads.length,
      allCapturesForBusiness: allCapturesForBusiness.length,
      needsSalesFollowupCount,
      paidLeadCapturesExcludedCount,
      onboardingStartedUsersCount,
      followupQueueSample: followupQueueSample.length,
    });

    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active').length;
    const totalRevenue = invoices
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + invoice.amount, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyRevenue = invoices
      .filter((invoice) => invoice.status === 'paid' && invoice.createdAt >= startOfMonth)
      .reduce((sum, invoice) => sum + invoice.amount, 0);

    const paymentReady = Boolean(
      process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_WEBHOOK_SECRET &&
        process.env.STRIPE_PRICE_STARTER_MONTHLY &&
        process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY &&
        process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY
    );

    const emailCenter = buildEmailCenterSummary(process.env.SUPPORT_EMAIL || '');
    const alerts = buildAdminAlerts({
      subscriptions,
      campaigns,
      invoices,
      paymentReady,
      smtpReady: emailCenter.smtpReady,
    });
    const automationPlays = buildAutomationPlays({ campaigns, subscriptions });
    const healthScore = calculateHealthScore({
      activeSubscriptions,
      totalUsers: users.length,
      alertsCount: alerts.length,
      paymentReady,
      smtpReady: emailCenter.smtpReady,
    });

    const platformDistributionMap = campaigns.reduce<Record<string, number>>((acc, campaign) => {
      const platform = campaign.adAccountId ? campaign.adAccountId : 'unknown';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});

    /** Cerrados (solo vista admin): email con captura pagada O suscripción activa/trialing. Sin tocar CRM por tenant. */
    const funnelClosedEmails = new Set<string>();
    for (const row of paidCaptureEmailGroups) {
      const ek = safeNormEmail(row.email);
      if (!ek) continue;
      funnelClosedEmails.add(ek);
    }
    for (const sub of subscriptions) {
      if (!isPayingSubscriptionStatus(sub.status)) continue;
      const ek = safeNormEmail(sub.user?.email);
      if (!ek) continue;
      funnelClosedEmails.add(ek);
    }
    const funnelWonCount = funnelClosedEmails.size;

    const emailDisplayByLower = new Map<string, string>();
    for (const u of users) {
      const ek = safeNormEmail(u.email);
      if (!ek) continue;
      emailDisplayByLower.set(ek, u.email.trim());
    }

    const payingSubsByEmail = new Map<string, (typeof subscriptions)[number]>();
    for (const sub of subscriptions) {
      const ek = safeNormEmail(sub.user?.email);
      if (!ek || !isPayingSubscriptionStatus(sub.status)) continue;
      payingSubsByEmail.set(ek, sub);
    }

    type FunnelConversionAcc = {
      email: string;
      source: string | null;
      resource: string | null;
      plan: string | null;
      subscriptionStatus: string | null;
      convertedAt: Date | null;
      trackerId: string | null;
    };

    const conversionMap = new Map<string, FunnelConversionAcc>();

    // A) LeadCapture con paid: true (una entrada por email; findMany ordenado)
    for (const row of paidCaptureRows) {
      const k = safeNormEmail(row.email);
      if (!k) continue;
      if (conversionMap.has(k)) continue;
      const paySub = payingSubsByEmail.get(k);
      const display =
        (emailDisplayByLower.get(k) ?? (row.email != null ? String(row.email).trim() : '')) || k;
      const convertedAt = row.convertedToPaidAt ?? row.createdAt ?? null;
      conversionMap.set(k, {
        email: display,
        source: row.source ?? null,
        resource: row.resource ?? null,
        plan: paySub?.plan ?? null,
        subscriptionStatus: paySub?.status ?? null,
        convertedAt,
        trackerId: row.trackerId ?? null,
      });
    }

    // B) Suscripción active/trialing: filas sin captura pagada o enriquecer plan/estado
    for (const sub of payingSubsByEmail.values()) {
      const rawEmail = sub.user?.email;
      const k = safeNormEmail(rawEmail);
      if (!k || !rawEmail) continue;
      const display = (emailDisplayByLower.get(k) ?? String(rawEmail).trim()) || k;
      const subConvAt = sub.currentPeriodStart ?? sub.createdAt;
      const existing = conversionMap.get(k);
      if (existing) {
        existing.plan = sub.plan;
        existing.subscriptionStatus = sub.status;
        if (!existing.convertedAt) {
          existing.convertedAt = subConvAt;
        }
      } else {
        conversionMap.set(k, {
          email: display,
          source: null,
          resource: null,
          plan: sub.plan,
          subscriptionStatus: sub.status,
          convertedAt: subConvAt,
          trackerId: null,
        });
      }
    }

    // C) Emails marcados paid en distinct pero fuera del take del findMany (cola larga)
    for (const g of paidCaptureEmailGroups) {
      const k = safeNormEmail(g.email);
      if (!k) continue;
      if (conversionMap.has(k)) continue;
      const paySub = payingSubsByEmail.get(k);
      const display =
        (emailDisplayByLower.get(k) ?? (g.email != null ? String(g.email).trim() : '')) || k;
      conversionMap.set(k, {
        email: display,
        source: null,
        resource: null,
        plan: paySub?.plan ?? null,
        subscriptionStatus: paySub?.status ?? null,
        convertedAt: paySub?.currentPeriodStart ?? paySub?.createdAt ?? null,
        trackerId: null,
      });
    }

    /** Garantiza una fila por cada email en funnelClosedEmails (mismo universo que funnel.won). */
    const missingWon = [...funnelClosedEmails].filter((ek) => !conversionMap.has(ek));
    for (const ek of missingWon) {
      const paySub = payingSubsByEmail.get(ek);
      const display = (emailDisplayByLower.get(ek) ?? ek) || ek;
      if (paySub) {
        const subConvAt = paySub.currentPeriodStart ?? paySub.createdAt;
        conversionMap.set(ek, {
          email: display,
          source: null,
          resource: null,
          plan: paySub.plan,
          subscriptionStatus: paySub.status,
          convertedAt: subConvAt,
          trackerId: null,
        });
      }
    }

    const stillMissingWon = [...funnelClosedEmails].filter((ek) => !conversionMap.has(ek));
    if (stillMissingWon.length > 0) {
      const paidCaps = await prisma.leadCapture.findMany({
        where: { email: { in: stillMissingWon }, paid: true },
        orderBy: [{ convertedToPaidAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          email: true,
          source: true,
          resource: true,
          convertedToPaidAt: true,
          createdAt: true,
          trackerId: true,
        },
      });
      const bestPaidByNorm = new Map<string, (typeof paidCaps)[number]>();
      for (const row of paidCaps) {
        const nk = safeNormEmail(row.email);
        if (!nk || bestPaidByNorm.has(nk)) continue;
        bestPaidByNorm.set(nk, row);
      }
      for (const ek of stillMissingWon) {
        if (conversionMap.has(ek)) continue;
        const row = bestPaidByNorm.get(ek);
        const paySub = payingSubsByEmail.get(ek);
        const display =
          (emailDisplayByLower.get(ek) ?? (row?.email != null ? String(row.email).trim() : '')) || ek;
        if (row) {
          conversionMap.set(ek, {
            email: display,
            source: row.source ?? null,
            resource: row.resource ?? null,
            plan: paySub?.plan ?? null,
            subscriptionStatus: paySub?.status ?? null,
            convertedAt: row.convertedToPaidAt ?? row.createdAt ?? null,
            trackerId: row.trackerId ?? null,
          });
        } else {
          conversionMap.set(ek, {
            email: display,
            source: null,
            resource: null,
            plan: paySub?.plan ?? null,
            subscriptionStatus: paySub?.status ?? null,
            convertedAt: paySub?.currentPeriodStart ?? paySub?.createdAt ?? null,
            trackerId: null,
          });
        }
      }
    }

    const conversionEmailKeys = [...new Set(Array.from(conversionMap.keys()))];
    if (conversionEmailKeys.length > 0) {
      const backfillCaptures = await prisma.leadCapture.findMany({
        where: { email: { in: conversionEmailKeys } },
        orderBy: { createdAt: 'desc' },
        select: { email: true, trackerId: true },
      });
      const trackerByNormEmail = new Map<string, string>();
      for (const row of backfillCaptures) {
        const nk = safeNormEmail(row.email);
        if (!nk || !row.trackerId) continue;
        if (!trackerByNormEmail.has(nk)) trackerByNormEmail.set(nk, row.trackerId);
      }
      for (const [k, acc] of conversionMap) {
        if (!acc.trackerId) {
          const tid = trackerByNormEmail.get(k);
          if (tid) acc.trackerId = tid;
        }
      }
    }

    const conversionTrackerIds = new Set<string>();
    for (const acc of conversionMap.values()) {
      if (acc.trackerId) conversionTrackerIds.add(acc.trackerId);
    }
    for (const c of leadCaptures) {
      if (c.trackerId) conversionTrackerIds.add(c.trackerId);
    }
    for (const c of allCapturesForBusiness) {
      if (c.trackerId) conversionTrackerIds.add(c.trackerId);
    }

    console.log('[admin/stats] before querying attribution sessions', {
      conversionTrackerIds: conversionTrackerIds.size,
    });
    const attributionSessions =
      conversionTrackerIds.size > 0
        ? await prisma.attributionSession.findMany({
            where: { trackerId: { in: [...conversionTrackerIds] } },
            select: {
              trackerId: true,
              utmSource: true,
              utmMedium: true,
              utmCampaign: true,
              referrer: true,
              landingPath: true,
            },
          })
        : [];
    console.log('[admin/stats] after attribution sessions', { rows: attributionSessions.length });

    const attributionByTrackerId = buildAttributionByTrackerId(attributionSessions);

    const userIdByEmailLower = new Map<string, string>();
    for (const u of users) {
      const ek = safeNormEmail(u.email);
      if (!ek) continue;
      userIdByEmailLower.set(ek, u.id);
    }
    const revenueByUserId = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status === 'paid') {
        revenueByUserId.set(inv.userId, (revenueByUserId.get(inv.userId) || 0) + inv.amount);
      }
    }

    const uniqueLeadEmails = new Set<string>();
    for (const capture of allCapturesForBusiness) {
      const ek = safeNormEmail(capture.email);
      if (!ek) continue;
      uniqueLeadEmails.add(ek);
    }
    const wonLeadEmails = new Set(
      [...funnelClosedEmails].filter((emailKey) => uniqueLeadEmails.has(emailKey))
    );

    /** Tasas globales: conversiones sobre universo real de leads únicos captados. */
    const conversionRate =
      uniqueLeadEmails.size > 0
        ? Math.round((wonLeadEmails.size / uniqueLeadEmails.size) * 1e6) / 1e6
        : 0;
    const revenuePerLead =
      leadCaptureTotal > 0 ? Math.round((totalRevenue / leadCaptureTotal) * 100) / 100 : 0;

    /** Ingresos facturados (paid) por plan de suscripción actual del usuario. */
    const revenueByPlanAgg = new Map<string, { plan: string; totalRevenue: number; count: number }>();
    for (const u of users) {
      const rev = revenueByUserId.get(u.id) ?? 0;
      if (rev <= 0) continue;
      const sub = subscriptions.find((s) => s.userId === u.id);
      const plan = (sub?.plan && String(sub.plan).trim()) || 'unknown';
      const cur = revenueByPlanAgg.get(plan) ?? { plan, totalRevenue: 0, count: 0 };
      cur.totalRevenue += rev;
      cur.count += 1;
      revenueByPlanAgg.set(plan, cur);
    }
    const revenueByPlan = [...revenueByPlanAgg.values()]
      .map((row) => ({
        plan: row.plan,
        totalRevenue: Math.round(row.totalRevenue * 100) / 100,
        count: row.count,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    /** Primera captura por email (createdAt asc) → bucket UTM para atribución de ingresos (solo métrica). */
    const firstTouchBucketByEmail = new Map<string, string>();
    for (const row of allCapturesForBusiness) {
      const ek = safeNormEmail(row.email);
      if (!ek) continue;
      if (firstTouchBucketByEmail.has(ek)) continue;
      const { source, campaign } = utmBucketKey(
        attributionForTracker(row.trackerId, attributionByTrackerId)
      );
      firstTouchBucketByEmail.set(ek, `${source}\t${campaign}`);
    }

    const sourceMetrics = new Map<
      string,
      { source: string; campaign: string; leads: Set<string>; conversions: Set<string>; revenue: number }
    >();
    const touchKey = (source: string, campaign: string) => `${source}\t${campaign}`;
    const ensureBucket = (source: string, campaign: string) => {
      const k = touchKey(source, campaign);
      let b = sourceMetrics.get(k);
      if (!b) {
        b = { source, campaign, leads: new Set(), conversions: new Set(), revenue: 0 };
        sourceMetrics.set(k, b);
      }
      return b;
    };

    for (const row of allCapturesForBusiness) {
      const ek = safeNormEmail(row.email);
      if (!ek) continue;
      const { source, campaign } = utmBucketKey(
        attributionForTracker(row.trackerId, attributionByTrackerId)
      );
      const b = ensureBucket(source, campaign);
      b.leads.add(ek);
      if (funnelClosedEmails.has(ek)) b.conversions.add(ek);
    }

    for (const u of users) {
      const rev = revenueByUserId.get(u.id) ?? 0;
      if (rev <= 0) continue;
      const ek = safeNormEmail(u.email);
      if (!ek) continue;
      const k = firstTouchBucketByEmail.get(ek) ?? touchKey('(none)', '(none)');
      const b = sourceMetrics.get(k) ?? ensureBucket('(none)', '(none)');
      b.revenue += rev;
    }

    const revenueBySource = [...sourceMetrics.values()]
      .map((b) => ({
        source: b.source,
        campaign: b.campaign,
        revenue: Math.round(b.revenue * 100) / 100,
        leads: b.leads.size,
        conversions: b.conversions.size,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);

    const business = {
      conversionRate,
      revenuePerLead,
      revenueByPlan,
      revenueBySource,
    };

    console.log('[admin/stats] business metrics', {
      conversionRate,
      revenuePerLead,
      revenueByPlanLen: revenueByPlan.length,
      revenueBySourceLen: revenueBySource.length,
    });

    const funnelConversions = Array.from(conversionMap.values())
      .map((r) => ({
        email: r.email,
        source: r.source,
        resource: r.resource,
        plan: r.plan,
        subscriptionStatus: r.subscriptionStatus,
        convertedToPaidAt: safeDateToISO(r.convertedAt),
        attribution: attributionForTracker(r.trackerId, attributionByTrackerId),
      }))
      .sort((a, b) => {
        const ta = a.convertedToPaidAt ? new Date(a.convertedToPaidAt).getTime() : 0;
        const tb = b.convertedToPaidAt ? new Date(b.convertedToPaidAt).getTime() : 0;
        return tb - ta;
      });

    console.log('[admin/stats] funnel conversions built', { count: funnelConversions.length });

    const subscriptionByEmailLower = new Map<
      string,
      { plan: string; status: string; userId: string }
    >();
    for (const sub of subscriptions) {
      const ek = safeNormEmail(sub.user?.email);
      if (!ek) continue;
      subscriptionByEmailLower.set(ek, {
        plan: sub.plan,
        status: sub.status,
        userId: sub.userId,
      });
    }

    const crmLeadMap = new Map(crmLeads.map((lead) => [lead.id, lead]));
    const recentFunnelLeads = leadCaptures.map((capture) => {
      const crmLead = capture.crmLeadId ? crmLeadMap.get(capture.crmLeadId) : null;
      const baseStage =
        crmLead && CRM_ALLOWED_STAGES.has(crmLead.stage)
          ? crmLead.stage
          : capture.convertedToCrmAt
            ? 'contacted'
            : 'lead';

      const em = safeNormEmail(capture.email);
      const subRow = em ? subscriptionByEmailLower.get(em) : undefined;
      const subscriptionPaying = Boolean(subRow && isPayingSubscriptionStatus(subRow.status));
      const paidEffective = Boolean(capture.paid || subscriptionPaying);
      const resolvedStage = paidEffective ? 'won' : baseStage;

      const uid = em ? userIdByEmailLower.get(em) : undefined;
      const revenue = uid != null ? revenueByUserId.get(uid) ?? 0 : 0;

      return {
        id: capture.id,
        name: capture.name || crmLead?.name || null,
        email: capture.email,
        source: capture.source,
        resource: capture.resource,
        createdAt: capture.createdAt,
        stage: resolvedStage,
        value: crmLead?.value || 0,
        convertedToCrmAt: capture.convertedToCrmAt,
        paid: paidEffective,
        paidFromCapture: capture.paid,
        convertedToPaidAt: capture.convertedToPaidAt,
        plan: subRow?.plan ?? null,
        subscriptionStatus: subRow?.status ?? null,
        revenue,
        attribution: attributionForTracker(capture.trackerId, attributionByTrackerId),
      };
    });

    console.log('[admin/stats] before building funnel summary object');
    const funnelSummary = {
      captured: leadCaptureTotal,
      convertedToCrm: leadCaptureConvertedCount,
      qualified: crmLeads.filter((lead) => ['qualified', 'proposal', 'won'].includes(lead.stage)).length,
      won: funnelWonCount,
      recent: recentFunnelLeads.slice(0, 8),
      conversions: funnelConversions,
    };
    console.log('[admin/stats] funnel summary', {
      captured: funnelSummary.captured,
      convertedToCrm: funnelSummary.convertedToCrm,
      qualified: funnelSummary.qualified,
      won: funnelSummary.won,
      conversionsLen: funnelSummary.conversions.length,
    });

    const conversionAutomation = {
      needsSalesFollowupCount,
      /** LeadCapture con `paid: true` (excluidos de follow-up comercial por bandera de pago). */
      paidLeadCapturesExcludedCount,
      onboardingStartedUsersCount,
      followupQueue: followupQueueSample.map((row) => ({
        id: row.id,
        email: row.email,
        createdAt: safeDateToISO(row.createdAt),
        salesFollowupMarkedAt: safeDateToISO(row.salesFollowupMarkedAt),
        salesRecoveryFollowupSentAt: safeDateToISO(row.salesRecoveryFollowupSentAt),
        paid: row.paid,
      })),
    };

    console.log('[admin/stats] before return 200');
    return NextResponse.json({
      stats: {
        totalUsers: users.length,
        activeSubscriptions,
        totalRevenue,
        monthlyRevenue,
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
        recentUsers: users.slice(0, 5),
        recentPayments: invoices.filter((invoice) => invoice.status === 'paid').slice(0, 5),
        mrr: calculateMrr(subscriptions),
        healthScore,
        alerts,
        automationPlays,
        paymentReadiness: {
          stripe: paymentReady,
          webhookStored: Boolean(paymentSettings?.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET),
        },
        emailReadiness: emailCenter,
        platformDistribution: platformDistributionMap,
        funnel: funnelSummary,
        business,
        conversionAutomation,
      },
    });
  } catch (error) {
    const err = error as Error & { code?: string; meta?: unknown };
    console.error('[admin/stats] catch — full error', error);
    console.error('[admin/stats] catch — details', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
      prismaCode: err?.code,
      prismaMeta: err?.meta,
    });
    return NextResponse.json({ error: 'Error fetching statistics' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';
import {
  buildAdminAlerts,
  buildAutomationPlays,
  buildEmailCenterSummary,
  calculateHealthScore,
} from '@/lib/admin-ops';
import { divRoundHalfUp, minorToString } from '@/lib/billing/money';
import { collectedForUser, collectedScope, summarizePlatformRevenue } from '@/lib/billing/revenue-metrics';
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
          stripeStatus: true,
          billingInterval: true,
          billingIntervalCount: true,
          recurringAmountMinor: true,
          currency: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          amount: true,
          amountMinor: true,
          currency: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);
    const [campaigns, paymentSettings] = await Promise.all([
      prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
        include: { analytics: true },
      }),
      prisma.paymentSettings.findFirst({
        orderBy: { createdAt: 'asc' },
      }),
    ]);
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
      // Point 8B-4 intentional platform-admin exception: global CrmLead aggregate.
      // Not a tenant-facing CRM read — do NOT convert to organizationId scoping here.
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
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active').length;
    const pendingInvoiceCount = await prisma.pendingStripeInvoice.count();
    const revenueSnapshot = summarizePlatformRevenue({
      subscriptions,
      invoices,
      pendingInvoiceCount,
    });

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
    const attributionByTrackerId = buildAttributionByTrackerId(attributionSessions);

    const userIdByEmailLower = new Map<string, string>();
    for (const u of users) {
      const ek = safeNormEmail(u.email);
      if (!ek) continue;
      userIdByEmailLower.set(ek, u.id);
    }
    const invoicesByUserId = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      const list = invoicesByUserId.get(inv.userId) ?? [];
      list.push(inv);
      invoicesByUserId.set(inv.userId, list);
    }
    const collected = collectedScope(invoices);

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
      collected.status === 'ok' && collected.currency && leadCaptureTotal > 0
        ? {
            amountMinor: minorToString(divRoundHalfUp(collected.totalMinor, BigInt(leadCaptureTotal))),
            currency: collected.currency,
            exponent: collected.exponent,
          }
        : null;

    /** Ingresos facturados (paid) por plan. Solo si todas las facturas pagadas comparten moneda y amountMinor. */
    const revenueByPlanAgg = new Map<string, { plan: string; amountMinor: bigint; count: number }>();
    if (collected.status === 'ok' && collected.currency) {
      for (const [userId, amountMinor] of collected.byUserId) {
        const sub = subscriptions.find((s) => s.userId === userId);
        const plan = (sub?.plan && String(sub.plan).trim()) || 'unknown';
        const cur = revenueByPlanAgg.get(plan) ?? { plan, amountMinor: 0n, count: 0 };
        cur.amountMinor += amountMinor;
        cur.count += 1;
        revenueByPlanAgg.set(plan, cur);
      }
    }
    const revenueByPlan = [...revenueByPlanAgg.values()]
      .map((row) => ({
        plan: row.plan,
        amountMinor: minorToString(row.amountMinor),
        currency: collected.currency,
        exponent: collected.exponent,
        count: row.count,
      }))
      .sort((a, b) => {
        const left = BigInt(a.amountMinor);
        const right = BigInt(b.amountMinor);
        if (left === right) return 0;
        return left < right ? 1 : -1;
      });

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
      { source: string; campaign: string; leads: Set<string>; conversions: Set<string>; amountMinor: bigint }
    >();
    const touchKey = (source: string, campaign: string) => `${source}\t${campaign}`;
    const ensureBucket = (source: string, campaign: string) => {
      const k = touchKey(source, campaign);
      let b = sourceMetrics.get(k);
      if (!b) {
        b = { source, campaign, leads: new Set(), conversions: new Set(), amountMinor: 0n };
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

    if (collected.status === 'ok') {
      for (const u of users) {
        const rev = collected.byUserId.get(u.id);
        if (rev == null) continue;
        const ek = safeNormEmail(u.email);
        if (!ek) continue;
        const k = firstTouchBucketByEmail.get(ek) ?? touchKey('(none)', '(none)');
        const b = sourceMetrics.get(k) ?? ensureBucket('(none)', '(none)');
        b.amountMinor += rev;
      }
    }

    const revenueBySource = [...sourceMetrics.values()]
      .map((b) => ({
        source: b.source,
        campaign: b.campaign,
        amountMinor: collected.status === 'ok' ? minorToString(b.amountMinor) : null,
        currency: collected.status === 'ok' ? collected.currency : null,
        exponent: collected.status === 'ok' ? collected.exponent : null,
        leads: b.leads.size,
        conversions: b.conversions.size,
      }))
      .sort((a, b) => {
        if (a.amountMinor != null && b.amountMinor != null) {
          const left = BigInt(a.amountMinor);
          const right = BigInt(b.amountMinor);
          if (left !== right) return left < right ? 1 : -1;
        }
        return b.leads - a.leads;
      });

    const business = {
      conversionRate,
      collectedStatus: collected.status,
      revenuePerLead,
      revenueByPlan,
      revenueBySource,
    };

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
      const userCollected = uid ? collectedForUser(invoicesByUserId.get(uid) ?? []) : { status: 'none' as const };
      const revenue =
        userCollected.status === 'verified'
          ? {
              amountMinor: minorToString(userCollected.amountMinor),
              currency: userCollected.currency,
              exponent: userCollected.exponent,
            }
          : null;

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

    const funnelSummary = {
      captured: leadCaptureTotal,
      convertedToCrm: leadCaptureConvertedCount,
      qualified: crmLeads.filter((lead) => ['qualified', 'proposal', 'won'].includes(lead.stage)).length,
      won: funnelWonCount,
      recent: recentFunnelLeads.slice(0, 8),
      conversions: funnelConversions,
    };
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

    return NextResponse.json({
      stats: {
        totalUsers: users.length,
        activeSubscriptions,
        totalRevenue: null,
        monthlyRevenue: null,
        mrr: null,
        churnRate: null,
        trialToPaid: null,
        mrrByCurrency: revenueSnapshot.mrrByCurrency,
        arrByCurrency: revenueSnapshot.arrByCurrency,
        collectedByCurrency: revenueSnapshot.collectedByCurrency,
        monthlyCollectedByCurrency: revenueSnapshot.monthlyCollectedByCurrency,
        excludedFromMrr: revenueSnapshot.excludedFromMrr,
        legacyInvoiceCount: revenueSnapshot.legacyInvoiceCount,
        monthlyLegacyInvoiceCount: revenueSnapshot.monthlyLegacyInvoiceCount,
        pendingInvoiceCount: revenueSnapshot.pendingInvoiceCount,
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
        recentUsers: users.slice(0, 5),
        recentPayments: invoices
          .filter((invoice) => invoice.status === 'paid')
          .slice(0, 5)
          .map((invoice) => ({
            id: invoice.id,
            userId: invoice.userId,
            status: invoice.status,
            createdAt: invoice.createdAt,
            currency: invoice.currency,
            amount: invoice.amountMinor == null ? invoice.amount : null,
            amountMinor: invoice.amountMinor == null ? null : invoice.amountMinor.toString(),
          })),
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

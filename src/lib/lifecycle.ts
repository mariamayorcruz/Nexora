/**
 * Motor de campañas de ciclo de vida:
 *  - no_purchase: al que fue contactado y no compró
 *  - post_purchase: al que sí compró (agradecimiento y novedades)
 *  - birthday: saludo de cumpleaños con cupón de descuento
 *
 * Corre una vez al día, por lotes acotados, con bloqueo de ejecución única y
 * marca de envío idempotente (un mensaje por lead, tipo y día).
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';
import { normalizePhone, sendWhatsAppText } from '@/lib/whatsapp';

export type LifecycleKind = 'no_purchase' | 'post_purchase' | 'birthday';

export const LIFECYCLE_KINDS: LifecycleKind[] = ['no_purchase', 'post_purchase', 'birthday'];

export const DEFAULT_TEMPLATES: Record<LifecycleKind, string> = {
  no_purchase:
    '¡Hola {{nombre}}! Te escribimos de {{negocio}} 👋 Quedamos con ganas de ayudarte. Tenemos novedades que te pueden servir, ¿te cuento?',
  post_purchase:
    '¡Hola {{nombre}}! Gracias por confiar en {{negocio}} 🙌 ¿Cómo te ha ido? Te dejamos las novedades de este mes por si te sirven.',
  birthday:
    '¡Feliz cumpleaños {{nombre}}! 🎉 En {{negocio}} queremos celebrarlo contigo: {{descuento}}% de descuento con el código {{cupon}}, válido hasta el {{vence}}.',
};

export interface LifecycleRunResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
  tenants: number;
}

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function renderTemplate(
  template: string,
  values: { nombre: string; negocio: string; descuento?: string; cupon?: string; vence?: string }
): string {
  const firstName = values.nombre.trim().split(/\s+/)[0] || '';
  return template
    .replaceAll('{{nombre}}', firstName)
    .replaceAll('{{name}}', firstName)
    .replaceAll('{{negocio}}', values.negocio)
    .replaceAll('{{business}}', values.negocio)
    .replaceAll('{{descuento}}', values.descuento || '')
    .replaceAll('{{cupon}}', values.cupon || '')
    .replaceAll('{{vence}}', values.vence || '');
}

function localDate(timezone: string): { month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { month: get('month'), day: get('day'), hour: get('hour') };
}

async function ensureRules(userId: string) {
  const existing = await prisma.lifecycleRule.findMany({ where: { userId } });
  const missing = LIFECYCLE_KINDS.filter((kind) => !existing.some((rule) => rule.kind === kind));
  if (missing.length) {
    await prisma.lifecycleRule.createMany({
      data: missing.map((kind) => ({
        userId,
        kind,
        enabled: kind !== 'no_purchase' ? true : true,
        delayDays: kind === 'post_purchase' ? 7 : 3,
        intervalDays: kind === 'birthday' ? 0 : 30,
        maxSends: kind === 'birthday' ? 1 : 6,
        template: DEFAULT_TEMPLATES[kind],
        discountPercent: kind === 'birthday' ? 15 : 0,
      })),
      skipDuplicates: true,
    });
    return prisma.lifecycleRule.findMany({ where: { userId } });
  }
  return existing;
}

async function createBirthdayCoupon(userId: string, leadId: string, percentOff: number, validDays: number) {
  const code = `CUMPLE-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
  const coupon = await prisma.coupon.create({
    data: { userId, leadId, code, percentOff, reason: 'birthday', expiresAt },
  });
  return coupon;
}

/** Procesa un tenant. Devuelve cuántos mensajes salieron. */
async function runForTenant(userId: string, batchSize: number): Promise<LifecycleRunResult> {
  const result: LifecycleRunResult = { processed: 0, sent: 0, skipped: 0, errors: 0, tenants: 1 };

  const config = await prisma.tenantAutomationConfig.findUnique({ where: { userId } });
  if (!config || !config.automationActive || !config.whatsappConnected) {
    result.skipped += 1;
    return result;
  }

  const accessToken = decryptSecret(config.whatsappAccessToken);
  const phoneNumberId = config.whatsappPhoneNumberId?.trim();
  if (!accessToken || !phoneNumberId) {
    result.skipped += 1;
    return result;
  }

  const rules = await ensureRules(userId);
  const today = dayKey();
  const { month, day, hour } = localDate(config.timezone);
  const businessName = config.businessName || 'nuestro negocio';

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (hour < rule.sendHour) continue; // aún no es la hora local de envío
    if (result.sent >= batchSize) break;

    const cutoff = new Date(Date.now() - rule.delayDays * 24 * 60 * 60 * 1000);
    const buyerLeadIds = (
      await prisma.order.findMany({
        where: { userId, status: 'paid', leadId: { not: null } },
        select: { leadId: true },
        take: 5000,
      })
    )
      .map((order) => order.leadId)
      .filter((id): id is string => Boolean(id));

    let leads: Array<{ id: string; name: string; phone: string | null }> = [];

    if (rule.kind === 'birthday') {
      const candidates = await prisma.crmLead.findMany({
        where: { userId, optOut: false, lifecyclePausedAt: null, birthDate: { not: null }, phone: { not: null } },
        select: { id: true, name: true, phone: true, birthDate: true },
        take: 2000,
      });
      leads = candidates
        .filter((lead) => {
          const date = lead.birthDate as Date | null;
          if (!date) return false;
          return date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
        })
        .slice(0, batchSize);
    } else {
      const wantsBuyers = rule.kind === 'post_purchase';
      leads = await prisma.crmLead.findMany({
        where: {
          userId,
          optOut: false,
          lifecyclePausedAt: null,
          phone: { not: null },
          lastContactedAt: { lt: cutoff },
          id: wantsBuyers ? { in: buyerLeadIds } : { notIn: buyerLeadIds },
        },
        select: { id: true, name: true, phone: true },
        orderBy: { lastContactedAt: 'asc' },
        take: batchSize,
      });
    }

    for (const lead of leads) {
      if (result.sent >= batchSize) break;
      result.processed += 1;

      const phone = normalizePhone(lead.phone);
      if (!phone) {
        result.skipped += 1;
        continue;
      }

      // Tope: nunca dos mensajes de ciclo de vida al mismo contacto el mismo día.
      const alreadyToday = await prisma.lifecycleSend.findFirst({
        where: { leadId: lead.id, sentOn: today },
      });
      if (alreadyToday) {
        result.skipped += 1;
        continue;
      }

      const totalSends = await prisma.lifecycleSend.count({ where: { leadId: lead.id, kind: rule.kind, ok: true } });
      if (rule.maxSends > 0 && totalSends >= rule.maxSends) {
        result.skipped += 1;
        continue;
      }

      let coupon: { code: string; percentOff: number; expiresAt: Date } | null = null;
      if (rule.kind === 'birthday' && rule.discountPercent > 0) {
        coupon = await createBirthdayCoupon(userId, lead.id, rule.discountPercent, rule.couponValidDays);
      }

      const body = renderTemplate(rule.template || DEFAULT_TEMPLATES[rule.kind as LifecycleKind], {
        nombre: lead.name,
        negocio: businessName,
        descuento: coupon ? String(coupon.percentOff) : '',
        cupon: coupon?.code || '',
        vence: coupon ? coupon.expiresAt.toLocaleDateString('es-CL') : '',
      });

      // Marca de idempotencia antes de enviar: si dos ejecuciones coinciden, solo una envía.
      try {
        await prisma.lifecycleSend.create({
          data: { userId, leadId: lead.id, kind: rule.kind, sentOn: today, ok: true },
        });
      } catch {
        result.skipped += 1;
        continue;
      }

      const sent = await sendWhatsAppText({ phoneNumberId, accessToken, to: phone, body });
      if (sent.ok) {
        result.sent += 1;
        await prisma.crmLead.update({ where: { id: lead.id }, data: { lastContactedAt: new Date() } });
      } else {
        result.errors += 1;
        await prisma.lifecycleSend.updateMany({
          where: { leadId: lead.id, kind: rule.kind, sentOn: today },
          data: { ok: false, error: sent.error || 'error desconocido' },
        });
      }
    }
  }

  return result;
}

export async function runLifecycleCampaigns(options?: {
  batchSize?: number;
  tenantLimit?: number;
}): Promise<LifecycleRunResult> {
  const batchSize = options?.batchSize ?? 100;
  const tenantLimit = options?.tenantLimit ?? 50;

  const configs = await prisma.tenantAutomationConfig.findMany({
    where: { automationActive: true, whatsappConnected: true },
    select: { userId: true },
    take: tenantLimit,
  });

  const total: LifecycleRunResult = { processed: 0, sent: 0, skipped: 0, errors: 0, tenants: 0 };

  for (const config of configs) {
    try {
      const partial = await runForTenant(config.userId, batchSize);
      total.processed += partial.processed;
      total.sent += partial.sent;
      total.skipped += partial.skipped;
      total.errors += partial.errors;
      total.tenants += 1;
    } catch (error) {
      total.errors += 1;
      console.error('[lifecycle] error procesando tenant', config.userId, error);
    }
  }

  return total;
}

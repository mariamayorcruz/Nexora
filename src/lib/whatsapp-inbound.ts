import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';
import { normalizePhone, sendWhatsAppText } from '@/lib/whatsapp';
import { needsHumanEscalation, runSalesAgent, type AgentTurn } from '@/lib/ai-sales-agent';
import { createCheckoutLink } from '@/lib/checkout';
import { formatMoney } from '@/lib/pricing';

export interface InboundMessage {
  phoneNumberId: string;
  from: string;
  text: string;
  waMessageId?: string;
  profileName?: string;
}

function withinBusinessHours(start: number, end: number, timezone: string): boolean {
  try {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(new Date())
    );
    if (!Number.isFinite(hour)) return true;
    if (start === end) return true;
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
  } catch {
    return true;
  }
}

/**
 * Procesa un mensaje entrante de WhatsApp: guarda la conversación, decide con
 * el asistente y responde. Si el cliente quiere comprar, manda el link de pago.
 */
export async function handleInboundWhatsApp(message: InboundMessage): Promise<{ ok: boolean; reason?: string }> {
  const phone = normalizePhone(message.from);
  if (!phone || !message.text.trim()) return { ok: false, reason: 'mensaje vacío' };

  const config = await prisma.tenantAutomationConfig.findFirst({
    where: { whatsappPhoneNumberId: message.phoneNumberId },
  });
  if (!config) return { ok: false, reason: 'número no registrado' };

  const accessToken = decryptSecret(config.whatsappAccessToken);
  if (!accessToken || !config.whatsappPhoneNumberId) return { ok: false, reason: 'sin credenciales' };

  const userId = config.userId;

  // Lead + conversación
  let lead = await prisma.crmLead.findFirst({ where: { userId, phone } });
  if (!lead) {
    lead = await prisma.crmLead.create({
      data: {
        userId,
        name: message.profileName?.trim() || `WhatsApp ${phone.slice(-4)}`,
        phone,
        source: 'whatsapp',
        status: 'nuevo',
        country: config.country,
      },
    });
  }

  const conversation = await prisma.waConversation.upsert({
    where: { userId_phone: { userId, phone } },
    update: { lastInboundAt: new Date(), leadId: lead.id },
    create: { userId, phone, leadId: lead.id, lastInboundAt: new Date() },
  });

  await prisma.waMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'inbound',
      body: message.text.slice(0, 4000),
      waMessageId: message.waMessageId || null,
    },
  });

  if (!config.automationActive || !config.aiAutoReply || conversation.aiPaused) {
    return { ok: true, reason: 'asistente en pausa' };
  }
  if (lead.optOut) return { ok: true, reason: 'el contacto pidió no recibir mensajes' };
  if (!withinBusinessHours(config.businessHoursStart, config.businessHoursEnd, config.timezone)) {
    return { ok: true, reason: 'fuera de horario' };
  }

  // Escalamiento inmediato por palabra clave
  if (needsHumanEscalation(message.text, config.escalationKeywords)) {
    await prisma.waConversation.update({ where: { id: conversation.id }, data: { aiPaused: true, state: 'human' } });
    await prisma.crmLead.update({ where: { id: lead.id }, data: { status: 'requiere-atencion' } });
  }

  const [products, history] = await Promise.all([
    prisma.product.findMany({ where: { userId, active: true }, take: 40 }),
    prisma.waMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 40,
    }),
  ]);

  const turns: AgentTurn[] = history.map((item) => ({
    role: item.direction === 'inbound' ? 'customer' : 'business',
    content: item.body,
  }));

  const decision = await runSalesAgent({
    businessName: config.businessName || 'nuestro negocio',
    tone: config.aiTone,
    language: config.language,
    qualificationPrompt: config.qualificationPrompt,
    customerName: lead.name,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
    })),
    history: turns,
  });

  let body = decision.reply;

  if (decision.action === 'charge' && config.aiCanClose && decision.productId) {
    const product = products.find((p) => p.id === decision.productId);
    const checkout = await createCheckoutLink({ userId, productId: decision.productId, leadId: lead.id });
    if (checkout.ok && checkout.url) {
      const priceText = product ? formatMoney(product.price, product.currency) : '';
      body = `${body}\n\nAquí tienes tu link de pago${priceText ? ` (${priceText})` : ''}:\n${checkout.url}`;
      await prisma.crmLead.update({ where: { id: lead.id }, data: { status: 'propuesta', stage: 'proposal' } });
    } else {
      console.error('[whatsapp-inbound] no se pudo crear el link de pago:', checkout.error);
    }
  }

  if (decision.action === 'escalate') {
    await prisma.waConversation.update({ where: { id: conversation.id }, data: { aiPaused: true, state: 'human' } });
  }

  const sent = await sendWhatsAppText({
    phoneNumberId: config.whatsappPhoneNumberId,
    accessToken,
    to: phone,
    body,
  });

  await prisma.waMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'outbound',
      body,
      waMessageId: sent.messageId || null,
    },
  });

  await prisma.waConversation.update({
    where: { id: conversation.id },
    data: { lastOutboundAt: new Date() },
  });

  await prisma.crmLead.update({
    where: { id: lead.id },
    data: {
      lastContactedAt: new Date(),
      confidence: decision.temperature === 'hot' ? 80 : decision.temperature === 'warm' ? 50 : 25,
    },
  });

  return { ok: sent.ok, reason: sent.error };
}

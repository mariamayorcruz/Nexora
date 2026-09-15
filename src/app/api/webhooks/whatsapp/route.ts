import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { handleInboundWhatsApp } from '@/lib/whatsapp-inbound';

export const dynamic = 'force-dynamic';

/** Verifica la firma X-Hub-Signature-256 de Meta contra el cuerpo crudo. */
function verifyMetaSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signature) return false;

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (
    verifyToken &&
    params.get('hub.mode') === 'subscribe' &&
    params.get('hub.verify_token') === verifyToken
  ) {
    return new NextResponse(params.get('hub.challenge') || '', { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
        }>;
      };
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifyMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: WhatsAppWebhookBody;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      for (const message of value?.messages || []) {
        const text =
          message.text?.body ||
          message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.title ||
          message.button?.text ||
          '';
        if (!message.from || !text) continue;

        try {
          await handleInboundWhatsApp({
            phoneNumberId,
            from: message.from,
            text,
            waMessageId: message.id,
            profileName: value?.contacts?.[0]?.profile?.name,
          });
        } catch (error) {
          console.error('[webhooks/whatsapp] error procesando mensaje', error);
        }
      }
    }
  }

  // Meta reintenta si no recibe 200 rápido.
  return NextResponse.json({ received: true });
}

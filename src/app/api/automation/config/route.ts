import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const stringFields = [
  'whatsappPhoneNumberId',
  'whatsappAccessToken',
  'metaAdsAccountId',
  'metaAdsToken',
  'openPhoneApiKey',
  'openPhoneNumberId',
  'businessName',
  'welcomeMessage',
  'qualificationPrompt',
  'n8nWebhookUrl',
] as const;

const booleanFields = [
  'whatsappConnected',
  'metaConnected',
  'openPhoneConnected',
  'instagramConnected',
  'automationActive',
] as const;

const aiTones = new Set(['professional', 'casual', 'aggressive']);
const languages = new Set(['es', 'en', 'both']);
const leadActions = new Set(['notify', 'close', 'escalate', 'sequence']);

async function resolveSupabaseUserId(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  const userById = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: { id: true },
  });

  if (userById) {
    return userById.id;
  }

  if (data.user.email) {
    const userByEmail = await prisma.user.findUnique({
      where: { email: data.user.email },
      select: { id: true },
    });

    return userByEmail?.id || null;
  }

  return null;
}

async function getAuthenticatedUserId(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'));

  if (!token) {
    return null;
  }

  const supabaseUserId = await resolveSupabaseUserId(token);
  if (supabaseUserId) {
    return supabaseUserId;
  }

  return verifyUserToken(token)?.userId || null;
}

function normalizeOptionalString(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeConfigPayload(body: Record<string, unknown>) {
  const data: Record<string, string | number | boolean | null> = {};

  for (const field of stringFields) {
    if (field in body) {
      const value = normalizeOptionalString(body[field]);
      if (value !== undefined) {
        data[field] = value;
      }
    }
  }

  for (const field of booleanFields) {
    if (field in body && typeof body[field] === 'boolean') {
      data[field] = body[field];
    }
  }

  if (typeof body.aiTone === 'string' && aiTones.has(body.aiTone)) {
    data.aiTone = body.aiTone;
  }

  if (typeof body.language === 'string' && languages.has(body.language)) {
    data.language = body.language;
  }

  if (typeof body.hotLeadAction === 'string' && leadActions.has(body.hotLeadAction)) {
    data.hotLeadAction = body.hotLeadAction;
  }

  if (typeof body.warmLeadAction === 'string' && leadActions.has(body.warmLeadAction)) {
    data.warmLeadAction = body.warmLeadAction;
  }

  if (typeof body.coldLeadAction === 'string' && leadActions.has(body.coldLeadAction)) {
    data.coldLeadAction = body.coldLeadAction;
  }

  if (typeof body.followupDays === 'number' && Number.isInteger(body.followupDays) && body.followupDays >= 0) {
    data.followupDays = body.followupDays;
  }

  return data;
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await prisma.tenantAutomationConfig.findUnique({
    where: { userId },
  });

  return NextResponse.json({ config });
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const data = sanitizeConfigPayload(body as Record<string, unknown>);

  const config = await prisma.tenantAutomationConfig.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
  });

  return NextResponse.json({ config });
}

import { NextRequest, NextResponse } from 'next/server';
import { runRealtimeIaAutomation } from '@/lib/automation/ia-meta-automation';
import { verifyAdmin } from '@/lib/admin';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';
import { getIaAutomationConfig, saveIaAutomationConfig } from '@/lib/admin-config';

export const dynamic = 'force-dynamic';

/**
 * GET — platform/global Meta IA automation config (AdminWorkspaceConfig).
 * Requires verifyAdmin (SEC-04).
 */
export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const config = await getIaAutomationConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching IA automation config:', error);
    return NextResponse.json({ error: 'Error obteniendo configuracion IA' }, { status: 500 });
  }
}

/**
 * POST — writes platform/global Meta IA automation config.
 * Requires verifyAdmin (SEC-04).
 */
export async function POST(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const body = await request.json();
    const enabled = body?.enabled;
    const mode = body?.mode;
    const provider = body?.provider;
    const maxMonthlyBudget = body?.maxMonthlyBudget;

    const validModes = new Set(['auto', 'semi']);
    const validProviders = new Set(['claude', 'gemini', 'openrouter', 'grok', 'all']);

    if (
      typeof enabled !== 'boolean' ||
      typeof maxMonthlyBudget !== 'number' ||
      !validModes.has(mode) ||
      !validProviders.has(provider)
    ) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    await saveIaAutomationConfig({
      enabled,
      mode,
      provider,
      maxMonthlyBudget,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving IA automation config:', error);
    return NextResponse.json({ error: 'Error configurando automatización' }, { status: 500 });
  }
}

/**
 * PUT — tenant-scoped realtime IA run for the authenticated user only.
 * Does not modify AdminWorkspaceConfig. Uses platform config server-side as
 * read-only input via getIaAutomationConfig(). Preserves authenticated-user
 * access (SEC-04 decision: not an admin-only write of global settings).
 */
export async function PUT(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = verifyUserToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await runRealtimeIaAutomation(decoded.userId);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error running IA automation:', error);
    return NextResponse.json({ error: 'Error ejecutando automatización' }, { status: 500 });
  }
}

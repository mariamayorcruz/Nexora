import { NextRequest, NextResponse } from 'next/server';
import { ollamaGenerate } from '@/lib/automation/ia-ollama';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

/**
 * SEC-05: Authenticated user-scoped Ollama proxy.
 * Does not read/write platform AdminWorkspaceConfig or accept a client-supplied userId.
 * Requires a valid JWT; not anonymous.
 */
export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyUserToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const model = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : 'llama2';

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt requerido' }, { status: 400 });
    }

    // Ignore any client-supplied userId — identity comes only from the verified token.
    const result = await ollamaGenerate(prompt, model);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Ollama automation error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Ollama is unavailable or the request could not be completed.' },
      { status: 503 }
    );
  }
}

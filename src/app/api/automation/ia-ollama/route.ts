import { NextRequest, NextResponse } from 'next/server';
import { ollamaGenerate } from '@/lib/automation/ia-ollama';

export async function POST(req: NextRequest) {
  try {
    const { prompt, model } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt requerido' }, { status: 400 });
    const result = await ollamaGenerate(prompt, model);
    return NextResponse.json({ result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error en Ollama' }, { status: 500 });
  }
}

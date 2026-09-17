/**
 * Local Ollama helper. Used only by authenticated API routes.
 * Does not log prompts or internal host details to clients.
 */
export async function ollamaGenerate(prompt: string, model: string = 'llama2'): Promise<string> {
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!response.ok) {
    throw new Error('Ollama request failed');
  }

  const data = (await response.json().catch(() => null)) as { response?: string } | null;
  return String(data?.response || '');
}

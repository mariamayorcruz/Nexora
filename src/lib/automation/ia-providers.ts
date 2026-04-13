// Añade en tu UI de selección de IA este proveedor:
export const IA_PROVIDERS = [
  // ...otros proveedores,
  { id: 'ollama', label: 'Ollama (local)', api: '/api/automation/ia-ollama' },
];

// Ejemplo de función para llamar a Ollama desde el frontend:
export async function generateWithOllama(prompt: string, model: string = 'llama2'): Promise<string> {
  const res = await fetch('/api/automation/ia-ollama', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model })
  });
  if (!res.ok) throw new Error('Error en Ollama');
  const data = await res.json();
  return data.result || '';
}

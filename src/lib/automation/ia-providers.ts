// Añade en tu UI de selección de IA este proveedor:
export const IA_PROVIDERS = [
  // ...otros proveedores,
  { id: 'ollama', label: 'Ollama (local)', api: '/api/automation/ia-ollama' },
];

// Ejemplo de función para llamar a Ollama desde el frontend (requiere JWT):
export async function generateWithOllama(prompt: string, model: string = 'llama2'): Promise<string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch('/api/automation/ia-ollama', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, model }),
  });
  if (!res.ok) throw new Error('Error en Ollama');
  const data = await res.json();
  return data.result || '';
}

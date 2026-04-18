/**
 * Envía un prompt a Ollama (servidor local) y retorna la respuesta generada.
 * @param {string} prompt - Texto a enviar al modelo.
 * @param {string} [model="llama2"] - Nombre del modelo Ollama (ej: "llama2", "mistral", etc).
 * @returns {Promise<string>} - Respuesta generada por el modelo.
 */
export async function ollamaGenerate(prompt: string, model: string = "llama2"): Promise<string> {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.response || '';
}

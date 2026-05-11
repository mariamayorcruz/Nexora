export async function generateImageWithGemini(prompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const descResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Eres un director de arte para campañas de marketing. 
Describe en español la imagen perfecta para esta campaña publicitaria.
Campaña: ${prompt}
Responde SOLO con este JSON exacto, sin markdown ni texto adicional:
{"description":"descripción visual detallada de la imagen en 2-3 oraciones","style":"estilo fotográfico","colors":"paleta de colores principal","mood":"tono emocional","elements":"elementos visuales clave separados por coma"}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 400,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!descResponse.ok) {
      const err = await descResponse.json().catch(() => ({}));
      console.error('[image-gen] Gemini error:', descResponse.status, JSON.stringify(err));
      return null;
    }

    const descData = await descResponse.json();
    const text = descData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return `__gemini_description__${JSON.stringify(parsed)}`;
  } catch (error) {
    console.error('[image-gen] Error:', error);
    return null;
  }
}

export function buildImagePrompt(params: {
  goal: string;
  offer: string;
  audience: string;
  style: string;
  businessName?: string;
}): string {
  const styleMap: Record<string, string> = {
    Corporativo: 'professional, clean, corporate, minimalist, business environment',
    Premium: 'luxury, premium, elegant, high-end, sophisticated, aspirational',
    Cercano: 'warm, friendly, approachable, human, authentic, real people',
    Urgente: 'bold, high contrast, dynamic, energetic, striking, attention-grabbing',
  };

  const styleDesc = styleMap[params.style] || 'professional, modern';
  const business = params.businessName || 'the business';

  return `Create a professional marketing advertisement image for ${business}. 
Goal: ${params.goal}. 
Target audience: ${params.audience}. 
Service/Product: ${params.offer}. 
Visual style: ${styleDesc}. 
Requirements: High quality commercial photography or illustration, no text overlays, no logos, clean composition, suitable for Instagram and Facebook advertising, 1:1 square format.`;
}

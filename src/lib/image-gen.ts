export async function generateImageWithGemini(prompt: string): Promise<string | null> {
  const falResult = await generateImageWithFal(prompt);
  if (falResult) return falResult;

  return generateVisualDescriptionWithGemini(prompt);
}

async function generateImageWithFal(prompt: string): Promise<string | null> {
  try {
    const falKey = process.env.FAL_KEY;
    if (!falKey) return null;

    const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square_hd',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[image-gen] fal.ai error:', response.status, JSON.stringify(err));
      return null;
    }

    const data = await response.json();
    const imageUrl = data?.images?.[0]?.url;
    if (!imageUrl) return null;

    console.log('[image-gen] fal.ai image generated:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.error('[image-gen] fal.ai error:', error);
    return null;
  }
}

async function generateVisualDescriptionWithGemini(prompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const response = await fetch(
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

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return `__gemini_description__${JSON.stringify(parsed)}`;
  } catch (error) {
    console.error('[image-gen] Gemini fallback error:', error);
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
    Corporativo: 'professional, clean, corporate, minimalist, business environment, modern office',
    Premium: 'luxury, premium, elegant, high-end, sophisticated, aspirational lifestyle',
    Cercano: 'warm, friendly, approachable, human, authentic, real people smiling',
    Urgente: 'bold, high contrast, dynamic, energetic, striking, attention-grabbing',
  };

  const styleDesc = styleMap[params.style] || 'professional, modern';
  const business = params.businessName || 'the business';

  return `Professional marketing advertisement image for ${business}. ${params.goal}. Target: ${params.audience}. Service: ${params.offer}. Style: ${styleDesc}. High quality commercial photography, no text overlays, no logos, clean composition, square format, suitable for Instagram advertising.`;
}

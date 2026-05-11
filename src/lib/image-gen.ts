export async function generateImageWithGemini(prompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[image-gen] GEMINI_API_KEY no configurada');
      return null;
    }

    const imageResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      }
    );

    if (imageResponse.ok) {
      const data = await imageResponse.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

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
                  text: `You are a visual director. Describe the perfect marketing image for this campaign in JSON format only, no markdown.
              Campaign: ${prompt}
              Return exactly this JSON structure:
              {"description": "detailed visual description in Spanish", "style": "photography style", "colors": "main colors palette", "mood": "emotional tone"}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
        }),
      }
    );

    if (!descResponse.ok) return null;

    const descData = await descResponse.json();
    const text = descData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

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

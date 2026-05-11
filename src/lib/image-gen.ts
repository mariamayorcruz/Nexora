export async function generateImageWithGemini(prompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Describe in detail the perfect marketing image for this campaign: ${prompt}. Be specific about: composition, colors, subjects, lighting, mood. Format: Return ONLY a JSON with this structure: {"description": "detailed visual description", "style": "photography style", "colors": "main colors", "mood": "emotional tone"}`,
            }],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
    Corporativo: 'professional, clean, corporate, minimalist, business',
    Premium: 'luxury, premium, elegant, high-end, sophisticated',
    Cercano: 'warm, friendly, approachable, human, authentic',
    Urgente: 'bold, urgent, high contrast, dynamic, energetic',
  };

  const styleDesc = styleMap[params.style] || 'professional, modern';
  const business = params.businessName || 'the business';

  return `Professional marketing image for ${business}. ${params.goal}. Target audience: ${params.audience}. Service: ${params.offer}. Style: ${styleDesc}. High quality commercial photography, no text, no logos, clean composition, suitable for social media advertising.`;
}

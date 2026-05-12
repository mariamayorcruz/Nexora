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
        num_inference_steps: 8,
        num_images: 1,
        enable_safety_checker: true,
        negative_prompt: 'text, words, letters, typography, watermark, logo, banner, sign, label, caption, title, heading, writing, font, alphabet, numbers, digits, characters, blurry, low quality, distorted',
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
    Corporativo: 'professional corporate photography, clean modern environment, business professionals at work',
    Premium: 'luxury premium photography, elegant upscale setting, sophisticated and aspirational',
    Cercano: 'warm friendly photography, real people, authentic human moments, approachable and genuine',
    Urgente: 'bold dramatic photography, high contrast, dynamic action, energetic and striking',
  };

  const styleDesc = styleMap[params.style] || 'professional modern commercial photography';
  const combined = `${params.offer} ${params.goal} ${params.audience}`.toLowerCase();

  let serviceScene = '';

  if (combined.match(/limpi|clean|aseo|janitorial|maid|housekeep/)) {
    serviceScene = 'spotless clean professional space, cleaning professionals in uniform, gleaming surfaces, organized pristine environment';
  } else if (combined.match(/dental|dent|odontolog|clinic|salud|health|medical|médic/)) {
    serviceScene = 'modern medical clinic, healthcare professionals, clean sterile environment, patients being cared for';
  } else if (combined.match(/gym|fitness|entrena|workout|sport|deport/)) {
    serviceScene = 'modern gym facility, people exercising, fitness equipment, active healthy lifestyle';
  } else if (combined.match(/restaur|food|comida|café|coffee|bakery|panadería/)) {
    serviceScene = 'beautiful restaurant or cafe, delicious food presentation, warm inviting atmosphere, happy customers dining';
  } else if (combined.match(/real estate|inmueble|propiedad|casa|home|apartment|depart/)) {
    serviceScene = 'beautiful modern home or apartment, real estate photography, bright spacious rooms, inviting living space';
  } else if (combined.match(/tech|software|app|digital|web|desarrollo/)) {
    serviceScene = 'modern tech office, people working on computers, innovative workspace, collaborative team environment';
  } else if (combined.match(/marketing|agencia|agency|publicidad|advertising|brand/)) {
    serviceScene = 'creative agency office, marketing professionals, creative work environment, team collaboration';
  } else if (combined.match(/legal|law|abogad|attorney|notari/)) {
    serviceScene = 'professional law office, legal professionals, formal business environment, trust and expertise';
  } else if (combined.match(/construc|architect|renovar|remodel|build/)) {
    serviceScene = 'construction or renovation project, skilled workers, modern building, quality craftsmanship';
  } else if (combined.match(/beauty|salon|spa|estética|hair|nail|barbería/)) {
    serviceScene = 'modern beauty salon or spa, professional beauty treatment, relaxing elegant atmosphere';
  } else {
    serviceScene = `professional service environment related to: ${params.offer}, satisfied clients, professional team, quality results`;
  }

  return `${styleDesc}. ${serviceScene}. 
Business context: ${params.businessName || 'professional service company'} serving ${params.audience}. 
Campaign objective: ${params.goal}.
ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:
- NO text of any kind anywhere in the image
- NO words, letters, numbers, typography, fonts
- NO logos, watermarks, signs, banners, labels
- NO overlaid graphics or UI elements
- Photorealistic commercial photography quality
- Bright, clean, professional lighting
- Perfect square 1:1 composition
- Show the actual service environment, result or happy clients`;
}

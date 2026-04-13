import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { buildRenderPlan, dispatchRenderJob } from '@/lib/video-pipeline';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      tool?: string;
      prompt?: string;
      outputFormat?: string;
      captionStyle?: string;
      assetUrls?: string[];
    };

    const tool = String(body.tool || 'text-to-video');
    const prompt = String(body.prompt || '').trim();
    const outputFormat = String(body.outputFormat || 'vertical 9:16');
    const captionStyle = String(body.captionStyle || 'bold clean');
    const assetUrls = Array.isArray(body.assetUrls) ? body.assetUrls.filter((url) => typeof url === 'string').slice(0, 8) : [];

    if (!prompt) {
      return NextResponse.json({ error: 'Debes describir el video que quieres renderizar.' }, { status: 400 });
    }

    const renderPlan = buildRenderPlan({
      prompt,
      outputFormat,
      captionStyle,
      assetUrls,
    });

    const dispatch = await dispatchRenderJob({
      renderPlan,
      tool,
      userId,
    });

    return NextResponse.json({
      renderJob: {
        id: crypto.randomUUID(),
        submittedAt: new Date().toISOString(),
        tool,
        status: dispatch.status,
        provider: dispatch.provider,
        externalJobId: dispatch.externalJobId,
        previewUrl: dispatch.previewUrl,
        estimatedDurationSec: renderPlan.estimatedDurationSec,
      },
      renderPlan,
    });
  } catch (error) {
    console.error('Nexora Studio render error:', error);
    return NextResponse.json({ error: 'No se pudo crear el job de render.' }, { status: 500 });
  }
}

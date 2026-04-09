import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import { buildSupportCenterSummary, buildLifecycleTemplates } from '@/lib/customer-success';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const support = buildSupportCenterSummary();
    const lifecycle = buildLifecycleTemplates(process.env.SUPPORT_EMAIL || '');

    return NextResponse.json({
      support: {
        ...support,
        lifecycle,
        supportEmailReady: Boolean(process.env.SUPPORT_EMAIL),
        aiReady: true,
      },
    });
  } catch (error) {
    console.error('Error fetching support center:', error);
    return NextResponse.json({ error: 'Error fetching support center' }, { status: 500 });
  }
}

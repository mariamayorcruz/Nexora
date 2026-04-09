import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import { getAdminWorkspaceSnapshot, saveAdminWorkspacePartial } from '@/lib/admin-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const snapshot = await getAdminWorkspaceSnapshot();
    return NextResponse.json({
      funnel: snapshot.funnel,
      roadmap: snapshot.roadmap,
    });
  } catch (error) {
    console.error('Error fetching funnel center:', error);
    return NextResponse.json({ error: 'Error fetching funnel center' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const body = await request.json();
    await saveAdminWorkspacePartial({
      funnelConfig: body.funnel,
      roadmapConfig: body.roadmap,
    });

    const snapshot = await getAdminWorkspaceSnapshot();
    return NextResponse.json({
      funnel: snapshot.funnel,
      roadmap: snapshot.roadmap,
    });
  } catch (error) {
    console.error('Error saving funnel center:', error);
    return NextResponse.json({ error: 'Error saving funnel center' }, { status: 500 });
  }
}

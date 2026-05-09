import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import { getFounderPlan, isFounderEmail } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const founderAccess = isFounderEmail(adminCheck.user.email);
  const role = founderAccess ? 'founder' : 'admin';
  const accessPlan = founderAccess ? getFounderPlan() : 'admin';

  return NextResponse.json({
    admin: {
      id: adminCheck.user.id,
      email: adminCheck.user.email,
      name: adminCheck.user.name,
      role,
      accessPlan,
      founderAccess,
      sessionStatus: 'active',
      createdAt: adminCheck.user.createdAt,
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  return NextResponse.json({
    admin: {
      id: adminCheck.user.id,
      email: adminCheck.user.email,
      name: adminCheck.user.name,
    },
  });
}

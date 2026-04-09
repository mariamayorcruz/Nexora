import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import { buildEmailCenterSummary } from '@/lib/admin-ops';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const emailCenter = buildEmailCenterSummary(process.env.SUPPORT_EMAIL || '');

    return NextResponse.json({
      emails: {
        ...emailCenter,
        deliveryModes: {
          smtp: emailCenter.smtpReady,
          emailFrom: emailCenter.senderReady,
          supportEmail: emailCenter.supportEmailReady,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching email center:', error);
    return NextResponse.json({ error: 'Error fetching email center' }, { status: 500 });
  }
}

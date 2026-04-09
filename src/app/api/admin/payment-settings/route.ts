import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    let settings = await prisma.paymentSettings.findFirst();

    if (!settings) {
      // Create default settings
      settings = await prisma.paymentSettings.create({
        data: {
          commissionRate: 2.9,
          minimumPayout: 25.0,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Error fetching payment settings:', error);
    return NextResponse.json(
      { error: 'Error fetching payment settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const data = await request.json();

    const settings = await prisma.paymentSettings.upsert({
      where: { id: 'default' },
      update: {
        stripeWebhookSecret: data.stripeWebhookSecret,
        bankAccount: data.bankAccount,
        paypalEmail: data.paypalEmail,
        commissionRate: data.commissionRate,
        minimumPayout: data.minimumPayout,
      },
      create: {
        id: 'default',
        stripeWebhookSecret: data.stripeWebhookSecret,
        bankAccount: data.bankAccount,
        paypalEmail: data.paypalEmail,
        commissionRate: data.commissionRate,
        minimumPayout: data.minimumPayout,
      },
    });

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Error updating payment settings:', error);
    return NextResponse.json(
      { error: 'Error updating payment settings' },
      { status: 500 }
    );
  }
}

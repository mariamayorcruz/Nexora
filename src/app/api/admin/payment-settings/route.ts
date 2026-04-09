import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

async function getOrCreatePaymentSettings() {
  const existingSettings = await prisma.paymentSettings.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (existingSettings) {
    return existingSettings;
  }

  return prisma.paymentSettings.create({
    data: {
      commissionRate: 2.9,
      minimumPayout: 25,
    },
  });
}

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const settings = await getOrCreatePaymentSettings();
    return NextResponse.json({ settings });
  } catch (error) {
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
    const existingSettings = await getOrCreatePaymentSettings();

    const settings = await prisma.paymentSettings.update({
      where: { id: existingSettings.id },
      data: {
        stripeWebhookSecret: data.stripeWebhookSecret,
        bankAccount: data.bankAccount,
        paypalEmail: data.paypalEmail,
        commissionRate: data.commissionRate,
        minimumPayout: data.minimumPayout,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating payment settings:', error);
    return NextResponse.json(
      { error: 'Error updating payment settings' },
      { status: 500 }
    );
  }
}

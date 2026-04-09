import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    // For now, we'll use a simple approach with environment variables or a settings table
    // In a production app, you'd want a dedicated settings table
    const settings = {
      maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
      allowNewRegistrations: process.env.ALLOW_NEW_REGISTRATIONS !== 'false',
      defaultSubscriptionPrice: parseFloat(process.env.DEFAULT_SUBSCRIPTION_PRICE || '30'),
      supportEmail: process.env.SUPPORT_EMAIL || '',
      platformName: process.env.PLATFORM_NAME || 'Nexora',
      platformDescription: process.env.PLATFORM_DESCRIPTION || '',
      termsUrl: process.env.TERMS_URL || '',
      privacyUrl: process.env.PRIVACY_URL || '',
    };

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Error fetching settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { settings } = await request.json();

    // In a production app, you'd save these to a database
    // For now, we'll just validate and return success
    // You would typically update environment variables or a settings table

    // Validate required fields
    if (!settings.platformName) {
      return NextResponse.json(
        { error: 'Platform name is required' },
        { status: 400 }
      );
    }

    if (settings.defaultSubscriptionPrice < 0) {
      return NextResponse.json(
        { error: 'Subscription price must be positive' },
        { status: 400 }
      );
    }

    // Here you would save to database or update environment variables
    // For demo purposes, we'll just return success

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Error updating settings' },
      { status: 500 }
    );
  }
}

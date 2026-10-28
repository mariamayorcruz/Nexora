import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        paidAt: true,
        amount: true,
        amountMinor: true,
        currency: true,
        status: true,
        description: true,
        hostedInvoiceUrl: true,
        invoicePdfUrl: true,
      },
    });

    const invoices = rows.map((row) => ({
      ...row,
      amount: row.amountMinor == null ? row.amount : null,
      amountMinor: row.amountMinor == null ? null : row.amountMinor.toString(),
    }));

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Error fetching billing invoices:', error);
    return NextResponse.json({ error: 'Error fetching invoices' }, { status: 500 });
  }
}

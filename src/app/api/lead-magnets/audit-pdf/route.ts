import { NextRequest, NextResponse } from 'next/server';
import { displayNameForAudit } from '@/lib/audit-flow';
import { verifyLeadAuditPdfToken } from '@/lib/jwt';
import { auditVariantLabelFromNicheParam } from '@/lib/lead-magnets';
import { generateAuditPdf } from '@/lib/pdf/generateAuditPdf';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t');
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Enlace no válido.' }, { status: 400 });
  }

  const verified = verifyLeadAuditPdfToken(token);
  if (!verified) {
    return NextResponse.json({ error: 'Enlace caducado o no válido.' }, { status: 401 });
  }

  const capture = await prisma.leadCapture.findUnique({
    where: { id: verified.lid },
    select: { email: true, name: true },
  });

  if (!capture?.email) {
    return NextResponse.json({ error: 'No encontramos esta auditoría.' }, { status: 404 });
  }

  const variantLabel = auditVariantLabelFromNicheParam(verified.niche);
  const recipientDisplayName = displayNameForAudit(capture.name, capture.email);

  try {
    const bytes = await generateAuditPdf({
      recipientDisplayName,
      variantLabel,
    });
    const buf = Buffer.from(bytes);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="auditoria-nexora.pdf"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[lead-magnets/audit-pdf] generate failed:', e);
    return NextResponse.json({ error: 'No pudimos generar el PDF.' }, { status: 500 });
  }
}

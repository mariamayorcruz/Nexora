import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const products = await prisma.product.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    price?: number | string;
    currency?: string;
    active?: boolean;
  };

  const name = String(body.name || '').trim();
  const price = Number(body.price);
  if (!name) return NextResponse.json({ error: 'El producto necesita un nombre.' }, { status: 400 });
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'El precio no es válido.' }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      userId,
      name: name.slice(0, 200),
      description: body.description ? String(body.description).slice(0, 2000) : null,
      price,
      currency: (body.currency || 'CLP').toUpperCase().slice(0, 3),
      active: body.active !== false,
    },
  });

  await recordAudit({ userId, action: 'product.create', entity: 'product', entityId: product.id, headers: request.headers });
  return NextResponse.json({ product }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    description?: string;
    price?: number | string;
    currency?: string;
    active?: boolean;
  };
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'Falta el identificador del producto.' }, { status: 400 });

  const existing = await prisma.product.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });

  const price = body.price === undefined ? undefined : Number(body.price);
  if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
    return NextResponse.json({ error: 'El precio no es válido.' }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: body.name ? String(body.name).slice(0, 200) : undefined,
      description: body.description === undefined ? undefined : String(body.description).slice(0, 2000),
      price,
      currency: body.currency ? body.currency.toUpperCase().slice(0, 3) : undefined,
      active: body.active,
    },
  });

  return NextResponse.json({ product });
}

export async function DELETE(request: NextRequest) {
  const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id') || '';
  const deleted = await prisma.product.deleteMany({ where: { id, userId } });
  if (!deleted.count) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });

  await recordAudit({ userId, action: 'product.delete', entity: 'product', entityId: id, headers: request.headers });
  return NextResponse.json({ ok: true });
}

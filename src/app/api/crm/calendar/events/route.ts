import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { parseStoredCadence, serializeCadence } from '@/lib/crm-sequences';

export const dynamic = 'force-dynamic';

type CalendarEventBody = {
  id?: string;
  title: string;
  detail?: string;
  date: string;
  time?: string;
  type?: 'service' | 'lead' | 'followup' | 'campaign';
};

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const settings = await prisma.crmWorkspaceSettings.findUnique({ where: { userId } });
    const parsed = parseStoredCadence(settings?.defaultCadence);

    const events = parsed.salesEngine.appointments.map((appointment) => ({
      id: appointment.id,
      title: appointment.title,
      detail: appointment.notes || '',
      date: appointment.startsAt,
      time: new Date(appointment.startsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      type: 'lead' as const,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[crm/calendar/events] GET error:', error);
    return NextResponse.json({ error: 'Error al obtener eventos.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as CalendarEventBody;
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'El título es requerido.' }, { status: 400 });
    }

    const settings = await prisma.crmWorkspaceSettings.findUnique({ where: { userId } });
    const parsed = parseStoredCadence(settings?.defaultCadence);

    const startsAt = body.date || new Date().toISOString();
    const newAppointment = {
      id: body.id || randomUUID(),
      title: body.title.trim(),
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
      notes: body.detail || undefined,
      provider: 'calendly' as const,
    };

    const updatedEngine = {
      ...parsed.salesEngine,
      appointments: [...parsed.salesEngine.appointments, newAppointment],
    };

    await prisma.crmWorkspaceSettings.upsert({
      where: { userId },
      update: {
        defaultCadence: serializeCadence({ cadence: parsed.cadence || '48h', salesEngine: updatedEngine }),
      },
      create: {
        userId,
        emailAutomationEnabled: true,
        whatsappEnabled: false,
        phoneEnabled: false,
        externalCrmEnabled: false,
        autoFollowUpEnabled: true,
        defaultCadence: serializeCadence({ cadence: '48h', salesEngine: updatedEngine }),
      },
    });

    return NextResponse.json({
      ok: true,
      event: {
        id: newAppointment.id,
        title: newAppointment.title,
        detail: body.detail || '',
        date: startsAt,
        time: new Date(startsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        type: 'lead' as const,
      },
    });
  } catch (error) {
    console.error('[crm/calendar/events] POST error:', error);
    return NextResponse.json({ error: 'Error al guardar el evento.' }, { status: 500 });
  }
}

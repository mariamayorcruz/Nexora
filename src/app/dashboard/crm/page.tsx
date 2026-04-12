'use client';

import { useEffect, useMemo, useState } from 'react';
import { suggestConfidence, suggestNextAction } from '@/lib/sales-playbook';

interface CrmLead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: string;
  stage: string;
  value: number;
  confidence: number;
  nextAction?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LeadCapture {
  id: string;
  email: string;
  name?: string | null;
  source: string;
  resource: string;
  crmLeadId?: string | null;
  createdAt: string;
}

interface FollowUpTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger: 'lead_followup' | 'on_signup' | 'after_signup';
  delayHours: number;
  active: boolean;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
  }>;
}

interface SalesEngineSettings {
  calendar: {
    connected: boolean;
    provider: 'google' | 'outlook';
    weeklyCapacity: number;
    bookedThisWeek: number;
  };
  meetingLinks: {
    calendlyUrl: string;
    zoomUrl: string;
  };
  followUpTemplates: FollowUpTemplate[];
  sentLogs: Array<{
    id: string;
    to: string;
    subject: string;
    status: 'sent' | 'failed' | 'pending_setup';
    sentAt: string;
  }>;
  appointments: Array<{
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    notes?: string;
    provider: 'google' | 'outlook' | 'calendly';
    externalUrl?: string;
  }>;
}

const DEFAULT_SALES_ENGINE: SalesEngineSettings = {
  calendar: {
    connected: false,
    provider: 'google',
    weeklyCapacity: 20,
    bookedThisWeek: 0,
  },
  meetingLinks: {
    calendlyUrl: '',
    zoomUrl: '',
  },
  followUpTemplates: [
    {
      id: 'welcome-0h',
      name: 'Bienvenida inmediata',
      trigger: 'on_signup',
      delayHours: 0,
      active: true,
      attachments: [],
      subject: 'Gracias por elegir GotNexora, {{name}}',
      body: 'Hola {{name}},\n\nGracias por elegir GotNexora. Tu acceso ya está activo: {{dashboard_url}}\n\nPasos recomendados:\n1) Conecta tu primer canal.\n2) Crea tu primera campaña.\n3) Configura tu Motor de Ventas.\n\nEquipo GotNexora',
    },
    {
      id: 'lead-first-touch',
      name: 'Primer contacto comercial',
      trigger: 'lead_followup',
      delayHours: 0,
      active: true,
      attachments: [],
      subject: 'Seguimiento de tu solicitud en GotNexora',
      body: 'Hola {{name}},\n\nGracias por tu interés. Te comparto mi enlace para agendar una reunión:\n{{meeting_link}}\n\nEquipo GotNexora',
    },
  ],
  sentLogs: [],
  appointments: [],
};

const STAGES = [
  { key: 'lead', label: 'Entrantes' },
  { key: 'contacted', label: 'Contacto' },
  { key: 'qualified', label: 'Calificados' },
  { key: 'proposal', label: 'Propuesta' },
  { key: 'won', label: 'Ganados' },
] as const;

function stageLabel(stage: string) {
  return STAGES.find((item) => item.key === stage)?.label || stage;
}

const NEW_LEAD_FORM = {
  name: '',
  email: '',
  phone: '',
  company: '',
  source: 'manual',
  stage: 'lead',
  value: 0,
  confidence: 25,
  nextAction: '',
};

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function toInputDateTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toGoogleCalendarDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromLocalDateKeyAndTime(dateKey: string, time: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
}

function buildTimeOptions() {
  const options: string[] = [];
  for (let hour = 6; hour <= 21; hour += 1) {
    for (const minute of [0, 30]) {
      options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return options;
}

const TIME_OPTIONS = buildTimeOptions();

export default function DashboardCrmPage() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [captures, setCaptures] = useState<LeadCapture[]>([]);
  const [form, setForm] = useState(NEW_LEAD_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [salesEngine, setSalesEngine] = useState<SalesEngineSettings>(DEFAULT_SALES_ENGINE);
  const [savingEngine, setSavingEngine] = useState(false);
  const [sendingFollowUpId, setSendingFollowUpId] = useState<string | null>(null);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [viewMode, setViewMode] = useState<'crm' | 'motor'>('motor');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => toLocalDateKey(new Date()));
  const [appointmentForm, setAppointmentForm] = useState({
    title: 'Reunión comercial',
    dateKey: toLocalDateKey(new Date()),
    time: '10:00',
    duration: 30,
    provider: 'google' as 'google' | 'outlook' | 'calendly',
    notes: '',
    openExternal: true,
  });
  const [aiDraftingAppointment, setAiDraftingAppointment] = useState(false);

  const fetchCrm = async () => {
    try {
      const token = localStorage.getItem('token');
      const [leadsResponse, capturesResponse, settingsResponse] = await Promise.all([
        fetch('/api/crm/leads', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
        fetch('/api/business/leads', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
        fetch('/api/crm/settings', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
      ]);

      const leadsData = await leadsResponse.json();
      const capturesData = capturesResponse.ok ? await capturesResponse.json() : { captures: [] };
      const settingsData = settingsResponse.ok ? await settingsResponse.json() : { settings: { salesEngine: DEFAULT_SALES_ENGINE } };

      setLeads(leadsData.leads || []);
      setCaptures(capturesData.captures || []);
      setSalesEngine(settingsData.settings?.salesEngine || DEFAULT_SALES_ENGINE);
    } catch {
      setMessage('No se pudo cargar CRM.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCrm();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarState = params.get('calendar');
    if (calendarState === 'connected') {
      setMessage('Google Calendar conectado correctamente.');
      void fetchCrm();
      return;
    }

    if (calendarState === 'error') {
      setMessage('No se pudo conectar Google Calendar. Revisa configuración OAuth.');
    }
  }, []);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return leads;
    }

    return leads.filter((lead) => {
      return (
        lead.name.toLowerCase().includes(query) ||
        (lead.email || '').toLowerCase().includes(query) ||
        (lead.company || '').toLowerCase().includes(query) ||
        lead.source.toLowerCase().includes(query)
      );
    });
  }, [leads, search]);

  const metrics = useMemo(() => {
    const pipeline = filteredLeads
      .filter((lead) => lead.stage !== 'won')
      .reduce((sum, lead) => sum + (lead.value || 0), 0);
    const forecast = filteredLeads.reduce(
      (sum, lead) => sum + (lead.value || 0) * ((lead.confidence || 0) / 100),
      0
    );
    const won = filteredLeads
      .filter((lead) => lead.stage === 'won')
      .reduce((sum, lead) => sum + (lead.value || 0), 0);
    const tasks = filteredLeads.filter((lead) => lead.stage !== 'won' && lead.nextAction).length;

    return { pipeline, forecast, won, tasks };
  }, [filteredLeads]);

  const monthGrid = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; key: string }> = [];

    for (let i = 0; i < startWeekDay; i += 1) {
      cells.push({ day: null, key: `empty-start-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ day, key: `day-${day}` });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, key: `empty-end-${cells.length}` });
    }

    return cells;
  }, [calendarMonth]);

  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, SalesEngineSettings['appointments']> = {};
    for (const appointment of salesEngine.appointments || []) {
      const dateKey = toLocalDateKey(new Date(appointment.startsAt));
      grouped[dateKey] = grouped[dateKey] || [];
      grouped[dateKey].push(appointment);
    }
    return grouped;
  }, [salesEngine.appointments]);

  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);

  const selectedDateAppointments = useMemo(() => {
    return [...(appointmentsByDate[selectedDateKey] || [])].sort((a, b) => {
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });
  }, [appointmentsByDate, selectedDateKey]);

  const moveLead = async (lead: CrmLead, nextStage: string) => {
    if (lead.stage === nextStage) {
      return;
    }

    setBusyLeadId(lead.id);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage: nextStage,
          lastContactedAt: new Date().toISOString(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo mover etapa.');
      }

      await fetchCrm();
      setMessage(`Lead movido a ${stageLabel(nextStage)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo mover etapa.');
    } finally {
      setBusyLeadId(null);
    }
  };

  const applyPlaybook = async (lead: CrmLead) => {
    setBusyLeadId(lead.id);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confidence: suggestConfidence(lead.stage || 'lead'),
          nextAction: suggestNextAction({
            stage: lead.stage || 'lead',
            leadName: lead.name,
            source: lead.source,
          }),
          lastContactedAt: new Date().toISOString(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo aplicar playbook.');
      }

      setMessage('Playbook aplicado.');
      await fetchCrm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo aplicar playbook.');
    } finally {
      setBusyLeadId(null);
    }
  };

  const promoteCapture = async (captureId: string) => {
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/business/leads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ captureId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo pasar al CRM.');
      }

      setMessage('Interesado convertido a CRM.');
      await fetchCrm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo pasar al CRM.');
    }
  };

  const createLead = async () => {
    if (!form.name.trim()) {
      setMessage('El nombre es obligatorio.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo crear contacto.');
      }

      setForm(NEW_LEAD_FORM);
      setMessage('Contacto agregado al CRM.');
      await fetchCrm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear contacto.');
    } finally {
      setSaving(false);
    }
  };

  const saveSalesEngine = async (next: SalesEngineSettings) => {
    setSavingEngine(true);
    try {
      const normalized: SalesEngineSettings = {
        ...next,
        meetingLinks: {
          calendlyUrl: normalizeExternalUrl(next.meetingLinks.calendlyUrl),
          zoomUrl: normalizeExternalUrl(next.meetingLinks.zoomUrl),
        },
      };

      const token = localStorage.getItem('token');
      const response = await fetch('/api/crm/settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ salesEngine: normalized }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar motor de ventas.');
      }

      setSalesEngine(data.settings?.salesEngine || normalized);
      setMessage('Motor de ventas actualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar motor de ventas.');
    } finally {
      setSavingEngine(false);
    }
  };

  const sendFollowUp = async (lead: CrmLead) => {
    setSendingFollowUpId(lead.id);
    try {
      const token = localStorage.getItem('token');
      const template =
        salesEngine.followUpTemplates.find((item) => item.active && item.trigger === 'lead_followup') ||
        salesEngine.followUpTemplates[0];
      const response = await fetch('/api/crm/followups', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId: lead.id,
          templateId: template?.id,
          subject: template?.subject,
          body: template?.body,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo enviar follow-up.');
      }

      setMessage(
        data.status === 'sent'
          ? `Follow-up enviado a ${lead.email}.`
          : data.status === 'pending_setup'
          ? 'Follow-up registrado, pendiente de SMTP.'
          : 'No se pudo entregar el follow-up; revisa configuración de correo.'
      );
      await fetchCrm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo enviar follow-up.');
    } finally {
      setSendingFollowUpId(null);
    }
  };

  const connectGoogleCalendar = async () => {
    setConnectingCalendar(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/crm/calendar/connect/start', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'No se pudo iniciar conexión con Google Calendar.');
      }

      window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar conexión con Google Calendar.');
    } finally {
      setConnectingCalendar(false);
    }
  };

  const openMeetingLink = (urlValue: string, label: string) => {
    const normalized = normalizeExternalUrl(urlValue);
    if (!normalized || !isValidHttpUrl(normalized)) {
      setMessage(`URL de ${label} inválida. Usa un enlace completo.`);
      return;
    }

    window.open(normalized, '_blank', 'noopener,noreferrer');
  };

  const disconnectCalendar = async () => {
    const next = {
      ...salesEngine,
      calendar: {
        ...salesEngine.calendar,
        connected: false,
      },
    };

    await saveSalesEngine(next);
  };

  const buildExternalEventUrl = (
    provider: 'google' | 'outlook' | 'calendly',
    title: string,
    startsAt: Date,
    endsAt: Date,
    notes: string
  ) => {
    if (provider === 'google') {
      const url = new URL('https://calendar.google.com/calendar/render');
      url.searchParams.set('action', 'TEMPLATE');
      url.searchParams.set('text', title);
      url.searchParams.set('details', notes || 'Cita agendada desde Nexora CRM');
      url.searchParams.set('dates', `${toGoogleCalendarDate(startsAt)}/${toGoogleCalendarDate(endsAt)}`);
      return url.toString();
    }

    if (provider === 'outlook') {
      const url = new URL('https://outlook.office.com/calendar/0/deeplink/compose');
      url.searchParams.set('path', '/calendar/action/compose');
      url.searchParams.set('rru', 'addevent');
      url.searchParams.set('subject', title);
      url.searchParams.set('startdt', startsAt.toISOString());
      url.searchParams.set('enddt', endsAt.toISOString());
      url.searchParams.set('body', notes || 'Cita agendada desde Nexora CRM');
      return url.toString();
    }

    return normalizeExternalUrl(salesEngine.meetingLinks.calendlyUrl);
  };

  const handleSelectCalendarDay = (day: number) => {
    const nextDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    const nextDateKey = toLocalDateKey(nextDate);
    setSelectedDateKey(nextDateKey);
    setAppointmentForm((current) => ({
      ...current,
      dateKey: nextDateKey,
      provider: current.provider || salesEngine.calendar.provider,
    }));
  };

  const handleCreateAppointment = async () => {
    if (!appointmentForm.title.trim()) {
      setMessage('El título de la cita es obligatorio.');
      return;
    }

    const startsAt = fromLocalDateKeyAndTime(appointmentForm.dateKey, appointmentForm.time);
    if (Number.isNaN(startsAt.getTime())) {
      setMessage('Fecha u hora inválida.');
      return;
    }

    const duration = Math.max(15, Number(appointmentForm.duration) || 30);
    const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);
    const provider = appointmentForm.provider;
    const notes = appointmentForm.notes.trim();
    const externalUrl = buildExternalEventUrl(provider, appointmentForm.title.trim(), startsAt, endsAt, notes);

    const next: SalesEngineSettings = {
      ...salesEngine,
      appointments: [
        {
          id: `appt-${Date.now()}`,
          title: appointmentForm.title.trim(),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          notes: notes || undefined,
          provider,
          externalUrl,
        },
        ...(salesEngine.appointments || []),
      ].slice(0, 300),
    };

    await saveSalesEngine(next);
    setMessage('Cita guardada en el calendario del CRM.');

    if (appointmentForm.openExternal && externalUrl && isValidHttpUrl(externalUrl)) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    const next: SalesEngineSettings = {
      ...salesEngine,
      appointments: (salesEngine.appointments || []).filter((item) => item.id !== appointmentId),
    };
    await saveSalesEngine(next);
    setMessage('Cita eliminada.');
  };

  const handleSuggestAppointmentWithAi = async () => {
    setAiDraftingAppointment(true);
    try {
      const token = localStorage.getItem('token');
      const aiProvider = localStorage.getItem('nexora_ai_provider') || 'auto';
      const aiApiKey = localStorage.getItem('nexora_ai_api_key') || '';
      const response = await fetch('/api/support/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Propon una cita comercial para ${appointmentForm.dateKey} a las ${appointmentForm.time}. Quiero titulo corto y notas accionables.`,
          page: '/dashboard/crm',
          aiProvider,
          aiApiKey: aiApiKey.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo generar sugerencia con IA.');
      }

      const reply = data.reply as { title?: string; message?: string };
      setAppointmentForm((current) => ({
        ...current,
        title: (reply.title || current.title || 'Reunión comercial').slice(0, 100),
        notes: reply.message || current.notes,
      }));
      setMessage('Sugerencia IA aplicada al formulario de cita.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo usar IA para sugerir cita.');
    } finally {
      setAiDraftingAppointment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_16px_55px_rgba(2,6,23,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Success CRM</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">CRM de cierre limpio y accionable</h1>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, empresa o fuente"
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100"
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <KpiCard label="Pipeline" value={`$${Math.round(metrics.pipeline).toLocaleString()}`} />
          <KpiCard label="Forecast" value={`$${Math.round(metrics.forecast).toLocaleString()}`} />
          <KpiCard label="Ganado" value={`$${Math.round(metrics.won).toLocaleString()}`} />
          <KpiCard label="Tareas activas" value={String(metrics.tasks)} />
        </div>
      </section>

      {message ? (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">{message}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setViewMode('motor')}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              viewMode === 'motor' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-200'
            }`}
          >
            Motor IA + Calendario
          </button>
          <button
            type="button"
            onClick={() => setViewMode('crm')}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              viewMode === 'crm' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-200'
            }`}
          >
            CRM comercial
          </button>
        </div>
      </section>

      <section className={`rounded-[28px] border border-slate-800 bg-slate-900/70 p-4 shadow-[0_16px_55px_rgba(2,6,23,0.45)] ${viewMode === 'crm' ? '' : 'hidden'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Flujo comercial</h2>
          <span className="text-xs text-slate-400">Arranca en Entrantes y avanza hasta Ganados</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-5">
          {STAGES.map((stage) => {
            const stageLeads = filteredLeads.filter((lead) => lead.stage === stage.key);

            return (
              <div key={stage.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">{stage.label}</p>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{stageLeads.length}</span>
                </div>

                <div className="space-y-2">
                  {stageLeads.length === 0 ? (
                    <p className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-xs text-slate-500">Sin oportunidades</p>
                  ) : (
                    stageLeads.map((lead) => (
                      <article key={lead.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                        <p className="text-sm font-semibold text-white">{lead.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{lead.company || 'Sin empresa'} · {lead.source}</p>
                        <p className="mt-2 text-xs text-slate-300">${Math.round(lead.value || 0).toLocaleString()} · {lead.confidence || 0}%</p>
                        <p className="mt-2 line-clamp-2 text-xs text-slate-400">{lead.nextAction || 'Definir siguiente acción'}</p>

                        <div className="mt-3 grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            onClick={() => void applyPlaybook(lead)}
                            disabled={busyLeadId === lead.id}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 hover:border-cyan-500"
                          >
                            Playbook
                          </button>
                          <button
                            type="button"
                            onClick={() => void sendFollowUp(lead)}
                            disabled={sendingFollowUpId === lead.id}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-200 disabled:opacity-50"
                          >
                            {sendingFollowUpId === lead.id ? 'Enviando follow-up...' : 'Enviar follow-up'}
                          </button>
                          <select
                            value={lead.stage}
                            onChange={(event) => void moveLead(lead, event.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
                          >
                            {STAGES.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={`rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 shadow-[0_16px_55px_rgba(2,6,23,0.45)] lg:col-span-2 ${viewMode === 'motor' ? '' : 'hidden'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Motor de ventas</h2>
            <button
              type="button"
              onClick={() => void saveSalesEngine(salesEngine)}
              disabled={savingEngine}
              className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-60"
            >
              {savingEngine ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Calendario semanal</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Estado</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${salesEngine.calendar.connected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-200'}`}>
                    {salesEngine.calendar.connected ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void connectGoogleCalendar()}
                    disabled={connectingCalendar}
                    className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200"
                  >
                    {connectingCalendar ? 'Conectando...' : 'Conectar Google Calendar'}
                  </button>
                  {salesEngine.calendar.connected ? (
                    <button
                      type="button"
                      onClick={() => void disconnectCalendar()}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200"
                    >
                      Desconectar
                    </button>
                  ) : null}
                </div>
                <label className="block text-slate-400">Proveedor</label>
                <select
                  value={salesEngine.calendar.provider}
                  onChange={(event) =>
                    setSalesEngine((current) => ({
                      ...current,
                      calendar: { ...current.calendar, provider: event.target.value as 'google' | 'outlook' },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                >
                  <option value="google">Google Calendar</option>
                  <option value="outlook">Outlook Calendar</option>
                </select>
                <label className="block text-slate-400">Capacidad semanal</label>
                <input
                  type="number"
                  min={1}
                  value={salesEngine.calendar.weeklyCapacity}
                  onChange={(event) =>
                    setSalesEngine((current) => ({
                      ...current,
                      calendar: { ...current.calendar, weeklyCapacity: Number(event.target.value) || 1 },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                />
                <label className="block text-slate-400">Reuniones agendadas</label>
                <input
                  type="number"
                  min={0}
                  value={salesEngine.calendar.bookedThisWeek}
                  onChange={(event) =>
                    setSalesEngine((current) => ({
                      ...current,
                      calendar: { ...current.calendar, bookedThisWeek: Number(event.target.value) || 0 },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                />
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900 p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonth(
                          (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                        )
                      }
                      className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
                    >
                      ←
                    </button>
                    <p className="text-xs font-semibold capitalize text-slate-200">{monthLabel(calendarMonth)}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonth(
                          (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                        )
                      }
                      className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
                    >
                      →
                    </button>
                  </div>
                  <div className="mb-1 grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-slate-500">
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((dayName) => (
                      <span key={dayName}>{dayName}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthGrid.map((cell) => {
                      if (!cell.day) {
                        return <div key={cell.key} className="h-8 rounded bg-slate-950/40" />;
                      }

                      const cellDate = new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth(),
                        cell.day
                      );
                      const cellDateKey = toLocalDateKey(cellDate);
                      const hasEvents = Boolean(appointmentsByDate[cellDateKey]?.length);
                      const isToday = cellDateKey === todayKey;
                      const eventCount = appointmentsByDate[cellDateKey]?.length || 0;

                      return (
                        <button
                          key={cell.key}
                          type="button"
                          onClick={() => handleSelectCalendarDay(cell.day as number)}
                          className={`relative h-8 rounded text-xs font-medium ${
                            hasEvents
                              ? 'border border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                              : 'border border-slate-800 bg-slate-950 text-slate-300 hover:border-cyan-500/40'
                          } ${isToday ? 'ring-1 ring-emerald-400' : ''}`}
                          title={
                            isToday
                              ? eventCount > 0
                                ? `Hoy · ${eventCount} cita(s)`
                                : 'Hoy'
                              : eventCount > 0
                              ? `${eventCount} cita(s)`
                              : ''
                          }
                        >
                          {cell.day}
                          {hasEvents ? (
                            <span className="absolute bottom-0.5 right-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">Selecciona un día para ver agenda y usar el formulario de cita.</p>
                </div>

                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Agenda del día {selectedDateKey}</p>
                  <div className="mt-2 space-y-2">
                    {selectedDateAppointments.length === 0 ? (
                      <p className="text-xs text-slate-500">No hay citas para este día.</p>
                    ) : (
                      selectedDateAppointments.map((appointment) => (
                        <div key={appointment.id} className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs">
                          <p className="font-semibold text-slate-200">{appointment.title}</p>
                          <p className="mt-1 text-slate-400">
                            {new Date(appointment.startsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            {' · '}
                            {appointment.provider}
                          </p>
                          <div className="mt-2 flex gap-2">
                            {appointment.externalUrl && isValidHttpUrl(appointment.externalUrl) ? (
                              <button
                                type="button"
                                onClick={() => window.open(appointment.externalUrl, '_blank', 'noopener,noreferrer')}
                                className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200"
                              >
                                Abrir enlace
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void handleDeleteAppointment(appointment.id)}
                              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-200"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Nueva cita (formulario simple)</p>
                    <input
                      value={appointmentForm.title}
                      onChange={(event) => setAppointmentForm((current) => ({ ...current, title: event.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                      placeholder="Título"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="date"
                        value={appointmentForm.dateKey}
                        onChange={(event) => {
                          setSelectedDateKey(event.target.value);
                          setAppointmentForm((current) => ({ ...current, dateKey: event.target.value }));
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                      />
                      <select
                        value={appointmentForm.time}
                        onChange={(event) => setAppointmentForm((current) => ({ ...current, time: event.target.value }))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                      >
                        {TIME_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="number"
                        min={15}
                        step={15}
                        value={appointmentForm.duration}
                        onChange={(event) =>
                          setAppointmentForm((current) => ({
                            ...current,
                            duration: Math.max(15, Number(event.target.value) || 30),
                          }))
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                        placeholder="Duración"
                      />
                      <select
                        value={appointmentForm.provider}
                        onChange={(event) =>
                          setAppointmentForm((current) => ({
                            ...current,
                            provider: event.target.value as 'google' | 'outlook' | 'calendly',
                          }))
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                      >
                        <option value="google">Google</option>
                        <option value="outlook">Outlook</option>
                        <option value="calendly">Calendly</option>
                      </select>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={appointmentForm.openExternal}
                          onChange={(event) =>
                            setAppointmentForm((current) => ({ ...current, openExternal: event.target.checked }))
                          }
                        />
                        Abrir enlace al guardar
                      </label>
                    </div>
                    <textarea
                      value={appointmentForm.notes}
                      onChange={(event) => setAppointmentForm((current) => ({ ...current, notes: event.target.value }))}
                      className="min-h-[72px] w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                      placeholder="Notas de la cita"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCreateAppointment()}
                        className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                      >
                        Guardar cita
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSuggestAppointmentWithAi()}
                        disabled={aiDraftingAppointment}
                        className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 disabled:opacity-60"
                      >
                        {aiDraftingAppointment ? 'IA pensando...' : 'Sugerir con IA'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Links de reunión</p>
              <div className="mt-3 space-y-2 text-sm">
                <label className="block text-slate-400">Calendly URL</label>
                <input
                  value={salesEngine.meetingLinks.calendlyUrl}
                  onChange={(event) =>
                    setSalesEngine((current) => ({
                      ...current,
                      meetingLinks: { ...current.meetingLinks, calendlyUrl: event.target.value },
                    }))
                  }
                  placeholder="https://calendly.com/..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                />
                <label className="block text-slate-400">Zoom URL</label>
                <input
                  value={salesEngine.meetingLinks.zoomUrl}
                  onChange={(event) =>
                    setSalesEngine((current) => ({
                      ...current,
                      meetingLinks: { ...current.meetingLinks, zoomUrl: event.target.value },
                    }))
                  }
                  placeholder="https://zoom.us/j/..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void saveSalesEngine(salesEngine)}
                    disabled={savingEngine}
                    className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200"
                  >
                    Guardar links
                  </button>
                  {salesEngine.meetingLinks.calendlyUrl ? (
                    <button
                      type="button"
                      onClick={() => openMeetingLink(salesEngine.meetingLinks.calendlyUrl, 'Calendly')}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200"
                    >
                      Probar Calendly
                    </button>
                  ) : null}
                  {salesEngine.meetingLinks.zoomUrl ? (
                    <button
                      type="button"
                      onClick={() => openMeetingLink(salesEngine.meetingLinks.zoomUrl, 'Zoom')}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200"
                    >
                      Probar Zoom
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Seguimientos enviados</p>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {salesEngine.sentLogs.length === 0 ? (
                  <p className="text-xs text-slate-500">Aún no hay follow-ups enviados.</p>
                ) : (
                  salesEngine.sentLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-2 text-xs">
                      <p className="truncate text-slate-200">{log.to}</p>
                      <p className="truncate text-slate-400">{log.subject}</p>
                      <p className="text-slate-500">{new Date(log.sentAt).toLocaleString('es-ES')} · {log.status}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Secuencia de emails (editable y automática)</p>
            <div className="mt-3 space-y-3">
              {salesEngine.followUpTemplates.map((template, idx) => (
                <div key={template.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <div className="grid gap-2 md:grid-cols-4">
                    <input
                      value={template.name}
                      onChange={(event) =>
                        setSalesEngine((current) => {
                          const next = [...current.followUpTemplates];
                          next[idx] = { ...next[idx], name: event.target.value };
                          return { ...current, followUpTemplates: next };
                        })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                      placeholder="Nombre del template"
                    />
                    <select
                      value={template.trigger}
                      onChange={(event) =>
                        setSalesEngine((current) => {
                          const next = [...current.followUpTemplates];
                          next[idx] = {
                            ...next[idx],
                            trigger: event.target.value as 'lead_followup' | 'on_signup' | 'after_signup',
                          };
                          return { ...current, followUpTemplates: next };
                        })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                    >
                      <option value="on_signup">Registro inmediato</option>
                      <option value="after_signup">Después del registro</option>
                      <option value="lead_followup">Follow-up comercial</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={template.delayHours}
                      onChange={(event) =>
                        setSalesEngine((current) => {
                          const next = [...current.followUpTemplates];
                          next[idx] = { ...next[idx], delayHours: Math.max(0, Number(event.target.value) || 0) };
                          return { ...current, followUpTemplates: next };
                        })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                      placeholder="Retraso (horas)"
                    />
                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={template.active}
                        onChange={(event) =>
                          setSalesEngine((current) => {
                            const next = [...current.followUpTemplates];
                            next[idx] = { ...next[idx], active: event.target.checked };
                            return { ...current, followUpTemplates: next };
                          })
                        }
                      />
                      Activo
                    </label>
                  </div>
                  <input
                    value={template.subject}
                    onChange={(event) =>
                      setSalesEngine((current) => {
                        const next = [...current.followUpTemplates];
                        next[idx] = { ...next[idx], subject: event.target.value };
                        return { ...current, followUpTemplates: next };
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                    placeholder="Asunto"
                  />
                  <textarea
                    value={template.body}
                    onChange={(event) =>
                      setSalesEngine((current) => {
                        const next = [...current.followUpTemplates];
                        next[idx] = { ...next[idx], body: event.target.value };
                        return { ...current, followUpTemplates: next };
                      })
                    }
                    className="mt-2 min-h-[90px] w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                    placeholder="Cuerpo del correo"
                  />
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Adjuntos</p>
                      <button
                        type="button"
                        onClick={() =>
                          setSalesEngine((current) => {
                            const next = [...current.followUpTemplates];
                            const assets = next[idx].attachments || [];
                            next[idx] = {
                              ...next[idx],
                              attachments: [
                                ...assets,
                                {
                                  id: `asset-${Date.now()}`,
                                  name: 'Nuevo archivo',
                                  url: '',
                                },
                              ],
                            };
                            return { ...current, followUpTemplates: next };
                          })
                        }
                        className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200"
                      >
                        + Agregar archivo
                      </button>
                    </div>
                    {template.attachments.length === 0 ? (
                      <p className="text-[11px] text-slate-500">Sin adjuntos en este email.</p>
                    ) : (
                      template.attachments.map((asset, assetIndex) => (
                        <div key={asset.id} className="grid gap-2 md:grid-cols-[0.35fr_0.55fr_0.1fr]">
                          <input
                            value={asset.name}
                            onChange={(event) =>
                              setSalesEngine((current) => {
                                const next = [...current.followUpTemplates];
                                const assets = [...next[idx].attachments];
                                assets[assetIndex] = { ...assets[assetIndex], name: event.target.value };
                                next[idx] = { ...next[idx], attachments: assets };
                                return { ...current, followUpTemplates: next };
                              })
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                            placeholder="Nombre"
                          />
                          <input
                            value={asset.url}
                            onChange={(event) =>
                              setSalesEngine((current) => {
                                const next = [...current.followUpTemplates];
                                const assets = [...next[idx].attachments];
                                assets[assetIndex] = { ...assets[assetIndex], url: event.target.value };
                                next[idx] = { ...next[idx], attachments: assets };
                                return { ...current, followUpTemplates: next };
                              })
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                            placeholder="https://..."
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setSalesEngine((current) => {
                                const next = [...current.followUpTemplates];
                                const assets = next[idx].attachments.filter((item) => item.id !== asset.id);
                                next[idx] = { ...next[idx], attachments: assets };
                                return { ...current, followUpTemplates: next };
                              })
                            }
                            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs font-semibold text-rose-200"
                          >
                            Quitar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Variables: {'{{name}}'}, {'{{meeting_link}}'}, {'{{dashboard_url}}'}, {'{{email}}'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 shadow-[0_16px_55px_rgba(2,6,23,0.45)] ${viewMode === 'crm' ? '' : 'hidden'}`}>
          <h2 className="text-lg font-semibold text-white">Interesados captados</h2>
          <div className="mt-4 space-y-2">
            {captures.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-500">Sin captados recientes.</p>
            ) : (
              captures.slice(0, 8).map((capture) => (
                <div key={capture.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{capture.name || 'Sin nombre'}</p>
                    <p className="truncate text-xs text-slate-400">{capture.email} · {capture.source}</p>
                  </div>
                  {capture.crmLeadId ? (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">En CRM</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void promoteCapture(capture.id)}
                      className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300"
                    >
                      Pasar a CRM
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 shadow-[0_16px_55px_rgba(2,6,23,0.45)] ${viewMode === 'crm' ? '' : 'hidden'}`}>
          <h2 className="text-lg font-semibold text-white">Nuevo contacto</h2>
          <div className="mt-4 space-y-3">
            <input value={form.name} onChange={(event) => setForm((v) => ({ ...v, name: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Nombre" />
            <input value={form.email} onChange={(event) => setForm((v) => ({ ...v, email: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Email" />
            <input value={form.phone} onChange={(event) => setForm((v) => ({ ...v, phone: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Teléfono" />
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Tu producto o empresa</p>
              <input
                value={form.company}
                onChange={(event) => setForm((v) => ({ ...v, company: event.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="Su nombre o empresa"
              />
              <p className="mt-1 text-[11px] text-slate-500">Su nombre o empresa</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={form.value} onChange={(event) => setForm((v) => ({ ...v, value: Number(event.target.value) || 0 }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Valor" />
              <input type="number" min={0} max={100} value={form.confidence} onChange={(event) => setForm((v) => ({ ...v, confidence: Number(event.target.value) || 0 }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Confianza" />
            </div>
            <input value={form.nextAction} onChange={(event) => setForm((v) => ({ ...v, nextAction: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Siguiente acción" />

            <button
              type="button"
              onClick={() => void createLead()}
              disabled={saving}
              className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar en CRM'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

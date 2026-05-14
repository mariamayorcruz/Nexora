'use client';

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppLanguage } from '@/hooks/use-app-language';

type CalendarTab = 'month' | 'week' | 'day' | 'content';

type EventItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
  time: string;
  type: 'service' | 'lead' | 'followup' | 'campaign';
};

const TYPE_META = {
  service: { label: 'Limpieza/Servicio', color: 'bg-cyan-500', bg: 'bg-cyan-500/10 text-cyan-300' },
  lead: { label: 'Lead/Reunión', color: 'bg-emerald-400', bg: 'bg-emerald-500/10 text-emerald-300' },
  followup: { label: 'Follow-up', color: 'bg-amber-400', bg: 'bg-amber-500/10 text-amber-300' },
  campaign: { label: 'Campaña', color: 'bg-rose-400', bg: 'bg-rose-500/10 text-rose-300' },
} as const;

export default function CalendarioPage() {
  const { language } = useAppLanguage();
  const [tab, setTab] = useState<CalendarTab>('month');
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    void Promise.all([
      fetch('/api/crm/leads', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).then((res) => res.json()),
      fetch('/api/ai/studio', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).then((res) => res.json()).catch(() => ({ jobs: [] })),
    ])
      .then(([leadData, studioData]) => {
        const leadEvents: EventItem[] = (Array.isArray(leadData?.leads) ? leadData.leads : []).slice(0, 16).map((lead: Record<string, unknown>, index: number) => ({
          id: String(lead.id || index),
          title: String(lead.name || 'Lead'),
          detail: String(lead.nextAction || lead.source || 'Seguimiento comercial'),
          date: new Date(String(lead.updatedAt || Date.now())).toISOString(),
          time: new Date(String(lead.updatedAt || Date.now())).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          type: lead.stage === 'won' ? 'service' : index % 2 === 0 ? 'lead' : 'followup',
        }));
        const campaignEvents: EventItem[] = (Array.isArray(studioData?.jobs) ? studioData.jobs : []).slice(0, 6).map((job: Record<string, unknown>, index: number) => ({
          id: `campaign-${index}`,
          title: String(job.title || 'Campaña'),
          detail: 'Asset listo para publicar',
          date: new Date(String(job.createdAt || Date.now())).toISOString(),
          time: new Date(String(job.createdAt || Date.now())).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          type: 'campaign',
        }));
        setEvents([...leadEvents, ...campaignEvents]);
      })
      .catch(() => setEvents([]));
  }, []);

  const monthGrid = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const blanks = first.getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < blanks; i += 1) cells.push(null);
    for (let day = 1; day <= days; day += 1) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthDate]);

  const eventsByDay = useMemo(() => {
    const grouped: Record<string, EventItem[]> = {};
    events.forEach((event) => {
      const key = new Date(event.date).toDateString();
      grouped[key] = grouped[key] || [];
      grouped[key].push(event);
    });
    return grouped;
  }, [events]);

  const selectedKey = selectedDate.toDateString();
  const dayEvents = eventsByDay[selectedKey] || [];
  const weekSummary = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        acc[event.type] += 1;
        return acc;
      },
      { service: 0, lead: 0, followup: 0, campaign: 0 }
    );
  }, [events]);

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-5">
        <section className="rounded-[28px] bg-[#040810] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {([
                ['month', 'Mes'],
                ['week', 'Semana'],
                ['day', 'Día'],
                ['content', 'Contenido'],
              ] as Array<[CalendarTab, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-full px-3 py-1.5 text-xs transition-all duration-150 ${
                    tab === key ? 'bg-cyan-500/10 text-cyan-300' : 'bg-white/[0.03] text-slate-500 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
                className="rounded-full bg-white/[0.03] p-2 text-slate-300 transition hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="min-w-[180px] text-center text-sm text-white">
                {monthDate.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' })}
              </p>
              <button
                type="button"
                onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
                className="rounded-full bg-white/[0.03] p-2 text-slate-300 transition hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {tab === 'month' && (
        <section className="rounded-[28px] bg-[#040810] p-4 sm:p-5">
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[860px]">
              <div className="mb-4 grid grid-cols-7 gap-3 text-center text-[11px] uppercase tracking-[0.16em] text-slate-500">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                  <div key={day} className="py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-3">
                {monthGrid.map((date, index) => {
                  if (!date) return <div key={`empty-${index}`} className="min-h-[108px] rounded-[22px] bg-[#030610]" />;
                  const key = date.toDateString();
                  const list = (eventsByDay[key] || []).slice(0, 2);
                  const isToday = key === new Date().toDateString();
                  const isSelected = key === selectedKey;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={`min-h-[108px] rounded-[22px] p-3 text-left transition-all duration-150 ${
                        isSelected ? 'bg-white/[0.05]' : 'bg-[#030610] hover:bg-white/[0.03]'
                      } ${isToday ? 'outline outline-1 outline-cyan-400' : ''}`}
                    >
                      <p className={`text-xs ${isToday ? 'text-cyan-300' : 'text-slate-400'}`}>{date.getDate()}</p>
                      <div className="mt-3 space-y-1.5">
                        {list.map((event) => (
                          <div key={event.id} className={`truncate rounded-full px-2 py-1 text-[10px] ${TYPE_META[event.type].bg}`}>
                            {event.title}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
        )}

        {tab === 'week' && (
          <section className="rounded-[28px] bg-[#040810] p-4 sm:p-5">
            <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {language === 'en' ? 'This week' : 'Esta semana'}
            </p>
            <div className="space-y-3">
              {Array.from({ length: 7 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const key = date.toDateString();
                const dayEvts = eventsByDay[key] || [];
                return (
                  <div key={key} className="rounded-[20px] bg-[#030610] p-4">
                    <p className="text-xs font-medium text-cyan-300">
                      {date.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    {dayEvts.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-600">{language === 'en' ? 'No events' : 'Sin eventos'}</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {dayEvts.map((event) => (
                          <div key={event.id} className={`rounded-full px-3 py-1.5 text-xs ${TYPE_META[event.type].bg}`}>
                            {event.time} · {event.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'day' && (
          <section className="rounded-[28px] bg-[#040810] p-4 sm:p-5">
            <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {selectedDate.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            {dayEvents.length === 0 ? (
              <div className="rounded-[20px] bg-[#030610] px-4 py-8 text-center text-sm text-slate-500">
                {language === 'en' ? 'No events for this day.' : 'Sin eventos para este día.'}
              </div>
            ) : (
              <div className="space-y-3">
                {dayEvents.map((event) => (
                  <div key={event.id} className="rounded-[20px] bg-[#030610] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">{event.title}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] ${TYPE_META[event.type].bg}`}>
                        {TYPE_META[event.type].label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-cyan-300">{event.time}</p>
                    <p className="mt-2 text-xs text-slate-400">{event.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'content' && (
          <section className="rounded-[28px] bg-[#040810] p-4 sm:p-5">
            <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {language === 'en' ? 'Studio campaigns' : 'Campañas del Studio'}
            </p>
            <div className="space-y-3">
              {events.filter((e) => e.type === 'campaign').length === 0 ? (
                <div className="rounded-[20px] bg-[#030610] px-4 py-8 text-center text-sm text-slate-500">
                  {language === 'en' ? 'No campaigns yet.' : 'Todavía no hay campañas.'}
                </div>
              ) : (
                events.filter((e) => e.type === 'campaign').map((event) => (
                  <div key={event.id} className="rounded-[20px] bg-[#030610] p-4">
                    <p className="text-sm font-medium text-white">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{event.detail}</p>
                    <p className="mt-2 text-[11px] text-slate-600">
                      {new Date(event.date).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      <aside className="rounded-[28px] bg-[#040810] p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Día seleccionado</p>
            <p className="mt-2 text-sm text-white">{selectedDate.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          </div>
          <button
            type="button"
            onClick={() => setAddEventOpen(true)}
            className="rounded-full bg-cyan-500 px-3 py-2 text-xs font-semibold text-[#041018] transition hover:bg-cyan-400"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            Agregar
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {dayEvents.length === 0 ? (
            <div className="rounded-[20px] bg-[#030610] px-4 py-4 text-sm text-slate-500">Sin eventos para este día.</div>
          ) : (
            dayEvents.map((event) => (
              <div key={event.id} className="rounded-[20px] bg-[#030610] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white">{event.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${TYPE_META[event.type].bg}`}>{TYPE_META[event.type].label}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{event.time}</p>
                <p className="mt-1 text-xs text-slate-500">{event.detail}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 rounded-[20px] bg-[#030610] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Resumen de semana</p>
          <div className="mt-3 space-y-2">
            {(Object.keys(TYPE_META) as Array<keyof typeof TYPE_META>).map((key) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{TYPE_META[key].label}</span>
                <span className="text-white">{weekSummary[key]}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {addEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-[#040810] p-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">
              ✦ {language === 'en' ? 'New event' : 'Nuevo evento'}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {selectedDate.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h2>
            <input
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              placeholder={language === 'en' ? 'Event title...' : 'Título del evento...'}
              className="mt-4 w-full rounded-xl border border-white/[0.08] bg-[#030610] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/30"
              autoFocus
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (newEventTitle.trim()) {
                    setEvents((prev) => [
                      ...prev,
                      {
                        id: `manual-${Date.now()}`,
                        title: newEventTitle.trim(),
                        detail: language === 'en' ? 'Manual event' : 'Evento manual',
                        date: selectedDate.toISOString(),
                        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                        type: 'lead',
                      },
                    ]);
                  }
                  setNewEventTitle('');
                  setAddEventOpen(false);
                }}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-[#041018] hover:bg-cyan-400"
              >
                {language === 'en' ? 'Add event' : 'Agregar evento'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewEventTitle('');
                  setAddEventOpen(false);
                }}
                className="rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 hover:text-white"
              >
                {language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

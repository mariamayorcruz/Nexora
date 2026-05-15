'use client';

import { CalendarPlus2, Search, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AISuggestionBar from '@/components/AISuggestionBar';
import { useAppLanguage } from '@/hooks/use-app-language';

type ConversationFilter = 'all' | 'unread' | 'whatsapp' | 'sms' | 'email' | 'ai';
type SideFilter = 'all' | 'hot' | 'ai' | 'pending';
type ComposerTab = 'sms' | 'whatsapp' | 'email' | 'nota';

type LeadRow = {
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
  notes?: string | null;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  role: 'client' | 'ai' | 'team';
  text: string;
  time: string;
};

function channelForLead(lead: LeadRow): 'whatsapp' | 'sms' | 'email' {
  if (lead.phone && !lead.email) return 'sms';
  if (lead.phone) return 'whatsapp';
  return 'email';
}

function buildMessages(lead: LeadRow): ChatMessage[] {
  return [
    {
      id: `${lead.id}-1`,
      role: 'client',
      text: lead.notes || `Hola, quiero más información sobre ${lead.company || 'el servicio'}.`,
      time: '09:12',
    },
    {
      id: `${lead.id}-2`,
      role: 'ai',
      text: `Detecté intención alta. Recomiendo responder con una propuesta concreta y una CTA de agenda.`,
      time: '09:13',
    },
    {
      id: `${lead.id}-3`,
      role: 'team',
      text: lead.nextAction || 'Perfecto, te comparto opciones y te ayudo a mover esto hoy mismo.',
      time: '09:14',
    },
  ];
}

export default function ConversacionesPage() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [activeTab, setActiveTab] = useState<ConversationFilter>('all');
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerTab, setComposerTab] = useState<ComposerTab>('whatsapp');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    void fetch('/api/crm/leads', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data?.leads) ? data.leads : [];
        setLeads(rows.filter((lead: LeadRow) => Boolean(lead.phone || lead.email)));
      })
      .catch(() => setLeads([]));
  }, []);

  useEffect(() => {
    if (!selectedId && leads.length) setSelectedId(leads[0].id);
  }, [leads, selectedId]);

  const conversations = useMemo(() => {
    return leads.map((lead) => ({
      ...lead,
      channel: channelForLead(lead),
      unread: lead.confidence >= 60,
      aiActive: lead.stage !== 'won',
      hot: lead.confidence >= 75 || lead.value >= 2500,
      preview: lead.nextAction || lead.notes || 'Seguimiento pendiente con respuesta sugerida.',
    }));
  }, [leads]);

  const counts = useMemo(
    () => ({
      all: conversations.length,
      unread: conversations.filter((item) => item.unread).length,
      whatsapp: conversations.filter((item) => item.channel === 'whatsapp').length,
      sms: conversations.filter((item) => item.channel === 'sms').length,
      email: conversations.filter((item) => item.channel === 'email').length,
      ai: conversations.filter((item) => item.aiActive).length,
    }),
    [conversations]
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesText =
        !text ||
        conversation.name.toLowerCase().includes(text) ||
        String(conversation.company || '').toLowerCase().includes(text) ||
        String(conversation.preview || '').toLowerCase().includes(text);
      const matchesTop =
        activeTab === 'all' ||
        (activeTab === 'unread' && conversation.unread) ||
        activeTab === conversation.channel ||
        (activeTab === 'ai' && conversation.aiActive);
      const matchesSide =
        sideFilter === 'all' ||
        (sideFilter === 'hot' && conversation.hot) ||
        (sideFilter === 'ai' && conversation.aiActive) ||
        (sideFilter === 'pending' && conversation.stage !== 'won');
      return matchesText && matchesTop && matchesSide;
    });
  }, [activeTab, conversations, query, sideFilter]);

  const selected = filtered.find((item) => item.id === selectedId) || conversations.find((item) => item.id === selectedId) || null;
  const messages = selected ? buildMessages(selected) : [];

  useEffect(() => {
    if (!selected) return;
    setComposerTab(selected.channel);
  }, [selected]);

  const handleAiSuggest = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const token = localStorage.getItem('token');
      const prompt =
        language === 'en'
          ? `Suggest a short reply message for this lead. Name: ${selected.name}. Stage: ${selected.stage}. Notes: ${selected.notes || 'none'}. Next action: ${selected.nextAction || 'none'}. Channel: ${selected.channel.toUpperCase()}. Write only the reply message, 2-3 sentences max, no preamble.`
          : `Sugiere un mensaje de respuesta corto para este lead. Nombre: ${selected.name}. Etapa: ${selected.stage}. Notas: ${selected.notes || 'ninguna'}. Próxima acción: ${selected.nextAction || 'ninguna'}. Canal: ${selected.channel.toUpperCase()}. Escribe solo el mensaje de respuesta, máximo 2-3 oraciones, sin preámbulo.`;
      const response = await fetch('/api/support/assistant', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: prompt, page: 'conversaciones' }),
      });
      const data = await response.json();
      if (response.ok && data.reply) {
        setDraft(String(data.reply));
      }
    } catch {
      // silently fall back — user can still type manually
    } finally {
      setAiLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    setSendSuccess(false);
    setSendError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/crm/leads/${selected.id}/message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: composerTab,
          message: draft.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al enviar');
      setDraft('');
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Error al enviar');
      setTimeout(() => setSendError(''), 4000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#040810] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {([
              ['all', language === 'en' ? 'All' : 'Todos'],
              ['unread', language === 'en' ? 'Unread' : 'Sin leer'],
              ['whatsapp', 'WhatsApp'],
              ['sms', 'SMS'],
              ['email', 'Email'],
              ['ai', 'AI Agent'],
            ] as Array<[ConversationFilter, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-full px-3 py-1.5 text-xs transition-all duration-150 ${
                  activeTab === key ? 'bg-cyan-500/10 text-cyan-300' : 'bg-white/[0.03] text-slate-500 hover:text-white'
                }`}
              >
                {label} ({counts[key]})
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid min-h-[720px] gap-4 xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_220px]">
        <div className="rounded-[28px] bg-[#040810] p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={language === 'en' ? 'Search conversations...' : 'Buscar conversaciones...'}
              className="w-full rounded-2xl bg-[#030610] py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ['all', 'Todo'],
              ['hot', 'Hot'],
              ['ai', 'AI'],
              ['pending', 'Pendiente'],
            ] as Array<[SideFilter, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSideFilter(key)}
                className={`rounded-full px-3 py-1.5 text-[11px] transition-all duration-150 ${
                  sideFilter === key ? 'bg-white/[0.06] text-white' : 'bg-white/[0.03] text-slate-500 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {filtered.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedId(conversation.id)}
                className={`w-full rounded-[20px] px-3 py-3 text-left transition-all duration-150 hover:bg-white/[0.03] ${
                  selectedId === conversation.id ? 'border-l-2 border-cyan-400 bg-[rgba(6,182,212,0.04)]' : 'bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-semibold text-cyan-300">
                    {conversation.name.slice(0, 2).toUpperCase()}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-white">{conversation.name}</p>
                      <span className="text-[11px] text-slate-500">{new Date(conversation.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{conversation.preview}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300">{conversation.channel.toUpperCase()}</span>
                      {conversation.unread ? <span className="h-2 w-2 rounded-full bg-rose-400" /> : null}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="rounded-[20px] bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">
                {language === 'en' ? 'No conversations match this filter.' : 'No hay conversaciones para este filtro.'}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] bg-[#040810] p-4">
          {selected ? (
            <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-2 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/10 text-sm font-semibold text-cyan-300">
                    {selected.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">{selected.name}</p>
                    <p className="text-xs text-slate-500">
                      online · {selected.channel.toUpperCase()} · score {selected.confidence}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/crm?leadId=${selected.id}`)}
                    className="rounded-full bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:text-white"
                  >
                    {language === 'en' ? 'View lead' : 'Ver lead'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/calendario')}
                    className="rounded-full bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:text-white"
                  >
                    {language === 'en' ? 'Schedule' : 'Agendar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/crm?leadId=${selected.id}`)}
                    className={`rounded-full px-3 py-1.5 text-xs transition hover:opacity-80 ${
                      selected.aiActive ? 'bg-cyan-500/10 text-cyan-300' : 'bg-white/[0.04] text-slate-500'
                    }`}
                  >
                    {selected.aiActive
                      ? (language === 'en' ? 'AI active' : 'AI activo')
                      : (language === 'en' ? 'AI paused' : 'AI pausado')}
                  </button>
                </div>
              </div>

              <div className="space-y-3 px-2 py-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'team' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[90%] sm:max-w-[78%] px-4 py-3 text-sm leading-6 ${
                        message.role === 'client'
                          ? 'rounded-[2px_12px_12px_12px] bg-white/[0.05] text-slate-200'
                          : message.role === 'ai'
                          ? 'rounded-[16px] border border-white/[0.05] bg-[rgba(6,182,212,0.06)] text-slate-100'
                          : 'rounded-[16px] bg-cyan-500 text-[#041018]'
                      }`}
                    >
                      {message.role === 'ai' ? <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300">Nexora AI Agent</p> : null}
                      <p>{message.text}</p>
                      <p className={`mt-2 text-[11px] ${message.role === 'team' ? 'text-[#06313a]' : 'text-slate-500'}`}>{message.time}</p>
                    </div>
                  </div>
                ))}

              </div>

              <AISuggestionBar
                suggestion={
                  language === 'en'
                    ? `Use a low-friction CTA and offer two time slots.`
                    : `Usa una CTA de baja fricción y ofrece dos horarios concretos.`
                }
                actionLabel="Usar ->"
                onUse={() =>
                  setDraft(
                    language === 'en'
                      ? 'I can help today. Would 2:00 PM or 4:30 PM work better for you?'
                      : 'Te puedo ayudar hoy mismo. ¿Te funciona mejor 2:00 PM o 4:30 PM?'
                  )
                }
              />

              <div className="mt-4 rounded-[22px] bg-[#030610] p-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  {(['sms', 'whatsapp', 'email', 'nota'] as ComposerTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setComposerTab(tab)}
                      className={`rounded-full px-3 py-1.5 text-[11px] transition-all duration-150 ${
                        composerTab === tab ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void handleAiSuggest()}
                    disabled={aiLoading || !selected}
                    className="ml-auto rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300 transition hover:text-white disabled:opacity-50"
                  >
                    <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                    {aiLoading
                      ? (language === 'en' ? 'Generating...' : 'Generando...')
                      : 'IA'}
                  </button>
                </div>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={language === 'en' ? 'Write your reply...' : 'Escribe tu respuesta...'}
                  className="min-h-[120px] w-full resize-none rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                />
                {sendSuccess && (
                  <div className="mb-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                    {language === 'en' ? '✓ Message sent' : '✓ Mensaje enviado'}
                  </div>
                )}
                {sendError && (
                  <div className="mb-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                    {sendError}
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !draft.trim()}
                    className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400 disabled:opacity-50"
                  >
                    {sending
                      ? language === 'en' ? 'Sending...' : 'Enviando...'
                      : language === 'en' ? 'Send' : 'Enviar'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[520px] items-center justify-center rounded-[22px] bg-[#030610] px-6 text-center">
              <div>
                <p className="text-base font-medium text-white">
                  {language === 'en' ? 'Select a conversation' : 'Selecciona una conversación'}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {language === 'en'
                    ? 'The chat, AI suggestions and quick actions will appear here.'
                    : 'Aquí aparecerán el chat, las sugerencias IA y las acciones rápidas.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[28px] bg-[#040810] p-4 xl:col-span-2 2xl:col-span-1">
          {selected ? (
            <>
              <div className="rounded-[20px] bg-rose-500/10 px-3 py-3 text-sm text-rose-200">
                {language === 'en' ? 'AI Agent active · responding' : 'AI Agent activo · respondiendo'}
              </div>
              <div className="mt-4 space-y-3 rounded-[20px] bg-[#030610] p-4">
                {[
                  { label: language === 'en' ? 'Status' : 'Estado', value: selected.stage },
                  { label: 'Score', value: `${selected.confidence}%` },
                  { label: language === 'en' ? 'Value' : 'Valor', value: `$${selected.value.toLocaleString()}` },
                  { label: language === 'en' ? 'Channel' : 'Canal', value: selected.channel.toUpperCase() },
                  { label: language === 'en' ? 'Last activity' : 'Tiempo activo', value: new Date(selected.updatedAt).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES') },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{item.label}</span>
                    <span className="text-white">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[20px] bg-[#030610] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{language === 'en' ? 'Quick replies' : 'Respuestas rápidas'}</p>
                <div className="mt-3 space-y-2">
                  {(language === 'en'
                    ? [
                        'I\'ll send you two options and we can close today.',
                        'Do you prefer a quick call or a written proposal?',
                        'I can send you pricing and next steps right now.',
                      ]
                    : [
                        'Te mando dos opciones y cerramos hoy.',
                        '¿Prefieres llamada corta o mensaje con propuesta?',
                        'Puedo enviarte pricing y siguiente paso ahora.',
                      ]
                  ).map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setDraft(template)}
                      className="w-full rounded-2xl bg-white/[0.03] px-3 py-3 text-left text-xs text-slate-300 transition-all duration-150 hover:bg-white/[0.05] hover:text-white"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[20px] bg-[#030610] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{language === 'en' ? 'Channel history' : 'Historial de canales'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[selected.channel.toUpperCase(), 'AI Agent', 'CRM'].map((item) => (
                    <span key={item} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-300">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/calendario')}
                  className="flex-1 rounded-full bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition hover:text-white"
                >
                  <CalendarPlus2 className="mr-1 inline h-3.5 w-3.5" />
                  {language === 'en' ? 'Schedule' : 'Agendar'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/crm?leadId=${selected.id}`)}
                  className="flex-1 rounded-full bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300 transition hover:bg-cyan-500/15"
                >
                  {language === 'en' ? 'View lead' : 'Ver lead'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center rounded-[22px] bg-[#030610] px-5 text-center text-sm text-slate-500">
              {language === 'en' ? 'Lead context will appear here.' : 'Aquí aparecerá el contexto del lead.'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

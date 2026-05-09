'use client';

import { Mail, MessageCircle, Phone, PlusCircle, Send, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import AISuggestionBar from '@/components/AISuggestionBar';

export interface FocusLead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  stage: string;
  source: string;
  value: number;
  confidence: number;
  nextAction?: string | null;
  notes?: string | null;
  updatedAt: string;
}

type ComposerTab = 'whatsapp' | 'sms' | 'email' | 'nota';

const TAB_LABELS: Record<ComposerTab, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  nota: 'Nota',
};

export default function FocusPanel({
  lead,
  messageLabel,
  onSend,
}: {
  lead: FocusLead | null;
  messageLabel?: string;
  onSend?: (lead: FocusLead, channel: ComposerTab, text: string) => Promise<void> | void;
}) {
  const [activeTab, setActiveTab] = useState<ComposerTab>('whatsapp');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState('');

  const computed = useMemo(() => {
    if (!lead) return null;
    const tags = [];
    if (lead.confidence >= 75) tags.push('Alta intención');
    if (lead.confidence >= 45 && lead.confidence < 75) tags.push('Responde rápido');
    if ((lead.value || 0) >= 2500) tags.push('Ticket alto');
    if (!tags.length) tags.push('Seguimiento activo');
    return tags.slice(0, 2);
  }, [lead]);

  const handleSubmit = async () => {
    if (!lead || !draft.trim()) return;
    setSending(true);
    setSendSuccess(false);
    setSendError('');
    try {
      const token = localStorage.getItem('token');
      const messageToSend = draft.trim();
      const response = await fetch(`/api/crm/leads/${lead.id}/message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: activeTab,
          message: messageToSend,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al enviar');
      setDraft('');
      await onSend?.(lead, activeTab, messageToSend);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Error al enviar');
      setTimeout(() => setSendError(''), 4000);
    } finally {
      setSending(false);
    }
  };

  if (!lead) {
    return (
      <aside className="w-full shrink-0 rounded-[22px] bg-[#030610] p-4 sm:p-5 xl:w-[296px]">
        <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-[20px] border border-white/[0.05] bg-white/[0.02] px-6 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
            <Star className="h-4.5 w-4.5" />
          </div>
          <p className="mt-4 text-sm font-medium text-white">Selecciona un lead</p>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            Aquí verás score, timeline, tareas y el composer rápido para mover la conversación.
          </p>
        </div>
      </aside>
    );
  }

  const scoreColor =
    lead.confidence >= 75 ? 'from-cyan-400 via-cyan-300 to-emerald-400' : lead.confidence >= 45 ? 'from-cyan-400 via-amber-300 to-rose-400' : 'from-amber-400 via-rose-300 to-rose-500';

  const initials = lead.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <aside className="w-full shrink-0 rounded-[22px] bg-[#030610] p-4 xl:w-[296px]">
      <div className="space-y-4 rounded-[20px] bg-white/[0.02] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-sm font-semibold text-cyan-300">
            {initials || 'NX'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-white">{lead.name}</p>
            <p className="truncate text-xs text-slate-500">{lead.phone || lead.email || 'Sin contacto directo'}</p>
          </div>
        </div>

        <div className="rounded-[18px] bg-[#040810] p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Lead score</span>
            <span>{lead.confidence}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.04]">
            <div
              className={`h-2 rounded-full bg-gradient-to-r ${scoreColor}`}
              style={{ width: `${Math.max(6, Math.min(100, lead.confidence))}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {computed?.map((tag) => (
              <span key={tag} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { key: 'wa', label: 'WA', icon: MessageCircle },
            { key: 'sms', label: 'SMS', icon: Send },
            { key: 'mail', label: 'Email', icon: Mail },
            { key: 'call', label: 'Call', icon: Phone },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className="flex h-11 items-center justify-center rounded-2xl bg-white/[0.03] text-slate-300 transition-all duration-150 hover:-translate-y-[1px] hover:bg-white/[0.05] hover:text-white"
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <AISuggestionBar
          compact
          suggestion={messageLabel || lead.nextAction || 'Haz follow-up hoy para mantener el momentum.'}
          actionLabel="Acción ->"
          onUse={() => setDraft(messageLabel || lead.nextAction || '')}
        />

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Timeline</p>
          {[
            { color: 'bg-cyan-400', label: 'Lead creado', time: new Date(lead.updatedAt).toLocaleString('es-ES') },
            { color: 'bg-amber-400', label: lead.nextAction || 'Esperando siguiente acción', time: 'Ahora' },
            { color: 'bg-emerald-400', label: `Fuente: ${lead.source}`, time: lead.stage },
          ].map((event) => (
            <div key={`${event.label}-${event.time}`} className="flex gap-3">
              <span className={`mt-1.5 h-2 w-2 rounded-full ${event.color}`} />
              <div>
                <p className="text-xs text-slate-200">{event.label}</p>
                <p className="text-[11px] text-slate-500">{event.time}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Servicio', value: lead.company || 'General' },
            { label: 'Valor', value: `$${(lead.value || 0).toLocaleString()}` },
            { label: 'Tamaño', value: lead.company ? 'Empresa' : 'Lead directo' },
            { label: 'Etapa', value: lead.stage },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-[#040810] p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
              <p className="mt-1 text-xs text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tasks</p>
            <button type="button" className="text-slate-500 transition hover:text-white">
              <PlusCircle className="h-4 w-4" />
            </button>
          </div>
          {[
            { done: false, label: 'Responder mensaje inicial', due: 'Hoy' },
            { done: lead.stage === 'won', label: 'Actualizar etapa', due: 'Antes de cierre' },
          ].map((task) => (
            <label key={task.label} className="flex items-center gap-3 rounded-2xl bg-[#040810] px-3 py-2.5">
              <input type="checkbox" checked={task.done} readOnly className="h-4 w-4 rounded accent-cyan-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-200">{task.label}</p>
                <p className="text-[11px] text-slate-500">{task.due}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="space-y-3 rounded-[18px] bg-[#040810] p-3">
          <div className="flex flex-wrap gap-1">
            {(['whatsapp', 'sms', 'email', 'nota'] as ComposerTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-3 py-1.5 text-[11px] transition-all duration-150 ${
                  activeTab === tab ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-500 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Escribe ${TAB_LABELS[activeTab].toLowerCase()}...`}
            className="min-h-[92px] w-full resize-none rounded-2xl bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
          {sendSuccess && (
            <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              ✓ Mensaje enviado correctamente
            </div>
          )}
          {sendError && (
            <div className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              {sendError}
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={sending || !draft.trim()}
            className="w-full rounded-2xl bg-cyan-500 px-3 py-2.5 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400 disabled:opacity-50"
          >
            {sending ? 'Enviando...' : `Enviar por ${TAB_LABELS[activeTab]}`}
          </button>
        </div>
      </div>
    </aside>
  );
}

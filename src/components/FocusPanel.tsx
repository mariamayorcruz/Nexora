'use client';

import { PlusCircle, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AISuggestionBar from '@/components/AISuggestionBar';
import { useAppLanguage } from '@/hooks/use-app-language';

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

function getTabLabel(tab: ComposerTab, en: boolean): string {
  if (tab === 'nota') return en ? 'Note' : 'Nota';
  return TAB_LABELS[tab];
}

export default function FocusPanel({
  lead,
  riskLabel,
  messageLabel,
  onSend,
}: {
  lead: FocusLead | null;
  riskLabel?: string;
  messageLabel?: string;
  onSend?: (lead: FocusLead, channel: ComposerTab, text: string) => Promise<void> | void;
}) {
  const { language } = useAppLanguage();
  const en = language === 'en';
  const [activeTab, setActiveTab] = useState<ComposerTab>('whatsapp');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [tasks, setTasks] = useState<Array<{ label: string; done: boolean; due: string }>>([]);

  const computed = useMemo(() => {
    if (!lead) return null;
    const tags = [];
    if (lead.confidence >= 75) tags.push(en ? 'High intent' : 'Alta intención');
    if (lead.confidence >= 45 && lead.confidence < 75) tags.push(en ? 'Quick responder' : 'Responde rápido');
    if ((lead.value || 0) >= 2500) tags.push(en ? 'High value' : 'Ticket alto');
    if (!tags.length) tags.push(en ? 'Active follow-up' : 'Seguimiento activo');
    return tags.slice(0, 2);
  }, [en, lead]);

  useEffect(() => {
    if (!lead) return;
    setTasks([
      {
        done: false,
        label: en ? 'Reply to first message' : 'Responder mensaje inicial',
        due: en ? 'Today' : 'Hoy',
      },
      {
        done: lead.stage === 'won',
        label: en ? 'Update stage' : 'Actualizar etapa',
        due: en ? 'Before close' : 'Antes de cierre',
      },
    ]);
    setAddingTask(false);
    setNewTask('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, lead?.stage]);

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
      if (!response.ok) throw new Error(data.error || (en ? 'Could not send' : 'Error al enviar'));
      setDraft('');
      await onSend?.(lead, activeTab, messageToSend);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : en ? 'Could not send' : 'Error al enviar');
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
          <p className="mt-4 text-sm font-medium text-white">{en ? 'Select a lead' : 'Selecciona un lead'}</p>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            {en
              ? 'Score, timeline, tasks, and composer appear here once you choose someone to focus on.'
              : 'Aquí verás score, timeline, tareas y el composer rápido para mover la conversación.'}
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
            <p className="truncate text-xs text-slate-500">
              {lead.phone || lead.email || (en ? 'No direct contact' : 'Sin contacto directo')}
            </p>
          </div>
        </div>

        <div className="rounded-[18px] bg-[#040810] p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>{en ? 'Lead score' : 'Score del lead'}</span>
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

        <AISuggestionBar
          compact
          suggestion={
            riskLabel ||
            messageLabel ||
            lead.nextAction ||
            (en ? 'Follow up today while momentum is still warm.' : 'Haz follow-up hoy para mantener el momentum.')
          }
          actionLabel={en ? 'Use suggestion' : 'Usar sugerencia'}
          onUse={() => setDraft(riskLabel || messageLabel || lead.nextAction || '')}
        />

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Timeline</p>
          {[
            {
              color: 'bg-cyan-400',
              label: en ? 'Lead created' : 'Lead creado',
              time: new Date(lead.updatedAt).toLocaleString(en ? 'en-US' : 'es-ES'),
            },
            {
              color: 'bg-amber-400',
              label: lead.nextAction || (en ? 'Waiting for next step' : 'Esperando siguiente acción'),
              time: en ? 'Now' : 'Ahora',
            },
            {
              color: 'bg-emerald-400',
              label: `${en ? 'Source' : 'Fuente'}: ${lead.source}`,
              time: lead.stage,
            },
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
            { label: en ? 'Service' : 'Servicio', value: lead.company || (en ? 'General' : 'General') },
            { label: en ? 'Value' : 'Valor', value: `$${(lead.value || 0).toLocaleString()}` },
            {
              label: en ? 'Size' : 'Tamaño',
              value: lead.company ? (en ? 'Company' : 'Empresa') : en ? 'Direct lead' : 'Lead directo',
            },
            { label: en ? 'Stage' : 'Etapa', value: lead.stage },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-[#040810] p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
              <p className="mt-1 text-xs text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{en ? 'Tasks' : 'Tareas'}</p>
            <button
              type="button"
              onClick={() => setAddingTask(true)}
              className="text-slate-500 transition hover:text-white"
            >
              <PlusCircle className="h-4 w-4" />
            </button>
          </div>
          {addingTask && (
            <div className="mt-2 flex gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTask.trim()) {
                    setTasks((prev) => [
                      ...prev,
                      {
                        label: newTask.trim(),
                        done: false,
                        due: en ? 'Today' : 'Hoy',
                      },
                    ]);
                    setNewTask('');
                    setAddingTask(false);
                  }
                  if (e.key === 'Escape') {
                    setNewTask('');
                    setAddingTask(false);
                  }
                }}
                placeholder={en ? 'New task...' : 'Nueva tarea...'}
                className="flex-1 rounded-xl bg-[#030610] border border-cyan-500/20 px-3 py-1.5 text-xs text-white outline-none placeholder:text-slate-600"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  if (newTask.trim()) {
                    setTasks((prev) => [
                      ...prev,
                      {
                        label: newTask.trim(),
                        done: false,
                        due: en ? 'Today' : 'Hoy',
                      },
                    ]);
                  }
                  setNewTask('');
                  setAddingTask(false);
                }}
                className="rounded-xl bg-cyan-500 px-2 py-1.5 text-xs text-white hover:bg-cyan-400"
              >
                ✓
              </button>
            </div>
          )}
          {tasks.map((task, index) => (
            <label key={`${task.label}-${index}`} className="flex items-center gap-3 rounded-2xl bg-[#040810] px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => setTasks((prev) => prev.map((t, i) => i === index ? { ...t, done: !t.done } : t))}
                className="h-4 w-4 rounded accent-cyan-400"
              />
              <div className="min-w-0 flex-1">
                <p className={`text-xs ${task.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                  {task.label}
                </p>
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
                {getTabLabel(tab, en)}
              </button>
            ))}
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              en
                ? `Write your ${getTabLabel(activeTab, en).toLowerCase()} message...`
                : `Escribe ${getTabLabel(activeTab, en).toLowerCase()}...`
            }
            className="min-h-[92px] w-full resize-none rounded-2xl bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
          {sendSuccess && (
            <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              {en ? '✓ Message sent' : '✓ Mensaje enviado correctamente'}
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
            {sending
              ? en
                ? 'Sending...'
                : 'Enviando...'
              : en
                ? `Send via ${getTabLabel(activeTab, en)}`
                : `Enviar por ${getTabLabel(activeTab, en)}`}
          </button>
        </div>
      </div>
    </aside>
  );
}

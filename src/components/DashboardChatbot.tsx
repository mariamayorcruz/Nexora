'use client';

import { useState } from 'react';

interface SupportReply {
  title: string;
  message: string;
  nextSteps: string[];
}

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
  steps?: string[];
  title?: string;
}

const STARTERS = [
  '¿Qué debería revisar si mi campaña tiene gasto pero no convierte?',
  'Ayúdame a priorizar Instagram, Facebook o Google para vender mejor.',
  '¿Cómo debería enfocar mi próxima campaña esta semana?',
];

export default function DashboardChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      role: 'assistant',
      title: 'Asistente Nexora',
      text: 'Puedo ayudarte con campañas, creatividad, conexiones, soporte y facturación sin salir del panel.',
      steps: ['Pregunta en lenguaje natural.', 'Te devuelvo diagnóstico y siguiente paso.', 'Si hace falta, luego escalamos a soporte humano.'],
    },
  ]);

  const askAssistant = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setMessages((current) => [...current, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/support/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No pudimos responder.');
      }

      const reply = data.reply as SupportReply;
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          title: reply.title,
          text: reply.message,
          steps: reply.nextSteps,
        },
      ]);
    } catch (error) {
      console.error('Error in dashboard chatbot:', error);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          title: 'Sin respuesta por ahora',
          text: 'No pude responder en este momento, pero puedes volver a intentarlo o abrir el centro de soporte.',
          steps: ['Repite la consulta en unos segundos.', 'Si el problema es urgente, usa el centro de soporte del panel.'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full border border-slate-800 bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_24px_80px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:bg-slate-900"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-amber-300 to-cyan-400 text-xs font-bold text-slate-950">
          IA
        </span>
        {open ? 'Cerrar asistente' : 'Abrir asistente'}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.22)]">
          <div className="bg-[linear-gradient(135deg,#0f172a_0%,#111827_58%,#0b3b52_100%)] px-5 py-5 text-white">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Chatbot Nexora</p>
            <h3 className="mt-2 text-xl font-semibold">Asistencia estratégica dentro del panel</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Resuelve dudas de campañas, creatividad, facturación y conexiones sin salir de tu flujo.
            </p>
          </div>

          <div className="max-h-[420px] space-y-4 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl px-4 py-4 ${
                  message.role === 'assistant'
                    ? 'border border-slate-200 bg-white text-slate-700'
                    : 'ml-10 bg-slate-950 text-white'
                }`}
              >
                {message.title && <p className="text-xs uppercase tracking-[0.22em] text-cyan-600">{message.title}</p>}
                <p className={`mt-2 text-sm leading-6 ${message.role === 'assistant' ? 'text-slate-700' : 'text-white'}`}>
                  {message.text}
                </p>
                {message.steps && (
                  <div className="mt-3 space-y-2">
                    {message.steps.map((step) => (
                      <div key={step} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {step}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                Analizando tu consulta...
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  onClick={() => askAssistant(starter)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white"
                >
                  {starter}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribe tu consulta..."
                className="input-field min-h-[82px] flex-1 resize-none"
              />
              <button onClick={() => askAssistant(input)} disabled={loading} className="btn-primary self-end disabled:opacity-60">
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

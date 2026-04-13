'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface CampaignDraft {
  name: string;
  objective: string;
  channel: string;
  budget: number;
  status: 'draft';
  launchWindow: string;
  hook: string;
  promise: string;
  cta: string;
  angle: string;
  checklist: string[];
}

interface SupportReply {
  title: string;
  message: string;
  nextSteps: string[];
  campaignDraft?: CampaignDraft;
}

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
  steps?: string[];
  title?: string;
  campaignDraft?: CampaignDraft;
}

const STARTERS = [
  'Quiero lanzar una campaña esta semana, ¿por dónde empiezo?',
  'Mi campaña tiene gasto pero no convierte, ¿qué reviso primero?',
  'Ayúdame a definir hook, promesa y CTA para mi próxima campaña.',
];

export default function DashboardChatbot() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [providerInput, setProviderInput] = useState<'auto' | 'claude' | 'gemini' | 'openrouter'>('openrouter');
  const [aiActive, setAiActive] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      role: 'assistant',
      title: 'Asistente Nexora',
      text: 'Puedo ayudarte a pensar campañas, mensajes, conexiones, funnel, CRM, soporte y facturación sin salir del panel.',
      steps: [
        'Pregunta en lenguaje natural lo que quieres lanzar o corregir.',
        'Te devuelvo diagnóstico, enfoque y siguiente paso.',
        'Uso el contexto de la pantalla actual para darte una respuesta más útil.',
      ],
    },
  ]);

  // Cargar configuración de API key guardada
  useState(() => {
    const savedKey = localStorage.getItem('nexora_ai_api_key') || '';
    const savedProvider = (localStorage.getItem('nexora_ai_provider') || 'openrouter') as typeof providerInput;
    setApiKeyInput(savedKey);
    setProviderInput(savedProvider);
    setAiActive(Boolean(savedKey));
  });

  const saveApiConfig = () => {
    const key = apiKeyInput.trim();
    localStorage.setItem('nexora_ai_api_key', key);
    localStorage.setItem('nexora_ai_provider', providerInput);
    setAiActive(Boolean(key));
    setShowApiConfig(false);
  };

  const askAssistant = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setMessages((current) => [...current, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

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
          message: trimmed,
          page: pathname,
          aiProvider,
          aiApiKey: aiApiKey.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No pudimos responder.');
      }

      const reply = data.reply as SupportReply;
      const isHeuristic = data.ai?.providerUsed === 'heuristic';
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          title: reply.title,
          text: reply.message + (isHeuristic ? '\n\n[Modo básico — configura una API key para respuestas con IA real]' : ''),
          steps: reply.nextSteps,
          campaignDraft: reply.campaignDraft,
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

  const handleCreateCampaignDraft = async (draft: CampaignDraft) => {
    setCreatingDraft(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/campaigns/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draft),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data?.code === 'NO_CONNECTED_AD_ACCOUNT' || data?.code === 'NO_CONNECTED_ACCOUNTS') {
          setMessages((current) => [
            ...current,
            {
              role: 'assistant',
              title: 'Primero conecta una cuenta',
              text: 'Necesitas conectar al menos una cuenta publicitaria antes de crear una campana.',
              steps: ['Abre Conectar redes.', 'Conecta Meta, Google o TikTok.', 'Vuelve al chat y crea el borrador.'],
            },
          ]);
          router.push('/dashboard/connect');
          return;
        }

        throw new Error(data.error || 'No se pudo crear el borrador.');
      }

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          title: 'Borrador creado',
          text: `Listo: cree la campana "${data.campaign?.name || draft.name}" con estado draft.`,
          steps: ['Abre Campanas para revisarla.', 'Ajusta presupuesto y mensaje.', 'Luego publicala en tu plataforma conectada.'],
        },
      ]);
      router.push('/dashboard/campaigns');
    } catch (error) {
      console.error('Error creating campaign draft from chatbot:', error);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          title: 'No pude crear el borrador',
          text: 'Hubo un problema creando la campana desde el chat. Puedes intentar de nuevo en unos segundos.',
          steps: ['Verifica que tu sesion siga activa.', 'Reintenta desde el mismo mensaje.', 'Si persiste, usa Soporte.'],
        },
      ]);
    } finally {
      setCreatingDraft(false);
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
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Chatbot Nexora</p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${aiActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${aiActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {aiActive ? 'IA activa' : 'Modo básico'}
                </span>
                <button
                  onClick={() => setShowApiConfig((v) => !v)}
                  className="rounded px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
                  title="Configurar API key"
                >
                  ⚙ API Key
                </button>
              </div>
            </div>
            <h3 className="mt-2 text-xl font-semibold">Asistencia estratégica dentro del panel</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Resuelve dudas de campañas, creatividad, propuestas, facturación y conexiones sin salir de tu flujo.
            </p>

            {showApiConfig && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs font-medium text-slate-200">Conecta tu propia API key para activar IA real</p>
                <select
                  value={providerInput}
                  onChange={(e) => setProviderInput(e.target.value as typeof providerInput)}
                  className="mb-2 w-full rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-white"
                >
                  <option value="auto">Auto (Claude → Gemini → OpenRouter → Ollama)</option>
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="gemini">Gemini (Google)</option>
                  <option value="openrouter">OpenRouter (gratis disponible)</option>
                  <option value="ollama">Ollama (local)</option>
                </select>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-... / AIza... / sk-or-..."
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-slate-500"
                />
                <div className="mt-2 flex gap-2">
                  <button onClick={saveApiConfig} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500">
                    Guardar
                  </button>
                  {aiActive && (
                    <button
                      onClick={() => { setApiKeyInput(''); localStorage.removeItem('nexora_ai_api_key'); setAiActive(false); setShowApiConfig(false); }}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                    >
                      Quitar key
                    </button>
                  )}
                </div>
              </div>
            )}
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

                {message.role === 'assistant' && message.campaignDraft ? (
                  <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Borrador sugerido</p>
                    <p className="mt-2 text-sm text-cyan-950">
                      {message.campaignDraft.name} · {message.campaignDraft.channel} · ${message.campaignDraft.budget}
                    </p>
                    <p className="mt-2 text-xs text-cyan-900"><strong>Hook:</strong> {message.campaignDraft.hook}</p>
                    <p className="mt-1 text-xs text-cyan-900"><strong>Promesa:</strong> {message.campaignDraft.promise}</p>
                    <p className="mt-1 text-xs text-cyan-900"><strong>CTA:</strong> {message.campaignDraft.cta}</p>
                    <p className="mt-1 text-xs text-cyan-900"><strong>Angulo:</strong> {message.campaignDraft.angle}</p>
                    {message.campaignDraft.checklist?.length ? (
                      <div className="mt-2 space-y-1">
                        {message.campaignDraft.checklist.slice(0, 5).map((item) => (
                          <div key={item} className="rounded-lg bg-white/70 px-2 py-1 text-[11px] text-cyan-950">
                            {item}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <button
                      onClick={() => handleCreateCampaignDraft(message.campaignDraft as CampaignDraft)}
                      disabled={creatingDraft}
                      className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {creatingDraft ? 'Creando...' : 'Crear borrador en Campanas'}
                    </button>
                  </div>
                ) : null}
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

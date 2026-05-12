'use client';

import { useEffect, useState } from 'react';
import { Bot, Cpu, Layers, Zap } from 'lucide-react';

interface SupportReply {
  title: string;
  message: string;
  nextSteps: string[];
  campaignDraft?: {
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
  };
}

interface DashboardSupportUser {
  entitlements?: {
    marketingLabel: string;
    capabilities: {
      canUsePrioritySupport: boolean;
    };
  } | null;
}

const PROVIDER_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  claude: { label: 'Claude (Anthropic)', icon: <Cpu className="h-3 w-3" />, color: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-300' },
  gemini: { label: 'Gemini (Google)', icon: <Layers className="h-3 w-3" />, color: 'border-blue-400/20 bg-blue-500/10 text-blue-300' },
  openrouter: { label: 'OpenRouter (Llama / Mistral)', icon: <Zap className="h-3 w-3" />, color: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' },
  heuristic: { label: 'Motor Nexora', icon: <Bot className="h-3 w-3" />, color: 'border-white/10 bg-slate-800 text-slate-300' },
};

export default function SupportPage() {
  const [user, setUser] = useState<DashboardSupportUser | null>(null);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<SupportReply | null>(null);
  const [supportEmail, setSupportEmail] = useState('support@nexora.com');
  const [loading, setLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState<'auto' | 'heuristic' | 'claude' | 'gemini' | 'openrouter'>('auto');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [providerUsed, setProviderUsed] = useState<string>('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    const savedProvider = localStorage.getItem('nexora_ai_provider');
    const savedKey = localStorage.getItem('nexora_ai_api_key');
    if (savedProvider === 'auto' || savedProvider === 'heuristic' || savedProvider === 'claude' || savedProvider === 'gemini' || savedProvider === 'openrouter') {
      setAiProvider(savedProvider);
    }
    if (savedKey) setAiApiKey(savedKey);

    const loadUser = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error('Error loading support user:', error);
      }
    };

    void loadUser();
  }, []);

  const handleAsk = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setDraftSaved(false);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/support/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, aiProvider, aiApiKey: aiApiKey.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos responder.');
      setReply(data.reply);
      setSupportEmail(data.supportEmail || 'support@nexora.com');
      setProviderUsed(data?.ai?.providerUsed || 'heuristic');
      setAiStatus('');
    } catch (error) {
      console.error('Error asking support assistant:', error);
      setReply({
        title: 'No disponible por ahora',
        message: 'El asistente no pudo responder en este momento. Puedes escribir al soporte y te ayudamos manualmente.',
        nextSteps: ['Escribe tu caso por email.', 'Incluye una captura o explica qué estabas intentando hacer.'],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!reply?.campaignDraft) return;
    setSavingDraft(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/campaigns/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(reply.campaignDraft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDraftSaved(true);
      setAiStatus('Borrador guardado. Puedes verlo en Campañas.');
    } catch {
      setAiStatus('No se pudo guardar el borrador. Intenta de nuevo.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveAiConfig = () => {
    localStorage.setItem('nexora_ai_provider', aiProvider);
    if (aiApiKey.trim()) {
      localStorage.setItem('nexora_ai_api_key', aiApiKey.trim());
      setAiStatus('Configuración IA guardada (BYOK activo en este navegador).');
      return;
    }
    localStorage.removeItem('nexora_ai_api_key');
    setAiStatus('Configuración IA guardada. Sin clave propia, se usa crédito de plataforma si existe.');
  };

  const providerBadge = PROVIDER_META[providerUsed];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-[#040810] px-6 py-7 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">✦ Soporte</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
          Soporte IA + operación asistida
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Pregunta sobre campañas, métricas, configuración o pide que el asistente cree borradores ejecutables.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[20px] bg-[#05080f] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Plan actual</p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.02em] text-white">{user?.entitlements?.marketingLabel || 'Starter'}</p>
          </div>
          <div className="rounded-[20px] bg-[#05080f] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Soporte IA</p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.02em] text-white">Activo · 4 proveedores</p>
          </div>
          <div className="rounded-[20px] bg-[#05080f] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Escalado humano</p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.02em] text-white">
              {user?.entitlements?.capabilities.canUsePrioritySupport ? 'Prioritario' : 'Por email'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] bg-[#040810] p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Asistente</p>
          <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-white">Asistente IA</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Escribe tu duda o pide que genere una campaña. Puede crear borradores ejecutables directamente desde el chat.
          </p>

          <div className="mt-5 rounded-[22px] bg-[#030610] p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Proveedor IA</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as typeof aiProvider)}
                className="w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/10"
              >
                <option value="auto">Auto — Claude → Gemini → Llama</option>
                <option value="openrouter">OpenRouter (Llama / Mistral)</option>
                <option value="claude">Forzar Claude</option>
                <option value="gemini">Forzar Gemini</option>
                <option value="heuristic">Solo Nexora (sin proveedor externo)</option>
              </select>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="API key BYOK (opcional)"
                className="w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/10"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleSaveAiConfig}
                type="button"
                className="rounded-2xl bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
              >
                Guardar configuración IA
              </button>
              <button
                onClick={() => {
                  setAiApiKey('');
                  localStorage.removeItem('nexora_ai_api_key');
                  setAiStatus('Clave local eliminada de este navegador.');
                }}
                type="button"
                className="rounded-2xl bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
              >
                Limpiar clave local
              </button>
            </div>
            {aiStatus && <p className="mt-2 text-xs text-slate-400">{aiStatus}</p>}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleAsk(); }}
            className="mt-5 min-h-[180px] w-full resize-none rounded-[22px] bg-[#030610] px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/10"
            placeholder="Ejemplo: mi campaña tiene gasto pero no convierte, ¿qué debería revisar primero? O: crea una campaña de reconocimiento de marca para Instagram con $50/día"
          />
          <p className="mt-1 text-xs text-slate-500">Ctrl+Enter para enviar</p>

          <button
            onClick={() => void handleAsk()}
            disabled={loading}
            className="mt-4 w-full rounded-[22px] bg-cyan-500 px-4 py-3 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? 'Analizando...' : 'Preguntar al asistente IA'}
          </button>
        </div>

        <div className="rounded-[28px] bg-[#040810] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Respuesta</p>
              <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-white">Respuesta y acciones</h2>
            </div>
            {providerBadge && (
              <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${providerBadge.color}`}>
                {providerBadge.icon}
                {providerBadge.label}
              </span>
            )}
          </div>

          {reply ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] bg-[#030610] p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{reply.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-200">{reply.message}</p>
              </div>

              {reply.nextSteps.map((step) => (
                <div key={step} className="rounded-[20px] bg-[#030610] p-4 text-sm text-slate-300">
                  {step}
                </div>
              ))}

              {reply.campaignDraft && (
                <div className="rounded-[22px] bg-[rgba(6,182,212,0.06)] p-5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Borrador IA listo para guardar</p>
                  <p className="mt-2 text-base font-semibold text-white">{reply.campaignDraft.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-300">{reply.campaignDraft.objective}</span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-300">{reply.campaignDraft.channel}</span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-300">${reply.campaignDraft.budget}/día</span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-300">{reply.campaignDraft.launchWindow}</span>
                  </div>
                  {reply.campaignDraft.hook && (
                    <p className="mt-3 text-xs text-slate-300"><span className="font-semibold text-white">Hook:</span> {reply.campaignDraft.hook}</p>
                  )}
                  {reply.campaignDraft.cta && (
                    <p className="mt-1 text-xs text-slate-300"><span className="font-semibold text-white">CTA:</span> {reply.campaignDraft.cta}</p>
                  )}
                  <button
                    onClick={() => void handleSaveDraft()}
                    disabled={savingDraft || draftSaved}
                    className={`mt-4 w-full rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                      draftSaved
                        ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 cursor-default'
                        : 'border border-white/10 text-slate-200 hover:border-cyan-400/30 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    {draftSaved ? '✓ Borrador guardado en Campañas' : savingDraft ? 'Guardando...' : 'Guardar borrador en mis campañas →'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] bg-[#030610] p-5 text-sm leading-6 text-slate-400">
              Aún no hay consulta. Cuando escribas una duda, aquí aparecerán diagnóstico, pasos recomendados y borradores ejecutables.
            </div>
          )}

          <div className="mt-6 rounded-[22px] bg-[#030610] p-4 text-sm text-slate-400">
            Si necesitas seguimiento humano, escribe a <span className="font-semibold text-slate-200">{supportEmail}</span>.
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-[#040810] p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Infraestructura</p>
        <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-white">Proveedores disponibles</h2>
        <p className="mt-2 text-sm text-slate-400">El sistema usa una cadena de fallback para que siempre haya respuesta IA, incluso sin claves propias configuradas.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {([
            { key: 'claude', label: 'Claude 3.5', detail: 'Anthropic · Mejor razonamiento', icon: <Cpu className="h-5 w-5 text-cyan-400" /> },
            { key: 'gemini', label: 'Gemini 1.5', detail: 'Google · Velocidad + contexto', icon: <Layers className="h-5 w-5 text-blue-400" /> },
            { key: 'openrouter', label: 'Llama / Mistral', detail: 'OpenRouter · Gratis permanente', icon: <Zap className="h-5 w-5 text-emerald-400" /> },
            { key: 'heuristic', label: 'Motor Nexora', detail: 'Sin API · Siempre disponible', icon: <Bot className="h-5 w-5 text-slate-400" /> },
          ] as const).map((item) => (
            <div key={item.key} className="rounded-[22px] bg-[#030610] p-4">
              {item.icon}
              <p className="mt-2 text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

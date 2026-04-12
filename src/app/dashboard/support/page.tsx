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
  claude: { label: 'Claude (Anthropic)', icon: <Cpu className="h-3 w-3" />, color: 'text-violet-600 bg-violet-50 border-violet-200' },
  gemini: { label: 'Gemini (Google)', icon: <Layers className="h-3 w-3" />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  openrouter: { label: 'OpenRouter (Llama / Mistral)', icon: <Zap className="h-3 w-3" />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  heuristic: { label: 'Motor Nexora', icon: <Bot className="h-3 w-3" />, color: 'text-slate-600 bg-slate-50 border-slate-200' },
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

    loadUser();
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
      <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#ecfeff_100%)] p-8 shadow-[0_20px_70px_rgba(15,23,42,0.07)]">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Postventa y soporte</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Asistente IA + Media Buyer autónomo</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Pregunta sobre campañas, métricas, configuración o pide que el asistente cree borradores ejecutables. Los borradores se guardan directamente en tu cuenta con un clic.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <p className="text-sm text-slate-500">Plan actual</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{user?.entitlements?.marketingLabel || 'Starter'}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <p className="text-sm text-slate-500">Soporte IA</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">Activo · 4 proveedores</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <p className="text-sm text-slate-500">Escalado humano</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {user?.entitlements?.capabilities.canUsePrioritySupport ? 'Prioritario' : 'Por email'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <h2 className="text-xl font-semibold text-slate-900">Asistente IA</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Escribe tu duda o pide que genere una campaña. Puede crear borradores ejecutables directamente desde el chat.
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Proveedor IA</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as typeof aiProvider)}
                className="input-field"
              >
                <option value="auto">Auto — Claude → Gemini → Llama (gratis)</option>
                <option value="openrouter">OpenRouter (Llama / Mistral gratis)</option>
                <option value="claude">Forzar Claude</option>
                <option value="gemini">Forzar Gemini</option>
                <option value="heuristic">Solo Nexora (sin proveedor externo)</option>
              </select>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="API key BYOK (Claude, Gemini o OpenRouter)"
                className="input-field"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={handleSaveAiConfig} type="button" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                Guardar configuración IA
              </button>
              <button
                onClick={() => {
                  setAiApiKey('');
                  localStorage.removeItem('nexora_ai_api_key');
                  setAiStatus('Clave local eliminada de este navegador.');
                }}
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Limpiar clave local
              </button>
            </div>
            {aiStatus ? <p className="mt-2 text-xs text-slate-500">{aiStatus}</p> : null}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { void handleAsk(); } }}
            className="input-field mt-5 min-h-[180px] w-full"
            placeholder="Ejemplo: mi campaña tiene gasto pero no convierte, ¿qué debería revisar primero? O: crea una campaña de reconocimiento de marca para Instagram con $50/día"
          />
          <p className="mt-1 text-xs text-slate-400">Ctrl+Enter para enviar</p>

          <button onClick={handleAsk} disabled={loading} className="mt-4 btn-primary disabled:opacity-60">
            {loading ? 'Analizando...' : 'Preguntar al asistente IA'}
          </button>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Respuesta y acciones</h2>
            {providerBadge && (
              <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${providerBadge.color}`}>
                {providerBadge.icon}
                {providerBadge.label}
              </span>
            )}
          </div>

          {reply ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-sm uppercase tracking-[0.22em] text-slate-300">{reply.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-100">{reply.message}</p>
              </div>

              {reply.nextSteps.map((step) => (
                <div key={step} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  {step}
                </div>
              ))}

              {reply.campaignDraft && (
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-cyan-600">Borrador IA listo para guardar</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{reply.campaignDraft.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-white px-2.5 py-1 border border-slate-200">{reply.campaignDraft.objective}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 border border-slate-200">{reply.campaignDraft.channel}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 border border-slate-200">${reply.campaignDraft.budget}/día</span>
                    <span className="rounded-full bg-white px-2.5 py-1 border border-slate-200">{reply.campaignDraft.launchWindow}</span>
                  </div>
                  {reply.campaignDraft.hook && (
                    <p className="mt-3 text-xs text-slate-700"><span className="font-semibold">Hook:</span> {reply.campaignDraft.hook}</p>
                  )}
                  {reply.campaignDraft.cta && (
                    <p className="mt-1 text-xs text-slate-700"><span className="font-semibold">CTA:</span> {reply.campaignDraft.cta}</p>
                  )}
                  <button
                    onClick={handleSaveDraft}
                    disabled={savingDraft || draftSaved}
                    className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${draftSaved ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60'}`}
                  >
                    {draftSaved ? '✓ Borrador guardado en Campañas' : savingDraft ? 'Guardando...' : 'Guardar borrador en mis campañas →'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              Aún no hay consulta. Cuando escribas una duda, aquí aparecerán diagnóstico, pasos recomendados y borradores ejecutables.
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
            Si necesitas seguimiento humano, escribe a <span className="font-semibold text-slate-900">{supportEmail}</span>.
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
        <h2 className="text-lg font-semibold text-slate-900">Proveedores disponibles (sin corte de crédito)</h2>
        <p className="mt-2 text-sm text-slate-500">El sistema usa una cadena de fallback para que siempre haya respuesta IA, incluso sin claves propias configuradas.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {([
            { key: 'claude', label: 'Claude 3.5', detail: 'Anthropic · Mejor razonamiento', icon: <Cpu className="h-5 w-5 text-violet-500" /> },
            { key: 'gemini', label: 'Gemini 1.5', detail: 'Google · Velocidad + contexto', icon: <Layers className="h-5 w-5 text-blue-500" /> },
            { key: 'openrouter', label: 'Llama / Mistral', detail: 'OpenRouter · Gratis permanente', icon: <Zap className="h-5 w-5 text-emerald-500" /> },
            { key: 'heuristic', label: 'Motor Nexora', detail: 'Sin API · Siempre disponible', icon: <Bot className="h-5 w-5 text-slate-500" /> },
          ] as const).map((item) => (
            <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {item.icon}
              <p className="mt-2 text-sm font-semibold text-slate-800">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

interface DashboardSupportUser {
  entitlements?: {
    marketingLabel: string;
    capabilities: {
      canUsePrioritySupport: boolean;
    };
  } | null;
}

export default function SupportPage() {
  const [user, setUser] = useState<DashboardSupportUser | null>(null);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<SupportReply | null>(null);
  const [supportEmail, setSupportEmail] = useState('support@nexora.com');
  const [loading, setLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState<'auto' | 'heuristic' | 'claude' | 'gemini'>('auto');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiStatus, setAiStatus] = useState('');

  useEffect(() => {
    const savedProvider = localStorage.getItem('nexora_ai_provider');
    const savedKey = localStorage.getItem('nexora_ai_api_key');
    if (savedProvider === 'auto' || savedProvider === 'heuristic' || savedProvider === 'claude' || savedProvider === 'gemini') {
      setAiProvider(savedProvider);
    }
    if (savedKey) {
      setAiApiKey(savedKey);
    }

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

    loadUser();
  }, []);

  const handleAsk = async () => {
    if (!message.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/support/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          aiProvider,
          aiApiKey: aiApiKey.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No pudimos responder.');
      }

      setReply(data.reply);
      setSupportEmail(data.supportEmail || 'support@nexora.com');
      if (data?.ai?.providerUsed === 'claude') {
        setAiStatus('Respondiendo con Claude.');
      } else {
        setAiStatus('Respondiendo con motor heurístico de Nexora.');
      }
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

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#ecfeff_100%)] p-8 shadow-[0_20px_70px_rgba(15,23,42,0.07)]">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Postventa y soporte</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Soporte técnico con IA y seguimiento después de la compra.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Este centro acompaña al cliente después de vender: onboarding, dudas técnicas, fricción de campañas y escalado a soporte humano cuando haga falta.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <p className="text-sm text-slate-500">Plan actual</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{user?.entitlements?.marketingLabel || 'Starter'}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <p className="text-sm text-slate-500">Soporte IA</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">Activo</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <p className="text-sm text-slate-500">Escalado humano</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {user?.entitlements?.capabilities.canUsePrioritySupport ? 'Prioritario' : 'Por email'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <h2 className="text-xl font-semibold text-slate-900">Asistente IA</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Escribe tu duda sobre campañas, facturación, conexiones o configuración y Nexora te devuelve pasos accionables.
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Proveedor IA (opcional)</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select
                value={aiProvider}
                onChange={(event) => setAiProvider(event.target.value as 'auto' | 'heuristic' | 'claude' | 'gemini')}
                className="input-field"
              >
                <option value="auto">Auto (Claude o Gemini si hay clave, sino Nexora)</option>
                <option value="claude">Forzar Claude</option>
                <option value="gemini">Forzar Gemini</option>
                <option value="heuristic">Solo Nexora (sin proveedor externo)</option>
              </select>
              <input
                type="password"
                value={aiApiKey}
                onChange={(event) => setAiApiKey(event.target.value)}
                placeholder="API key Claude (opcional, BYOK)"
                className="input-field"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={handleSaveAiConfig} type="button" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                Guardar configuración IA
              </button>
              <button
                onClick={() => {
                  setAiApiKey('');
                  localStorage.removeItem('nexora_ai_api_key');
                  setAiStatus('Clave local eliminada de este navegador.');
                }}
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Limpiar clave local
              </button>
            </div>
            {aiStatus ? <p className="mt-2 text-xs text-slate-500">{aiStatus}</p> : null}
          </div>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="input-field mt-5 min-h-[180px] w-full"
            placeholder="Ejemplo: mi campaña tiene gasto pero no convierte, ¿qué debería revisar primero?"
          />

          <button onClick={handleAsk} disabled={loading} className="mt-4 btn-primary disabled:opacity-60">
            {loading ? 'Analizando...' : 'Preguntar al soporte IA'}
          </button>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <h2 className="text-xl font-semibold text-slate-900">Respuesta y siguiente paso</h2>
          {reply ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-sm uppercase tracking-[0.22em] text-slate-300">{reply.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-100">{reply.message}</p>
              </div>
              {reply.nextSteps.map((step) => (
                <div key={step} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  {step}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              Aún no hay consulta. Cuando escribas una duda, aquí aparecerán diagnóstico y pasos recomendados.
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
            Si necesitas seguimiento humano, escribe a <span className="font-semibold text-slate-900">{supportEmail}</span>.
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <h3 className="text-lg font-semibold text-slate-900">Bienvenida</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">Primera activación para que el cliente conecte una cuenta y entienda su plan.</p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <h3 className="text-lg font-semibold text-slate-900">Seguimiento</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">Check-ins de 3 y 7 días para que la compra no se enfríe ni pierda momentum.</p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,0.06)]">
          <h3 className="text-lg font-semibold text-slate-900">Postventa</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">Soporte técnico y acompañamiento para ayudar a convertir uso en resultados reales.</p>
        </div>
      </section>
    </div>
  );
}

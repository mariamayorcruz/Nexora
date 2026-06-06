'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MessageCircle, Phone, Send, Sparkles, Zap } from 'lucide-react';
import { useAutomationConfig, type AutomationConfigInput } from '@/hooks/useAutomationConfig';
import { useAppLanguage } from '@/hooks/use-app-language';

type FormState = {
  businessName: string;
  language: string;
  aiTone: string;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  openPhoneApiKey: string;
  openPhoneNumberId: string;
  whatsappConnected: boolean;
  openPhoneConnected: boolean;
  instagramConnected: boolean;
  welcomeMessage: string;
  qualificationPrompt: string;
  hotLeadAction: string;
  warmLeadAction: string;
  coldLeadAction: string;
  followupDays: number;
  automationActive: boolean;
};

type FieldName = keyof FormState;

const steps = [
  'Información del negocio',
  'Conectar canales',
  'Personalizar el AI',
  'Acciones por lead',
  'Activar y probar',
];

const defaultForm: FormState = {
  businessName: '',
  language: 'es',
  aiTone: 'professional',
  whatsappPhoneNumberId: '',
  whatsappAccessToken: '',
  openPhoneApiKey: '',
  openPhoneNumberId: '',
  whatsappConnected: false,
  openPhoneConnected: false,
  instagramConnected: false,
  welcomeMessage: '',
  qualificationPrompt: '',
  hotLeadAction: 'notify',
  warmLeadAction: 'sequence',
  coldLeadAction: 'sequence',
  followupDays: 3,
  automationActive: false,
};

const stepStorageKey = 'gotnexora-automation-wizard-step';

function toInput(form: FormState): AutomationConfigInput {
  return {
    businessName: form.businessName,
    language: form.language,
    aiTone: form.aiTone,
    whatsappPhoneNumberId: form.whatsappPhoneNumberId,
    whatsappAccessToken: form.whatsappAccessToken,
    openPhoneApiKey: form.openPhoneApiKey,
    openPhoneNumberId: form.openPhoneNumberId,
    whatsappConnected: form.whatsappConnected,
    openPhoneConnected: form.openPhoneConnected,
    instagramConnected: form.instagramConnected,
    welcomeMessage: form.welcomeMessage,
    qualificationPrompt: form.qualificationPrompt,
    hotLeadAction: form.hotLeadAction,
    warmLeadAction: form.warmLeadAction,
    coldLeadAction: form.coldLeadAction,
    followupDays: form.followupDays,
    automationActive: form.automationActive,
  };
}

function statusBadge(connected: boolean) {
  return connected ? (
    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
      Conectado
    </span>
  ) : (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-semibold text-slate-500">
      No conectado
    </span>
  );
}

function leadActionLabel(value: string) {
  const labels: Record<string, string> = {
    notify: 'Notificarme',
    close: 'Cerrar solo',
    escalate: 'Escalar',
    sequence: 'Secuencia automática',
    ignore: 'Ignorar',
  };

  return labels[value] || value;
}

export default function DashboardAutomationsPage() {
  const { language } = useAppLanguage();
  const en = language === 'en';
  const { data, loading, error, updateConfig } = useAutomationConfig();
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const storedStep = Number(localStorage.getItem(stepStorageKey));
    if (Number.isInteger(storedStep) && storedStep >= 0 && storedStep < steps.length) {
      setActiveStep(storedStep);
    }
  }, []);

  useEffect(() => {
    if (initialized || loading) return;

    if (data) {
      setForm({
        businessName: data.businessName || '',
        language: data.language || 'es',
        aiTone: data.aiTone || 'professional',
        whatsappPhoneNumberId: data.whatsappPhoneNumberId || '',
        whatsappAccessToken: data.whatsappAccessToken || '',
        openPhoneApiKey: data.openPhoneApiKey || '',
        openPhoneNumberId: data.openPhoneNumberId || '',
        whatsappConnected: data.whatsappConnected,
        openPhoneConnected: data.openPhoneConnected,
        instagramConnected: data.instagramConnected,
        welcomeMessage: data.welcomeMessage || '',
        qualificationPrompt: data.qualificationPrompt || '',
        hotLeadAction: data.hotLeadAction || 'notify',
        warmLeadAction: data.warmLeadAction || 'sequence',
        coldLeadAction: data.coldLeadAction || 'sequence',
        followupDays: data.followupDays || 3,
        automationActive: data.automationActive,
      });
    }

    setInitialized(true);
  }, [data, initialized, loading]);

  const completion = useMemo(() => ((activeStep + 1) / steps.length) * 100, [activeStep]);

  const setField = <T extends FieldName>(field: T, value: FormState[T]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const saveConfig = async (updates?: Partial<FormState>) => {
    const nextForm = updates ? { ...form, ...updates } : form;
    setSaving(true);
    try {
      await updateConfig(toInput(nextForm));
      if (updates) {
        setForm(nextForm);
      }
      return true;
    } catch {
      showToast(en ? 'Could not save changes.' : 'No se pudieron guardar los cambios.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    const saved = await saveConfig();
    if (!saved) return;
    const nextStep = Math.min(activeStep + 1, steps.length - 1);
    setActiveStep(nextStep);
    localStorage.setItem(stepStorageKey, String(nextStep));
  };

  const goBack = () => {
    const previousStep = Math.max(activeStep - 1, 0);
    setActiveStep(previousStep);
    localStorage.setItem(stepStorageKey, String(previousStep));
  };

  const connectChannel = async (updates: Partial<FormState>, successMessage: string) => {
    const saved = await saveConfig(updates);
    if (saved) {
      showToast(successMessage);
    }
  };

  const toggleAutomation = async () => {
    const nextValue = !form.automationActive;
    const saved = await saveConfig({ automationActive: nextValue });
    if (saved) {
      showToast(nextValue ? 'Automatización activada.' : 'Automatización pausada.');
    }
  };

  const handleFinalSystemAction = async () => {
    const nextValue = !form.automationActive;
    const saved = await saveConfig({ automationActive: nextValue });
    if (saved) {
      showToast(
        nextValue
          ? '¡Sistema activado! GotNexora ya está monitoreando tus canales.'
          : 'Sistema desactivado.'
      );
    }
  };

  if (loading && !initialized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#040810] px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">⚡ Automatizaciones</p>
            <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[34px]">
              Configura tu sistema multi-canal
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Define cómo GotNexora responde, califica y mueve cada lead desde WhatsApp, OpenPhone e Instagram.
            </p>
          </div>
          <div className="rounded-[22px] border border-cyan-400/10 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
            Paso {activeStep + 1} de {steps.length}
          </div>
        </div>

        <div className="mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
          <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-5">
            {steps.map((step, index) => (
              <button
                key={step}
                type="button"
                onClick={() => {
                  setActiveStep(index);
                  localStorage.setItem(stepStorageKey, String(index));
                }}
                className={`rounded-full px-3 py-2 text-left transition-all duration-150 ${
                  index === activeStep ? 'bg-white/[0.06] text-white' : 'bg-white/[0.02] hover:text-slate-300'
                }`}
              >
                {index + 1}. {step}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[22px] border border-rose-400/15 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      {toast ? (
        <div className="fixed right-5 top-20 z-50 rounded-2xl border border-cyan-400/15 bg-[#06111c] px-4 py-3 text-sm text-cyan-200 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          {toast}
        </div>
      ) : null}

      <section className="rounded-[28px] bg-[#040810] p-5 sm:p-6">
        {activeStep === 0 ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Paso 1</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">Información del negocio</h2>
              <div className="mt-6 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Nombre del negocio</span>
                  <input
                    value={form.businessName}
                    onChange={(event) => setField('businessName', event.target.value)}
                    className="w-full rounded-2xl bg-[#030610] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-cyan-500/10"
                    placeholder="GotNexora Growth Studio"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Idioma</span>
                    <select
                      value={form.language}
                      onChange={(event) => setField('language', event.target.value)}
                      className="w-full rounded-2xl bg-[#030610] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500/10"
                    >
                      <option value="es">Español</option>
                      <option value="en">Inglés</option>
                      <option value="both">Ambos</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Tono del AI</span>
                    <select
                      value={form.aiTone}
                      onChange={(event) => setField('aiTone', event.target.value)}
                      className="w-full rounded-2xl bg-[#030610] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500/10"
                    >
                      <option value="professional">Profesional</option>
                      <option value="casual">Casual</option>
                      <option value="aggressive">Agresivo en ventas</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
            <div className="rounded-[24px] border border-cyan-400/10 bg-cyan-500/5 p-5">
              <Sparkles className="h-5 w-5 text-cyan-300" />
              <p className="mt-4 text-sm font-semibold text-white">Perfil del asistente</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Esta información define cómo habla el AI, en qué idioma responde y qué negocio representa en cada canal.
              </p>
            </div>
          </div>
        ) : null}

        {activeStep === 1 ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Paso 2</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">Conectar canales</h2>
            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              <div className="rounded-[24px] border border-white/[0.06] bg-[#030610] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">WhatsApp Business</p>
                      <p className="mt-1 text-xs text-slate-500">Mercado LATAM</p>
                    </div>
                  </div>
                  {statusBadge(form.whatsappConnected)}
                </div>
                <div className="mt-5 space-y-3">
                  <input
                    value={form.whatsappPhoneNumberId}
                    onChange={(event) => setField('whatsappPhoneNumberId', event.target.value)}
                    placeholder="Phone Number ID"
                    className="w-full rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                  <input
                    value={form.whatsappAccessToken}
                    onChange={(event) => setField('whatsappAccessToken', event.target.value)}
                    placeholder="Access Token"
                    type="password"
                    className="w-full rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void connectChannel({ whatsappConnected: true }, 'WhatsApp Business conectado.')
                    }
                    className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-[#041018] transition hover:bg-cyan-400"
                  >
                    Conectar
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/[0.06] bg-[#030610] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-cyan-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">OpenPhone</p>
                      <p className="mt-1 text-xs text-slate-500">Mercado USA</p>
                    </div>
                  </div>
                  {statusBadge(form.openPhoneConnected)}
                </div>
                <div className="mt-5 space-y-3">
                  <input
                    value={form.openPhoneApiKey}
                    onChange={(event) => setField('openPhoneApiKey', event.target.value)}
                    placeholder="API Key"
                    type="password"
                    className="w-full rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                  <input
                    value={form.openPhoneNumberId}
                    onChange={(event) => setField('openPhoneNumberId', event.target.value)}
                    placeholder="Phone Number ID"
                    className="w-full rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void connectChannel({ openPhoneConnected: true }, 'OpenPhone conectado.')
                    }
                    className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-[#041018] transition hover:bg-cyan-400"
                  >
                    Conectar
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/[0.06] bg-[#030610] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Send className="h-5 w-5 text-violet-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">Instagram DM</p>
                      <p className="mt-1 text-xs text-slate-500">Meta OAuth</p>
                    </div>
                  </div>
                  {statusBadge(form.instagramConnected)}
                </div>
                <p className="mt-5 text-sm leading-6 text-slate-500">
                  Conecta Instagram para responder mensajes directos y mover leads al CRM automáticamente.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void connectChannel({ instagramConnected: true }, 'Instagram DM marcado como conectado.')
                  }
                  className="mt-5 w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] hover:text-white"
                >
                  Conectar con Meta
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeStep === 2 ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Paso 3</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">Personalizar el AI</h2>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Mensaje de bienvenida</span>
                <textarea
                  value={form.welcomeMessage}
                  onChange={(event) => setField('welcomeMessage', event.target.value.slice(0, 300))}
                  maxLength={300}
                  rows={7}
                  className="w-full resize-none rounded-2xl bg-[#030610] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-cyan-500/10"
                  placeholder="Hola, gracias por escribirnos. Cuéntame qué necesitas y te ayudo a avanzar."
                />
                <span className="mt-2 block text-right text-xs text-slate-600">{form.welcomeMessage.length}/300</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Prompt de calificación</span>
                <textarea
                  value={form.qualificationPrompt}
                  onChange={(event) => setField('qualificationPrompt', event.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={7}
                  className="w-full resize-none rounded-2xl bg-[#030610] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-cyan-500/10"
                  placeholder="Pregunta si el cliente tiene presupuesto definido, cuándo quiere empezar, y cuál es su mayor problema actual"
                />
                <span className="mt-2 block text-right text-xs text-slate-600">{form.qualificationPrompt.length}/500</span>
              </label>
            </div>
          </div>
        ) : null}

        {activeStep === 3 ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Paso 4</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">Definir acciones por tipo de lead</h2>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="block rounded-[22px] bg-[#030610] p-4">
                <span className="mb-2 block text-xs uppercase tracking-wider text-rose-300">Lead caliente</span>
                <select
                  value={form.hotLeadAction}
                  onChange={(event) => setField('hotLeadAction', event.target.value)}
                  className="w-full rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="notify">Notificarme</option>
                  <option value="close">Cerrar solo</option>
                  <option value="escalate">Escalar</option>
                </select>
              </label>
              <label className="block rounded-[22px] bg-[#030610] p-4">
                <span className="mb-2 block text-xs uppercase tracking-wider text-amber-300">Lead tibio</span>
                <select
                  value={form.warmLeadAction}
                  onChange={(event) => setField('warmLeadAction', event.target.value)}
                  className="w-full rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="sequence">Secuencia de seguimiento</option>
                  <option value="notify">Notificarme</option>
                </select>
              </label>
              <label className="block rounded-[22px] bg-[#030610] p-4">
                <span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Lead frío</span>
                <select
                  value={form.coldLeadAction}
                  onChange={(event) => setField('coldLeadAction', event.target.value)}
                  className="w-full rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="sequence">Secuencia automática</option>
                  <option value="ignore">Ignorar</option>
                </select>
              </label>
              <label className="block rounded-[22px] bg-[#030610] p-4">
                <span className="mb-2 block text-xs uppercase tracking-wider text-cyan-300">Días de seguimiento</span>
                <input
                  value={form.followupDays}
                  min={0}
                  max={30}
                  type="number"
                  onChange={(event) => setField('followupDays', Number(event.target.value || 0))}
                  className="w-full rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
            </div>
          </div>
        ) : null}

        {activeStep === 4 ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Paso 5</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">Activar y probar</h2>
            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['Negocio', form.businessName || 'Sin nombre'],
                  ['Idioma', form.language === 'both' ? 'Ambos' : form.language === 'en' ? 'Inglés' : 'Español'],
                  ['Tono AI', form.aiTone === 'aggressive' ? 'Agresivo en ventas' : form.aiTone === 'casual' ? 'Casual' : 'Profesional'],
                  ['Canales', [form.whatsappConnected && 'WhatsApp', form.openPhoneConnected && 'OpenPhone', form.instagramConnected && 'Instagram'].filter(Boolean).join(', ') || 'Sin canales conectados'],
                  ['Lead caliente', leadActionLabel(form.hotLeadAction)],
                  ['Lead tibio', leadActionLabel(form.warmLeadAction)],
                  ['Lead frío', leadActionLabel(form.coldLeadAction)],
                  ['Seguimiento', `${form.followupDays} días`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[22px] bg-[#030610] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-600">{label}</p>
                    <p className="mt-2 text-sm font-medium text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-[24px] border border-cyan-400/10 bg-cyan-500/5 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Automatización</p>
                    <p className="mt-1 text-xs text-slate-500">{form.automationActive ? 'Activa' : 'Pausada'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleAutomation()}
                    className={`relative h-10 w-20 rounded-full transition-all duration-200 ${
                      form.automationActive ? 'bg-cyan-400' : 'bg-white/[0.08]'
                    }`}
                    aria-label="Activar automatización"
                  >
                    <span
                      className={`absolute top-1 h-8 w-8 rounded-full bg-white transition-all duration-200 ${
                        form.automationActive ? 'left-11' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Disponible cuando conectes al menos un canal.')}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] hover:text-white"
                >
                  <Zap className="h-4 w-4 text-cyan-300" />
                  Simular lead de prueba
                </button>
                <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#030610] p-4 text-sm leading-6 text-slate-500">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>Al activar, GotNexora usará esta configuración para responder y calificar leads entrantes.</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-5">
          <button
            type="button"
            onClick={goBack}
            disabled={activeStep === 0 || saving}
            className="rounded-2xl bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <div className="text-xs text-slate-600">
            {saving ? 'Guardando en Supabase...' : 'Los cambios se guardan al avanzar.'}
          </div>
          <button
            type="button"
            onClick={activeStep === steps.length - 1 ? handleFinalSystemAction : goNext}
            disabled={saving}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold text-[#041018] transition disabled:cursor-not-allowed disabled:opacity-40 ${
              activeStep === steps.length - 1
                ? form.automationActive
                  ? 'bg-rose-500 text-white hover:bg-rose-400'
                  : 'bg-emerald-400 hover:bg-emerald-300'
                : 'bg-cyan-500 hover:bg-cyan-400'
            }`}
          >
            {activeStep === steps.length - 1 ? (form.automationActive ? 'Desactivar sistema' : 'Activar sistema') : 'Siguiente'}
          </button>
        </div>
      </section>
    </div>
  );
}

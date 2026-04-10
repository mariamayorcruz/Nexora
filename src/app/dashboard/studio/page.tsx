'use client';

import { useEffect, useMemo, useState } from 'react';

interface AiTool {
  key: string;
  label: string;
  credits: number;
  description: string;
}

interface AiJob {
  id: string;
  tool: string;
  title: string;
  prompt: string;
  channel?: string | null;
  creditsUsed: number;
  output?: {
    headline?: string;
    bullets?: string[];
    angle?: string;
    slides?: { title: string; bullets: string[] }[];
  } | null;
  createdAt: string;
}

interface StudioUsage {
  cycleKey: string;
  cycleStart: string;
  cycleEnd: string;
  creditsIncluded: number;
  creditsPurchased: number;
  creditsUsed: number;
  creditsRemaining: number;
  creditsTotal: number;
  supportLabel: string;
  canUseVideoTools: boolean;
  maxExportsPerRun: number;
}

const DEFAULT_FORM = {
  tool: 'ad-copy',
  offer: '',
  audience: '',
  channel: 'Meta Ads',
  prompt: '',
};

export default function DashboardStudioPage() {
  const [usage, setUsage] = useState<StudioUsage | null>(null);
  const [tools, setTools] = useState<AiTool[]>([]);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.key === form.tool) || tools[0],
    [tools, form.tool]
  );

  const fetchStudio = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai/studio', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cargar el estudio de IA.');
      }

      setUsage(data.usage);
      setTools(data.tools || []);
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error fetching AI studio:', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar el estudio de IA.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStudio();
  }, []);

  const handleGenerate = async () => {
    setSubmitting(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai/studio', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo generar el recurso.');
      }

      setJobs((current) => [data.job, ...current].slice(0, 8));
      setUsage((current) =>
        current
          ? {
              ...current,
              creditsIncluded: data.usage.creditsIncluded,
              creditsPurchased: data.usage.creditsPurchased,
              creditsUsed: data.usage.creditsUsed,
              creditsRemaining: data.usage.creditsRemaining,
            }
          : current
      );
      setMessage('La nueva pieza ya quedó lista dentro de tu estudio creativo.');
    } catch (error) {
      console.error('Error generating AI result:', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo generar el recurso.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Cargando AI Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[36px] bg-[linear-gradient(135deg,#111827_0%,#0f172a_42%,#7c2d12_100%)] px-8 py-10 text-white shadow-[0_32px_110px_rgba(15,23,42,0.22)]">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-200">AI Studio</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              Crea, edita y convierte ideas en activos listos para vender.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Nexora convierte ideas, ofertas y objetivos comerciales en hooks, briefs, secuencias, guiones y ahora
              también propuestas o presentaciones tipo pitch listas para presentar.
            </p>
            <p className="mt-4 text-sm leading-6 text-amber-100/90">{usage?.supportLabel}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">Créditos disponibles</p>
              <p className="mt-3 text-4xl font-semibold text-white">{usage?.creditsRemaining ?? 0}</p>
              <p className="mt-2 text-sm text-slate-300">
                de {usage?.creditsTotal ?? 0} para el ciclo {usage?.cycleKey}
              </p>
            </div>
            <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">Video y edición</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {usage?.canUseVideoTools ? 'Activo' : 'Disponible desde Growth'}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Hasta {usage?.maxExportsPerRun ?? 0} salidas por ejecución.
              </p>
            </div>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          {message}
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Créditos usados</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{usage?.creditsUsed ?? 0}</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Créditos del plan</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{usage?.creditsIncluded ?? 0}</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Créditos extra</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{usage?.creditsPurchased ?? 0}</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Renovación</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {usage?.cycleEnd ? new Date(usage.cycleEnd).toLocaleDateString('es-ES') : '-'}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Generador</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Lanza una pieza nueva</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">Tipo de recurso</span>
              <select
                value={form.tool}
                onChange={(event) => setForm((current) => ({ ...current, tool: event.target.value }))}
                className="input-field"
              >
                {tools.map((tool) => (
                  <option key={tool.key} value={tool.key}>
                    {tool.label} · {tool.credits} créditos
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Oferta o servicio</span>
              <input
                value={form.offer}
                onChange={(event) => setForm((current) => ({ ...current, offer: event.target.value }))}
                className="input-field"
                placeholder="Qué vendes exactamente"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Audiencia</span>
              <input
                value={form.audience}
                onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}
                className="input-field"
                placeholder="Para quién va dirigido"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">Canal</span>
              <input
                value={form.channel}
                onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}
                className="input-field"
                placeholder="Meta Ads, email, WhatsApp, pitch deck, ventas..."
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">Brief o idea base</span>
              <textarea
                value={form.prompt}
                onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
                className="input-field min-h-[150px]"
                placeholder="Explica el ángulo, el dolor, el resultado o la pieza que quieres crear."
              />
            </label>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            {selectedTool?.description || 'Selecciona una herramienta para ver su enfoque.'}
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Inspirado en la velocidad de Gamma: si eliges pitch deck, Nexora generará una estructura clara de slides
            lista para presentar o bajar luego a Canva, PDF o deck visual.
          </div>

          <button onClick={handleGenerate} disabled={submitting} className="mt-6 btn-primary">
            {submitting ? 'Generando...' : `Generar ${selectedTool?.label || 'pieza'} (${selectedTool?.credits || 0} créditos)`}
          </button>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Herramientas</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Tu stack creativo por crédito</h2>

          <div className="mt-6 space-y-4">
            {tools.map((tool) => (
              <article key={tool.key} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{tool.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{tool.description}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                    {tool.credits} créditos
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Historial</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Activos generados recientemente</h2>

        <div className="mt-6 space-y-4">
          {jobs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
              Aún no has generado piezas en AI Studio. Tu primer output aparecerá aquí con estructura, ángulo y bullets.
            </div>
          ) : (
            jobs.map((job) => (
              <article key={job.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{job.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(job.createdAt).toLocaleString('es-ES')} · {job.channel || 'Sin canal'}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {job.creditsUsed} créditos
                  </span>
                </div>

                {job.output?.angle && (
                  <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                    Ángulo recomendado: {job.output.angle}
                  </p>
                )}

                {job.output?.slides?.length ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {job.output.slides.map((slide, index) => (
                      <div key={`${job.id}-slide-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Slide {index + 1}</p>
                        <p className="mt-2 font-semibold text-slate-900">{slide.title}</p>
                        <div className="mt-3 space-y-2">
                          {slide.bullets.map((bullet) => (
                            <div key={bullet} className="rounded-xl bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                              {bullet}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : job.output?.bullets?.length ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {job.output.bullets.map((bullet) => (
                      <div key={bullet} className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        {bullet}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

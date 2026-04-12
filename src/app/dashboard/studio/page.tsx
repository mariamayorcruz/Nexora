'use client';

import Link from 'next/link';

import { useEffect, useMemo, useState } from 'react';

interface AiTool {
  key: string;
  label: string;
  credits: number;
  description: string;
  family?: 'copy' | 'video' | 'sales';
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
    sections?: { title: string; items: string[] }[];
    cta?: string;
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
}

const DEFAULT_FORM = {
  tool: 'ad-copy',
  offer: '',
  audience: '',
  channel: 'Instagram',
  prompt: '',
};

const MODE_FAMILIES = [
  { key: 'copy', label: 'Copy Lab' },
  { key: 'sales', label: 'Sales Assets' },
] as const;

export default function DashboardStudioPage() {
  const [usage, setUsage] = useState<StudioUsage | null>(null);
  const [tools, setTools] = useState<AiTool[]>([]);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [activeFamily, setActiveFamily] = useState<(typeof MODE_FAMILIES)[number]['key']>('copy');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const familyTools = useMemo(
    () => tools.filter((tool) => (tool.family || 'copy') === activeFamily),
    [tools, activeFamily]
  );

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.key === form.tool) || tools[0],
    [tools, form.tool]
  );

  const latestJob = jobs[0] || null;

  const fetchStudio = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai/studio', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cargar Nexora Studio.');
      }

      setUsage(data.usage);
      setTools(data.tools || []);
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error fetching Nexora Studio:', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar Nexora Studio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStudio();
  }, []);

  useEffect(() => {
    if (familyTools.length > 0 && !familyTools.some((tool) => tool.key === form.tool)) {
      setForm((current) => ({ ...current, tool: familyTools[0].key }));
    }
  }, [familyTools, form.tool]);

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
      setMessage(
        data.reused
          ? 'Recuperamos un resultado igual reciente y no descontamos créditos de nuevo.'
          : 'La nueva pieza ya quedó lista dentro de tu estudio creativo.'
      );
    } catch (error) {
      console.error('Error generating AI result:', error);
      await fetchStudio();
      setMessage(
        error instanceof Error
          ? `${error.message} Si se genero correctamente en segundo plano, ya aparece en el historial.`
          : 'No se pudo generar el recurso. Si se completo en segundo plano, ya aparece en el historial.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Cargando Nexora Studio...</p>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <section className="rounded-[36px] bg-[linear-gradient(135deg,#0f172a_0%,#111827_42%,#0f766e_100%)] px-8 py-12 text-white shadow-[0_32px_110px_rgba(15,23,42,0.24)]">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Nexora Studio</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
          Bienvenida al workspace creativo de Nexora.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200">
          Aqui puedes generar assets, revisar resultados en vivo y controlar creditos sin salir del mismo flujo.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={() => setShowWelcome(false)}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Entrar a Nexora Studio
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">Nuevo</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              Ya tienes Nexora Studio activo con canvas, inspector, saldo en vivo y bloqueo por creditos.
            </p>
          </div>
          <Link href="/dashboard/studio" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Abrir Nexora Studio
          </Link>
        </div>
      </section>

      <section className="rounded-[36px] bg-[linear-gradient(135deg,#111827_0%,#0f172a_40%,#7c2d12_100%)] px-8 py-10 text-white shadow-[0_32px_110px_rgba(15,23,42,0.22)]">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-200">Nexora Studio</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight">
              Una sola pantalla para crear, revisar y reutilizar todo.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-6 text-slate-300">
              Workspace organizado: controles a la izquierda, resultado en tiempo real a la derecha e historial vivo abajo.
            </p>
            <p className="mt-4 text-sm text-amber-100/90">{usage?.supportLabel}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[26px] border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-slate-300">Créditos disponibles</p>
              <p className="mt-2 text-5xl font-semibold text-white">{usage?.creditsRemaining ?? 0}</p>
              <p className="mt-1 text-sm text-slate-300">
                de {usage?.creditsTotal ?? 0} para el ciclo {usage?.cycleKey}
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

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Créditos usados" value={String(usage?.creditsUsed ?? 0)} />
        <MetricCard label="Créditos del plan" value={String(usage?.creditsIncluded ?? 0)} />
        <MetricCard label="Créditos extra" value={String(usage?.creditsPurchased ?? 0)} />
        <MetricCard
          label="Renovación"
          value={usage?.cycleEnd ? new Date(usage.cycleEnd).toLocaleDateString('es-ES') : '-'}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Builder</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Diseña tu siguiente asset</h2>

          <div className="mt-6 flex flex-wrap gap-2">
            {MODE_FAMILIES.map((family) => (
              <button
                key={family.key}
                onClick={() => setActiveFamily(family.key)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  activeFamily === family.key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {family.label}
              </button>
            ))}
          </div>

          <div className="mt-7 space-y-5">
            {familyTools.map((tool) => (
              <button
                key={tool.key}
                onClick={() => setForm((current) => ({ ...current, tool: tool.key }))}
                className={`w-full rounded-2xl border p-5 text-left transition ${
                  form.tool === tool.key
                    ? 'border-slate-950 bg-slate-950 text-white hover:bg-slate-900'
                    : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{tool.label}</p>
                    <p className={`mt-2 text-sm leading-6 ${form.tool === tool.key ? 'text-slate-300' : 'text-slate-600'}`}>
                      {tool.description}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      form.tool === tool.key ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tool.credits} créditos
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Oferta o servicio</span>
              <input
                value={form.offer}
                onChange={(event) => setForm((current) => ({ ...current, offer: event.target.value }))}
                className="input-field"
                placeholder="Qué vendes exactamente"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Audiencia</span>
                <input
                  value={form.audience}
                  onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}
                  className="input-field"
                  placeholder="Para quién va dirigido"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Canal</span>
                <input
                  value={form.channel}
                  onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}
                  className="input-field"
                  placeholder="Instagram, WhatsApp..."
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Brief o idea base</span>
              <textarea
                value={form.prompt}
                onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
                className="input-field min-h-[130px]"
                placeholder="Explica el ángulo, el dolor, la promesa o el estilo que buscas..."
              />
            </label>
          </div>

          <button onClick={handleGenerate} disabled={submitting} className="mt-8 btn-primary w-full py-4 text-base">
            {submitting ? 'Generando...' : `Generar ${selectedTool?.label || 'asset'} (${selectedTool?.credits || 0} créditos)`}
          </button>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Vista previa</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Resultado inmediato</h2>

          {latestJob ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Último output</p>
                <p className="mt-2 text-lg font-semibold">{latestJob.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(latestJob.createdAt).toLocaleString('es-ES')} · {latestJob.channel || 'Sin canal'}
                </p>
              </div>

              {latestJob.output?.headline && (
                <div className="rounded-2xl bg-amber-50 p-5 text-amber-900">
                  <p className="text-xs uppercase tracking-[0.18em]">Ángulo recomendado</p>
                  <p className="mt-2 text-sm">{latestJob.output.angle}</p>
                </div>
              )}

              {latestJob.output?.bullets?.length ? (
                <div className="space-y-3">
                  {latestJob.output.bullets.slice(0, 4).map((bullet) => (
                    <div key={bullet} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      {bullet}
                    </div>
                  ))}
                </div>
              ) : null}

              {latestJob.output?.cta && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
                  CTA sugerido: {latestJob.output.cta}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Historial rápido</p>
                <div className="mt-3 space-y-3">
                  {jobs.slice(0, 4).map((job) => (
                    <div key={job.id} className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job.creditsUsed} créditos · {new Date(job.createdAt).toLocaleString('es-ES')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
              Tu primer resultado aparecerá aquí para que el estudio se sienta como editor: controles a la izquierda y salida útil a la derecha.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Historial completo</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Assets y outputs recientes</h2>

        <div className="mt-6 space-y-6">
          {jobs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
              Aún no has generado assets en este estudio. Tu primer output aparecerá aquí con estructura, secciones y CTA.
            </div>
          ) : (
            jobs.map((job) => (
              <article key={job.id} className="rounded-2xl border border-slate-200 p-6">
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

                {job.output?.headline && (
                  <div className="mt-5 rounded-2xl bg-slate-950 px-5 py-5 text-white">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Idea central</p>
                    <p className="mt-2 text-lg font-semibold">{job.output.headline}</p>
                  </div>
                )}

                {job.output?.angle && (
                  <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                    Ángulo recomendado: {job.output.angle}
                  </p>
                )}

                {job.output?.sections?.length ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {job.output.sections.map((section, index) => (
                      <div key={`${job.id}-section-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{section.title}</p>
                        <div className="mt-3 space-y-2">
                          {section.items.map((item) => (
                            <div key={item} className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

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

                {job.output?.cta && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                    CTA sugerido: {job.output.cta}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-4xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}


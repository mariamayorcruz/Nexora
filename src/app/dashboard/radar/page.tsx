'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface TrendInsight {
  id: string;
  platform: string;
  title: string;
  summary: string;
  whyNow: string;
  hook: string;
  formats: string[];
  confidence: number;
  urgency: 'alta' | 'media';
}

interface CampaignBlueprint {
  id: string;
  name: string;
  objective: string;
  audience: string;
  angle: string;
  offer: string;
  creativeDirection: string;
  launchWindow: string;
}

interface TrendReport {
  refreshedAt: string;
  refreshAfterMinutes: number;
  marketPulse: string;
  momentumScore: number;
  activePlatforms: string[];
  quickWins: string[];
  hooks: string[];
  insights: TrendInsight[];
  blueprints: CampaignBlueprint[];
}

interface RadarLockState {
  marketingLabel?: string;
  upgradeCta?: string;
}

export default function RadarPage() {
  const [report, setReport] = useState<TrendReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lockState, setLockState] = useState<RadarLockState | null>(null);

  const fetchRadar = async (background = false) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('No encontramos una sesión activa.');
      setLoading(false);
      return;
    }

    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch('/api/trends/radar', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 403) {
          setLockState({
            marketingLabel: data?.capabilities?.marketingLabel,
            upgradeCta: data?.capabilities?.upgradeCta,
          });
          setReport(null);
          setError(data?.error || 'Tu plan actual no incluye el radar creativo.');
          return;
        }

        throw new Error(data?.error || 'Failed to fetch radar');
      }

      const data = await response.json();
      setReport(data.report);
      setError('');
      setLockState(null);
    } catch (fetchError) {
      console.error('Error fetching trend radar:', fetchError);
      setError('No pudimos cargar el radar creativo. Intenta actualizar de nuevo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRadar();
  }, []);

  useEffect(() => {
    if (!report?.refreshAfterMinutes) return;

    const refreshInterval = window.setInterval(() => {
      fetchRadar(true);
    }, report.refreshAfterMinutes * 60 * 1000);

    return () => window.clearInterval(refreshInterval);
  }, [report?.refreshAfterMinutes]);

  const formattedDate = useMemo(() => {
    if (!report?.refreshedAt) return '';
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(report.refreshedAt));
  }, [report?.refreshedAt]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Preparando radar creativo...</p>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className={`rounded-[32px] border p-8 ${lockState ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50'}`}>
        <h1 className={`text-2xl font-bold ${lockState ? 'text-gray-900' : 'text-red-900'}`}>
          {lockState ? 'Radar disponible desde Growth' : 'Radar no disponible'}
        </h1>
        <p className={`mt-3 ${lockState ? 'text-gray-700' : 'text-red-700'}`}>{error}</p>
        {lockState?.upgradeCta && (
          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {lockState.upgradeCta}
          </div>
        )}
        <div className="mt-6 flex gap-3">
          {lockState ? (
            <Link href="/dashboard/billing" className="btn-primary">
              Ver planes
            </Link>
          ) : (
            <button onClick={() => fetchRadar()} className="btn-primary">
              Intentar otra vez
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-950/20">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">Radar creativo Nexora</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight">
              Ideas, ganchos y campañas que se actualizan con el ritmo real de tu negocio.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
              Este panel resume dónde conviene poner tu energía comercial ahora mismo y convierte esa lectura en
              campañas listas para ejecutar.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {report?.activePlatforms.map((platform) => (
                <span
                  key={platform}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-sm text-slate-300">Momentum comercial</p>
            <p className="mt-3 text-5xl font-semibold text-white">{report?.momentumScore}</p>
            <p className="mt-4 text-sm text-slate-300">{report?.marketPulse}</p>
            <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-slate-400">
              <span>Última lectura</span>
              <span>{formattedDate}</span>
            </div>
            <button
              onClick={() => fetchRadar(true)}
              className="mt-6 inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              {refreshing ? 'Actualizando...' : 'Actualizar radar'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Quick wins</p>
          <div className="mt-6 space-y-4">
            {report?.quickWins.map((item) => (
              <div key={item} className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm leading-6 text-gray-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Hooks para vender mejor</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {report?.hooks.map((hook) => (
              <div key={hook} className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-sm leading-6 text-slate-100">{hook}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Tendencias accionables</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">Qué debería empujar tu creatividad ahora</h2>
          </div>
          <p className="text-sm text-gray-500">Refresh automático cada {report?.refreshAfterMinutes} minutos</p>
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-3">
          {report?.insights.map((insight) => (
            <article key={insight.id} className="rounded-[26px] border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gray-400">{insight.platform}</p>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900">{insight.title}</h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                    insight.urgency === 'alta' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {insight.urgency}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-gray-600">{insight.summary}</p>
              <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">{insight.whyNow}</p>

              <div className="mt-4 rounded-2xl bg-cyan-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-700">Gancho sugerido</p>
                <p className="mt-2 text-sm leading-6 text-cyan-950">{insight.hook}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {insight.formats.map((format) => (
                  <span key={format} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    {format}
                  </span>
                ))}
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-gray-400">
                  <span>Confianza</span>
                  <span>{Math.round(insight.confidence)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                    style={{ width: `${Math.min(100, Math.max(10, insight.confidence))}%` }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Blueprints</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Campañas listas para bajar a ejecución</h2>
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-3">
          {report?.blueprints.map((blueprint) => (
            <article key={blueprint.id} className="rounded-[26px] bg-gray-50 p-5">
              <h3 className="text-xl font-semibold text-gray-900">{blueprint.name}</h3>
              <p className="mt-4 text-sm leading-6 text-gray-700">{blueprint.creativeDirection}</p>
              <div className="mt-5 space-y-3 text-sm text-gray-600">
                <p>
                  <span className="font-semibold text-gray-900">Objetivo:</span> {blueprint.objective}
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Audiencia:</span> {blueprint.audience}
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Ángulo:</span> {blueprint.angle}
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Oferta:</span> {blueprint.offer}
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Ventana de lanzamiento:</span> {blueprint.launchWindow}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

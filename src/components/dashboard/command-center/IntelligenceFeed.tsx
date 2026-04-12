'use client';

import { Bookmark, Clock3, Radar, RefreshCw, X, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CampaignBlueprint, TrendInsight, TrendRadarReport } from '@/lib/trends';

export type IntelligenceFeedItem =
  | ({ kind: 'insight' } & TrendInsight)
  | ({ kind: 'blueprint'; confidence: number; urgency: 'alta' | 'media'; hook: string; formats: string[]; platform: string; title: string } & CampaignBlueprint);

function platformColor(platform: string) {
  if (platform === 'instagram') return 'bg-pink-500/10 border-pink-500/30 text-pink-400';
  if (platform === 'facebook') return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
  if (platform === 'google') return 'bg-red-500/10 border-red-500/30 text-red-400';
  if (platform === 'tiktok') return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400';
  return 'bg-slate-800 border-slate-700 text-slate-300';
}

function platformEmoji(platform: string) {
  if (platform === 'instagram') return '📸';
  if (platform === 'google') return '🔍';
  if (platform === 'facebook') return '📘';
  if (platform === 'tiktok') return '🎵';
  return '⚡';
}

function inferPlatformFromBlueprint(blueprint: CampaignBlueprint) {
  const name = blueprint.name.toLowerCase();
  if (name.includes('instagram')) return 'instagram';
  if (name.includes('google')) return 'google';
  if (name.includes('tiktok')) return 'tiktok';
  return 'facebook';
}

export function IntelligenceFeed({
  onExecute,
}: {
  onExecute: (item: IntelligenceFeedItem) => void;
}) {
  const [report, setReport] = useState<TrendRadarReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    const archived = localStorage.getItem('nexora-command-archived');
    const saved = localStorage.getItem('nexora-command-saved');

    if (archived) {
      try {
        setArchivedIds(JSON.parse(archived) as string[]);
      } catch {
        setArchivedIds([]);
      }
    }

    if (saved) {
      try {
        setSavedIds(JSON.parse(saved) as string[]);
      } catch {
        setSavedIds([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nexora-command-archived', JSON.stringify(archivedIds));
  }, [archivedIds]);

  useEffect(() => {
    localStorage.setItem('nexora-command-saved', JSON.stringify(savedIds));
  }, [savedIds]);

  const fetchRadar = async (background = false) => {
    if (background) {
      setRefreshing(true);
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/trends/radar', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cargar la inteligencia activa.');
      }

      setReport(data.report as TrendRadarReport);
      setError('');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'No se pudo cargar la inteligencia activa.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchRadar();
  }, []);

  useEffect(() => {
    if (!report?.refreshAfterMinutes) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchRadar(true);
    }, report.refreshAfterMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [report?.refreshAfterMinutes]);

  const items = useMemo(() => {
    const insights: IntelligenceFeedItem[] = (report?.insights || []).map((insight) => ({ ...insight, kind: 'insight' }));
    const blueprints: IntelligenceFeedItem[] = (report?.blueprints || []).map((blueprint, index) => ({
      ...blueprint,
      kind: 'blueprint',
      confidence: 72 - index * 4,
      urgency: index === 0 ? 'alta' : 'media',
      hook: blueprint.creativeDirection,
      formats: ['Nexora Studio', blueprint.launchWindow],
      platform: inferPlatformFromBlueprint(blueprint),
      title: blueprint.name,
    })) as IntelligenceFeedItem[];

    return [...insights, ...blueprints].filter((item) => !archivedIds.includes(item.id)).slice(0, 8);
  }, [archivedIds, report?.blueprints, report?.insights]);

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-slate-800 bg-slate-900/40">
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <Radar size={16} className="text-cyan-400" />
            Inteligencia Activa
          </h3>
          <p className="text-xs text-slate-500">
            {report ? `Actualiza cada ${report.refreshAfterMinutes} min` : 'Cargando feed'}
          </p>
        </div>
        <button onClick={() => void fetchRadar(true)} className="text-xs text-cyan-400 hover:text-cyan-300">
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {error ? <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">{error}</div> : null}
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-4 text-xs text-slate-500">
            No hay insights activos ahora mismo.
          </div>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className={`group relative rounded-xl border bg-slate-900/50 p-4 transition hover:bg-slate-800/50 ${platformColor(item.platform)}`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{platformEmoji(item.platform)}</span>
                  <span className="text-xs font-bold uppercase opacity-70">{item.platform}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <div className={`h-2 w-2 rounded-full ${item.confidence > 70 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span>{Math.round(item.confidence)}%</span>
                  </div>
                  <button
                    onClick={() => setArchivedIds((prev) => [...prev, item.id])}
                    className="opacity-0 text-slate-500 transition group-hover:opacity-100 hover:text-slate-300"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <h4 className="mb-2 text-sm font-semibold leading-tight text-white">{item.kind === 'insight' ? item.title : item.name}</h4>
              <p className="mb-3 line-clamp-3 text-xs text-slate-300">{item.kind === 'insight' ? item.hook : item.creativeDirection}</p>

              <div className="mb-3 flex flex-wrap gap-2">
                {(item.kind === 'insight' ? item.formats : item.formats).slice(0, 2).map((format) => (
                  <span key={format} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                    {format}
                  </span>
                ))}
                {item.urgency === 'alta' ? (
                  <span className="rounded-full border border-red-500/30 bg-red-500/20 px-2 py-1 text-[10px] text-red-400">🔥 Urgente</span>
                ) : null}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onExecute(item)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-cyan-500 py-2 text-xs font-bold text-slate-900 transition hover:bg-cyan-400"
                >
                  <Zap size={12} />
                  Ejecutar Blueprint
                </button>
                <button
                  onClick={() => setSavedIds((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]))}
                  className={`rounded-lg border p-2 transition ${savedIds.includes(item.id) ? 'border-cyan-500 text-cyan-300' : 'border-slate-700 text-slate-400 hover:text-white'}`}
                >
                  <Bookmark size={14} />
                </button>
              </div>

              <div className="mt-3 border-t border-slate-800/50 pt-3">
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <Clock3 size={12} />
                  <span>Deploy en ~45s con Nexora Studio</span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GenerationConfig } from '@/lib/ai-studio';
import type { FreeAudioTrack, StockClip } from '../hooks/useAIStudio';
import { ToneSelector } from './ToneSelector';

type Tab = 'templates' | 'uploads' | 'text' | 'audio' | 'music' | 'avatars' | 'elements' | 'stock' | 'transitions';

const TEMPLATE_PRESETS: Array<{
  title: string;
  brief: string;
  tone: GenerationConfig['tone'];
  format: GenerationConfig['format'];
}> = [
  {
    title: 'Hook agresivo SaaS',
    brief: 'Tu competencia ya automatizo seguimiento y tu equipo sigue persiguiendo leads a mano.',
    tone: 'viral-aggressive',
    format: 'hook-3s',
  },
  {
    title: 'Story reel fundador',
    brief: 'Cuenta una historia breve sobre perder ventas por no tener visibilidad de pipeline.',
    tone: 'story-relaxed',
    format: 'full-script',
  },
  {
    title: 'CEO directo',
    brief: '3 errores que le cuestan dinero a un negocio cuando marketing y ventas no comparten contexto.',
    tone: 'ceo-direct',
    format: 'storyboard',
  },
];

const MUSIC_PRESETS = ['Pulse Neon', 'Soft Tension', 'Cinematic Drop', 'Minimal Tech'];

const AVATAR_PRESETS = [
  { id: 'camila', label: 'Camila UGC', voice: 'warm-sales' },
  { id: 'leo', label: 'Leo Founder', voice: 'ceo-direct' },
  { id: 'nora', label: 'Nora Coach', voice: 'clear-mentor' },
  { id: 'dani', label: 'Dani Performance', voice: 'data-fast' },
  { id: 'sofia', label: 'Sofia Storyteller', voice: 'story-relaxed' },
  { id: 'max', label: 'Max Closer', voice: 'high-energy-closer' },
];

const ELEMENT_PRESETS: Array<{
  label: string;
  elementType: 'sticker' | 'lower-third' | 'button' | 'subtitle';
  text: string;
}> = [
  { label: 'Lower third oferta', elementType: 'lower-third', text: 'Oferta valida hoy · Nexora' },
  { label: 'Sticker CTA', elementType: 'sticker', text: 'Escribe QUIERO y te envio la guia' },
  { label: 'Boton DM', elementType: 'button', text: 'Enviar DM ahora' },
  { label: 'Subtitulo dinamico', elementType: 'subtitle', text: 'El problema no es trafico, es seguimiento.' },
];

const STOCK_PRESETS: StockClip[] = [
  {
    id: 'nexora-demo',
    name: 'Demo Nexora Vertical',
    url: '/videos/nexora-demo.mp4',
    duration: 20,
    source: 'local',
  },
];

type StockApiAsset = {
  id: string;
  title: string;
  url: string;
  provider: string;
  durationSec?: number;
  thumbnailUrl?: string;
};

export function LibraryPanel({
  brief,
  setBrief,
  onGenerate,
  onSnapshot,
  onRender,
  loading,
  canGenerate,
  generateCost,
  status,
  generationConfig,
  onGenerationConfigChange,
  onUploadFiles,
  onAddText,
  onAddAudioMarker,
  onAddMusicPreset,
  onAddAudioTrack,
  onAddAvatar,
  onAddElement,
  onAddStockClip,
  onApplyTransition,
}: {
  brief: string;
  setBrief: (value: string) => void;
  onGenerate: () => void;
  onSnapshot: () => void;
  onRender: () => void;
  loading: boolean;
  canGenerate: boolean;
  generateCost: number;
  status: string;
  generationConfig: GenerationConfig;
  onGenerationConfigChange: (config: GenerationConfig) => void;
  onUploadFiles: (files: File[]) => void;
  onAddText: (text: string) => boolean;
  onAddAudioMarker: (label: string) => void;
  onAddMusicPreset: (preset: string) => void;
  onAddAudioTrack: (track: FreeAudioTrack) => void;
  onAddAvatar: (avatarName: string) => void;
  onAddElement: (element: { label: string; elementType: 'sticker' | 'lower-third' | 'button' | 'subtitle'; text: string }) => void;
  onAddStockClip: (clip: StockClip) => void;
  onApplyTransition: (transition: 'fade' | 'slide-up' | 'zoom') => boolean;
}) {
  const [tab, setTab] = useState<Tab>('text');
  const [quickText, setQuickText] = useState('Texto corto para hook');
  const [audioQuery, setAudioQuery] = useState('trending');
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioTracks, setAudioTracks] = useState<FreeAudioTrack[]>([]);
  const [stockQuery, setStockQuery] = useState('marketing');
  const [stockLoading, setStockLoading] = useState(false);
  const [stockResults, setStockResults] = useState<StockClip[]>([]);
  const [stockSource, setStockSource] = useState<'stock' | 'meta'>('stock');
  const [stockMessage, setStockMessage] = useState('');

  const loadTracks = useCallback(async (query: string) => {
    setAudioLoading(true);
    try {
      const response = await fetch(`/api/music/trending-free?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      setAudioTracks((data.tracks || []) as FreeAudioTrack[]);
    } catch {
      setAudioTracks([]);
    } finally {
      setAudioLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTracks('trending');
  }, [loadTracks]);

  const loadStock = useCallback(async (query: string, source: 'stock' | 'meta') => {
    setStockLoading(true);
    setStockMessage('');
    try {
      const token = localStorage.getItem('token');
      const endpoint =
        source === 'meta'
          ? `/api/ai/studio/meta/videos?limit=12`
          : `/api/ai/studio/stock?q=${encodeURIComponent(query || 'marketing')}&kind=video&limit=8`;

      const response = await fetch(
        endpoint,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data.error || 'No se pudieron cargar clips de video.'));
      }

      const mapped = ((data.assets || []) as StockApiAsset[]).map((asset) => ({
        id: asset.id,
        name: asset.title,
        url: asset.url,
        duration: Math.max(5, Math.min(asset.durationSec || 20, 90)),
        source: source === 'meta' ? 'meta-ads' : asset.provider || 'stock',
      }));

      setStockResults(mapped.length > 0 ? mapped : STOCK_PRESETS);
      if (mapped.length === 0 && source === 'meta') {
        setStockMessage('Meta conectado, pero esta cuenta no tiene videos listos para usar.');
      }
    } catch (error) {
      setStockResults(STOCK_PRESETS);
      setStockMessage(
        error instanceof Error
          ? error.message
          : source === 'meta'
            ? 'No se pudo leer tu libreria de Meta. Revisa la conexion OAuth.'
            : 'No se pudo buscar stock externo.'
      );
    } finally {
      setStockLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStock('marketing', 'stock');
  }, [loadStock]);

  const filteredTracks = useMemo(() => {
    const query = audioQuery.trim().toLowerCase();
    if (!query) {
      return audioTracks;
    }

    return audioTracks.filter(
      (track) =>
        track.name.toLowerCase().includes(query) ||
        (track.mood || '').toLowerCase().includes(query) ||
        track.source.toLowerCase().includes(query)
    );
  }, [audioQuery, audioTracks]);

  const formatTime = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderTabContent = () => {
    if (tab === 'templates') {
      return (
        <div className="space-y-2">
          {TEMPLATE_PRESETS.map((preset) => (
            <button
              key={preset.title}
              onClick={() => {
                setBrief(preset.brief);
                onGenerationConfigChange({
                  ...generationConfig,
                  tone: preset.tone,
                  format: preset.format,
                });
              }}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-left transition hover:border-slate-700 hover:bg-slate-900"
            >
              <p className="text-sm font-semibold text-white">{preset.title}</p>
              <p className="mt-1 text-xs text-slate-400">{preset.brief}</p>
            </button>
          ))}
          <button
            onClick={onGenerate}
            disabled={loading || !canGenerate}
            className="w-full rounded-md bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Generando...' : `Generar con plantilla (${generateCost} cr)`}
          </button>
        </div>
      );
    }

    if (tab === 'uploads') {
      return (
        <div className="space-y-3">
          <label className="block rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 py-6 text-center text-xs text-slate-300 hover:border-cyan-500/60">
            Selecciona imagen, video o audio
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (files.length > 0) {
                  onUploadFiles(files);
                }
                event.currentTarget.value = '';
              }}
            />
          </label>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-slate-400">
            Los archivos seleccionados se insertan al timeline en Media/Audio para edición rápida.
          </div>
          <button
            onClick={onSnapshot}
            className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100"
          >
            Guardar snapshot actual
          </button>
        </div>
      );
    }

    if (tab === 'music') {
      return (
        <div className="space-y-2">
          {MUSIC_PRESETS.map((track) => (
            <button
              key={track}
              onClick={() => onAddMusicPreset(track)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-left transition hover:border-slate-700 hover:bg-slate-900"
            >
              <p className="text-sm font-semibold text-white">{track}</p>
              <p className="mt-1 text-xs text-slate-400">Click para agregarlo al track de Audio.</p>
            </button>
          ))}
          <button
            onClick={onRender}
            className="w-full rounded-md bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-300"
          >
            Probar render con audio
          </button>
        </div>
      );
    }

    if (tab === 'avatars') {
      return (
        <div className="space-y-2">
          {AVATAR_PRESETS.map((avatar) => (
            <div key={avatar.id} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3">
              <p className="text-sm font-semibold text-white">{avatar.label}</p>
              <p className="mt-1 text-xs text-slate-400">Voz sugerida: {avatar.voice}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => onAddAvatar(avatar.label)}
                  className="rounded-md bg-cyan-500/20 px-2 py-1.5 text-xs font-semibold text-cyan-300"
                >
                  Agregar avatar
                </button>
                <button
                  onClick={() => onAddAudioMarker(`Voice: ${avatar.voice}`)}
                  className="rounded-md bg-emerald-500/20 px-2 py-1.5 text-xs font-semibold text-emerald-300"
                >
                  Voz al timeline
                </button>
              </div>
            </div>
          ))}
          <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-slate-400">
            Inserta un bloque avatar en el canvas para narracion tipo UGC.
          </p>
        </div>
      );
    }

    if (tab === 'elements') {
      return (
        <div className="space-y-2">
          {ELEMENT_PRESETS.map((element) => (
            <button
              key={element.label}
              onClick={() => onAddElement(element)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-left transition hover:border-violet-500/60 hover:bg-slate-900"
            >
              <p className="text-sm font-semibold text-white">{element.label}</p>
              <p className="mt-1 text-xs text-slate-400">{element.text}</p>
            </button>
          ))}
        </div>
      );
    }

    if (tab === 'stock') {
      const clips = stockResults.length > 0 ? stockResults : STOCK_PRESETS;

      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex min-w-[128px] rounded-md border border-slate-700 bg-slate-900 p-1 text-[11px]">
              <button
                onClick={() => {
                  setStockSource('stock');
                  void loadStock(stockQuery || 'marketing', 'stock');
                }}
                className={`w-1/2 rounded px-2 py-1 font-semibold transition ${
                  stockSource === 'stock' ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
              >
                Stock
              </button>
              <button
                onClick={() => {
                  setStockSource('meta');
                  void loadStock('', 'meta');
                }}
                className={`w-1/2 rounded px-2 py-1 font-semibold transition ${
                  stockSource === 'meta' ? 'bg-cyan-700/50 text-cyan-100' : 'text-slate-400'
                }`}
              >
                Meta Ads
              </button>
            </div>
            <input
              value={stockQuery}
              onChange={(event) => setStockQuery(event.target.value)}
              placeholder="Buscar stock: founder, office, ads"
              disabled={stockSource === 'meta'}
              className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              onClick={() => void loadStock(stockQuery || 'marketing', stockSource)}
              className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
            >
              {stockSource === 'meta' ? 'Cargar' : 'Buscar'}
            </button>
          </div>

          {stockLoading ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-slate-400">Buscando stock...</p>
          ) : null}

          {!stockLoading && stockMessage ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-200">{stockMessage}</p>
          ) : null}

          {clips.map((clip) => (
            <button
              key={clip.id}
              onClick={() => onAddStockClip(clip)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-left transition hover:border-amber-500/60 hover:bg-slate-900"
            >
              <p className="text-sm font-semibold text-white">{clip.name}</p>
              <p className="mt-1 text-xs text-slate-400">{clip.duration}s · {clip.source}</p>
            </button>
          ))}
          <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-slate-400">
            Puedes subir mas clips desde Subidos o agregar este stock directo al track Media.
          </p>
        </div>
      );
    }

    if (tab === 'transitions') {
      const transitions: Array<{ id: 'fade' | 'slide-up' | 'zoom'; label: string }> = [
        { id: 'fade', label: 'Fade suave' },
        { id: 'slide-up', label: 'Slide up' },
        { id: 'zoom', label: 'Zoom in' },
      ];

      return (
        <div className="space-y-2">
          {transitions.map((transition) => (
            <button
              key={transition.id}
              onClick={() => {
                const applied = onApplyTransition(transition.id);
                if (!applied) {
                  return;
                }
              }}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-left transition hover:border-emerald-500/60 hover:bg-slate-900"
            >
              <p className="text-sm font-semibold text-white">{transition.label}</p>
              <p className="mt-1 text-xs text-slate-400">Aplicar al segmento seleccionado</p>
            </button>
          ))}
          <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-slate-400">
            Selecciona un segmento en timeline/canvas y aplica una transicion.
          </p>
        </div>
      );
    }

    if (tab === 'audio') {
      return (
        <div className="space-y-3">
          <label className="block rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 py-6 text-center text-xs text-slate-300 hover:border-emerald-500/60">
            Subir audio (mp3, wav, m4a)
            <input
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (files.length > 0) {
                  onUploadFiles(files);
                }
                event.currentTarget.value = '';
              }}
            />
          </label>
          <button
            onClick={() => onAddAudioMarker('Voice over / narration')}
            className="w-full rounded-md bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-300"
          >
            Agregar marcador de voz
          </button>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex gap-2">
              <input
                value={audioQuery}
                onChange={(event) => setAudioQuery(event.target.value)}
                placeholder="Buscar musica: upbeat, cinematic, lo-fi"
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              />
              <button
                onClick={() => void loadTracks(audioQuery || 'trending')}
                className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                Buscar
              </button>
            </div>

            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {audioLoading ? (
                <p className="text-xs text-slate-400">Cargando tracks gratis...</p>
              ) : filteredTracks.length === 0 ? (
                <p className="text-xs text-slate-400">Sin resultados. Prueba otro mood o termino.</p>
              ) : (
                filteredTracks.map((track) => (
                  <div key={track.id} className="group rounded-lg border border-slate-700 bg-slate-900/60 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-100">{track.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {formatTime(track.duration)} • {track.license} • {track.source}
                        </p>
                      </div>
                      <button
                        onClick={() => onAddAudioTrack(track)}
                        className="rounded bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-300 opacity-80 transition hover:opacity-100"
                      >
                        Anadir +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-slate-400">
            Esta sección agrega audio real al timeline o un marcador editable para locución.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
          <span className="text-xs text-slate-400">Texto rápido al canvas</span>
          <textarea
            value={quickText}
            onChange={(event) => setQuickText(event.target.value)}
            className="min-h-16 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <button
            onClick={() => onAddText(quickText)}
            className="w-full rounded-md bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-300"
          >
            Agregar texto al timeline
          </button>
        </div>

        <label className="block space-y-2">
          <span className="text-xs text-slate-400">Prompt IA</span>
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            className="min-h-24 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <div className="mt-4">
          <ToneSelector config={generationConfig} onChange={onGenerationConfigChange} />
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={onGenerate}
            disabled={loading || !canGenerate}
            className="w-full rounded-md bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Generando...' : `Generar (${generateCost} cr)`}
          </button>
          <button onClick={onSnapshot} className="w-full rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100">
            Guardar snapshot
          </button>
          <button onClick={onRender} className="w-full rounded-md bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-300">
            Renderizar
          </button>
        </div>
      </>
    );
  };

  return (
    <aside className="w-[250px] border-r border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Library</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {[
          { key: 'templates', label: 'Plantillas' },
          { key: 'uploads', label: 'Subidos' },
          { key: 'text', label: 'Texto' },
          { key: 'avatars', label: 'Avatares' },
          { key: 'elements', label: 'Elementos' },
          { key: 'stock', label: 'Stock' },
          { key: 'audio', label: 'Audio' },
          { key: 'music', label: 'Musica' },
          { key: 'transitions', label: 'FX' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key as Tab)}
            className={`rounded-md px-2 py-1.5 font-medium ${
              tab === item.key ? 'bg-slate-700 text-white' : 'bg-slate-800/70 text-slate-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4">{renderTabContent()}</div>

      <div className="mt-4 rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
        {status || 'Listo para editar y generar.'}
      </div>
    </aside>
  );
}

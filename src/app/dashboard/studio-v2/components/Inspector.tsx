'use client';

import type { AiOutputPayload } from '@/lib/ai-studio';
import { useState } from 'react';
import { useEditor } from '../store/EditorContext';
import type { Segment } from '../types/editor';
import { PreviewPhone } from './PreviewPhone';

function PreviewPanel({
  previewOutput,
  onAcceptPreview,
  onRegenerateBeat,
  regenerating,
}: {
  previewOutput: AiOutputPayload;
  onAcceptPreview: () => void;
  onRegenerateBeat: (target: 'hook' | 'conflict' | 'resolution' | 'cta') => void;
  regenerating: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Preview antes de aceptar</p>
      <PreviewPhone output={previewOutput} />
      <div className="space-y-2">
        {previewOutput.beats?.map((beat) => (
          <div key={beat.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{beat.label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{beat.text}</p>
              </div>
              <button
                onClick={() => onRegenerateBeat(beat.id)}
                disabled={regenerating}
                className="rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-cyan-300 disabled:opacity-50"
              >
                {regenerating ? '...' : 'Regenerar 5 cr'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onAcceptPreview} className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950">
        Enviar preview al canvas
      </button>
    </div>
  );
}

function MediaInspector({ segment }: { segment: Segment }) {
  const { dispatch } = useEditor();
  const [volume, setVolume] = useState(segment.properties.volume ?? 1);
  const [isMuted, setIsMuted] = useState(Boolean(segment.properties.muted));
  const mediaLabel = segment.properties.mediaType === 'video' ? 'Video' : segment.properties.mediaType === 'image' ? 'Imagen' : 'Audio';

  const updateProperties = (properties: Partial<Segment['properties']>) =>
    dispatch({
      type: 'UPDATE_SEGMENT',
      payload: {
        id: segment.id,
        updates: {
          properties,
        },
      },
    });

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Propiedades de {mediaLabel}</h3>

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
        <p className="font-semibold text-white">{segment.properties.text || mediaLabel}</p>
        <p className="mt-1 text-slate-400">
          Inicio: {segment.startTime.toFixed(1)}s | Duracion: {segment.duration.toFixed(1)}s
        </p>
      </div>

      {segment.properties.mediaType === 'video' || segment.properties.mediaType === 'audio' ? (
        <>
          <label className="block space-y-2">
            <span className="text-xs text-slate-400">Volumen: {Math.round(volume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={volume}
              onChange={(event) => {
                const value = Number(event.target.value);
                setVolume(value);
                updateProperties({ volume: value });
              }}
              className="w-full accent-cyan-500"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={isMuted}
              onChange={(event) => {
                const value = event.target.checked;
                setIsMuted(value);
                updateProperties({ muted: value });
              }}
              className="h-4 w-4 rounded border-slate-600"
            />
            Silenciar audio
          </label>
        </>
      ) : null}

      {(segment.properties.mediaType === 'video' || segment.properties.mediaType === 'image') && (
        <>
          <label className="block space-y-2">
            <span className="text-xs text-slate-400">Escala: {Math.round((segment.properties.scale || 1) * 100)}%</span>
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.1}
              value={segment.properties.scale || 1}
              onChange={(event) => updateProperties({ scale: Number(event.target.value) })}
              className="w-full accent-cyan-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateProperties({ objectFit: 'contain' })}
              className="rounded-md bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-200"
            >
              Mantener proporcion
            </button>
            <button
              onClick={() => updateProperties({ objectFit: 'cover' })}
              className="rounded-md bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-200"
            >
              Ajustar a pantalla
            </button>
          </div>
        </>
      )}

      <label className="block space-y-2">
        <span className="text-xs text-slate-400">Posicion X: {Math.round(segment.properties.x)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={segment.properties.x}
          onChange={(event) => updateProperties({ x: Number(event.target.value) })}
          className="w-full accent-cyan-500"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs text-slate-400">Posicion Y: {Math.round(segment.properties.y)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={segment.properties.y}
          onChange={(event) => updateProperties({ y: Number(event.target.value) })}
          className="w-full accent-cyan-500"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs text-slate-400">Opacidad: {Math.round((segment.properties.opacity || 1) * 100)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((segment.properties.opacity || 1) * 100)}
          onChange={(event) => updateProperties({ opacity: Number(event.target.value) / 100 })}
          className="w-full accent-cyan-500"
        />
      </label>
    </div>
  );
}

function TextInspector({ segment }: { segment: Segment }) {
  const { dispatch } = useEditor();
  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Propiedades de texto</h3>

      <label className="block space-y-2">
        <span className="text-xs text-slate-400">Texto</span>
        <textarea
          value={segment.properties.text || ''}
          onChange={(event) =>
            dispatch({
              type: 'UPDATE_SEGMENT',
              payload: { id: segment.id, updates: { properties: { text: event.target.value } } },
            })
          }
          className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs text-slate-400">Posicion X: {Math.round(segment.properties.x)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={segment.properties.x}
          onChange={(event) =>
            dispatch({
              type: 'UPDATE_SEGMENT',
              payload: { id: segment.id, updates: { properties: { x: Number(event.target.value) } } },
            })
          }
          className="w-full accent-cyan-500"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs text-slate-400">Posicion Y: {Math.round(segment.properties.y)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={segment.properties.y}
          onChange={(event) =>
            dispatch({
              type: 'UPDATE_SEGMENT',
              payload: { id: segment.id, updates: { properties: { y: Number(event.target.value) } } },
            })
          }
          className="w-full accent-cyan-500"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs text-slate-400">Tamano fuente</span>
        <input
          type="number"
          min={10}
          max={180}
          value={segment.properties.fontSize || 48}
          onChange={(event) =>
            dispatch({
              type: 'UPDATE_SEGMENT',
              payload: { id: segment.id, updates: { properties: { fontSize: Number(event.target.value) } } },
            })
          }
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs text-slate-400">Opacidad: {Math.round((segment.properties.opacity || 1) * 100)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((segment.properties.opacity || 1) * 100)}
          onChange={(event) =>
            dispatch({
              type: 'UPDATE_SEGMENT',
              payload: {
                id: segment.id,
                updates: { properties: { opacity: Number(event.target.value) / 100 } },
              },
            })
          }
          className="w-full accent-cyan-500"
        />
      </label>

      <div className="space-y-2">
        <span className="text-xs text-slate-400">Color</span>
        <div className="flex gap-2">
          {['#ffffff', '#000000', '#ef4444', '#10b981', '#3b82f6'].map((color) => (
            <button
              key={color}
              type="button"
              onClick={() =>
                dispatch({
                  type: 'UPDATE_SEGMENT',
                  payload: { id: segment.id, updates: { properties: { color } } },
                })
              }
              className="h-6 w-6 rounded-full border border-slate-600"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Inspector({
  previewOutput,
  onAcceptPreview,
  onClearPreview,
  onRegenerateBeat,
  regenerating,
}: {
  previewOutput: AiOutputPayload | null;
  onAcceptPreview: () => void;
  onClearPreview: () => void;
  onRegenerateBeat: (target: 'hook' | 'conflict' | 'resolution' | 'cta') => void;
  regenerating: boolean;
}) {
  const { project, dispatch } = useEditor();

  if (!project.selectedSegmentId) {
    return (
      <aside className="w-80 border-l border-slate-800 bg-slate-900/40 p-6">
        {previewOutput ? (
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Preview social</p>
            <PreviewPhone output={previewOutput} />
            <div className="space-y-2">
              {previewOutput.beats?.map((beat) => (
                <div key={beat.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{beat.label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{beat.text}</p>
                    </div>
                    <button
                      onClick={() => onRegenerateBeat(beat.id)}
                      disabled={regenerating}
                      className="rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-cyan-300 disabled:opacity-50"
                    >
                      {regenerating ? '...' : 'Regenerar 5 cr'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <button onClick={onAcceptPreview} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950">
                Enviar al canvas
              </button>
              <button onClick={onClearPreview} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200">
                Descartar preview
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Selecciona un elemento en el canvas para editarlo.</p>
        )}
      </aside>
    );
  }

  const segment = project.tracks
    .flatMap((track) => track.segments)
    .find((item) => item.id === project.selectedSegmentId);

  if (!segment) {
    return null;
  }

  const isMedia =
    segment.properties.mediaType === 'video' ||
    segment.properties.mediaType === 'image' ||
    segment.properties.mediaType === 'audio';

  const handleDelete = () => {
    dispatch({ type: 'DELETE_SEGMENT', payload: { id: segment.id } });
  };

  return (
    <aside className="w-80 space-y-5 overflow-y-auto border-l border-slate-800 bg-slate-900/40 p-6">
      <button
        onClick={handleDelete}
        className="w-full rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200"
      >
        Eliminar elemento seleccionado
      </button>

      {previewOutput ? <PreviewPanel previewOutput={previewOutput} onAcceptPreview={onAcceptPreview} onRegenerateBeat={onRegenerateBeat} regenerating={regenerating} /> : null}

      {isMedia ? <MediaInspector segment={segment} /> : <TextInspector segment={segment} />}
    </aside>
  );
}

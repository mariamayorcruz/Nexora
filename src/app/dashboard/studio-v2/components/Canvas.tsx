'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store/EditorContext';
import { Segment } from '../types/editor';

interface DragState {
  segId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export function Canvas() {
  const { project, dispatch, isPlaying } = useEditor();
  const canvasRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [dragging, setDragging] = useState<DragState | null>(null);
  const playheadLeft = `${Math.min(100, (project.currentTime / Math.max(project.duration, 0.1)) * 100)}%`;

  const activeSegments = project.tracks
    .flatMap((track) =>
      track.segments.filter(
        (segment) => project.currentTime >= segment.startTime && project.currentTime <= segment.endTime
      )
    )
    .sort((a, b) => a.layerIndex - b.layerIndex);

  useEffect(() => {
    activeSegments.forEach((segment) => {
      if (segment.properties.mediaType !== 'video') {
        return;
      }

      const videoEl = videoRefs.current[segment.id];
      if (!videoEl) {
        return;
      }

      const targetTime = Math.max(0, project.currentTime - segment.startTime);
      const drift = Math.abs((videoEl.currentTime || 0) - targetTime);

      if (drift > 0.15) {
        try {
          videoEl.currentTime = targetTime;
        } catch {
          // Ignore metadata race conditions while browser loads local object URLs.
        }
      }

      videoEl.muted = Boolean(segment.properties.muted);
      videoEl.volume = Math.max(0, Math.min(1, segment.properties.volume ?? 1));

      if (isPlaying) {
        const playAttempt = videoEl.play();
        if (playAttempt && typeof playAttempt.catch === 'function') {
          playAttempt.catch(() => {
            // Browsers can block autoplay with audio until user interaction.
          });
        }
      } else {
        videoEl.pause();
      }
    });
  }, [activeSegments, isPlaying, project.currentTime]);

  const handleMouseDown = (event: React.MouseEvent, segment: Segment) => {
    event.stopPropagation();
    dispatch({ type: 'SELECT_SEGMENT', payload: segment.id });

    setDragging({
      segId: segment.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: segment.properties.x,
      origY: segment.properties.y,
    });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const deltaX = ((event.clientX - dragging.startX) / rect.width) * 100;
    const deltaY = ((event.clientY - dragging.startY) / rect.height) * 100;

    dispatch({
      type: 'UPDATE_SEGMENT',
      payload: {
        id: dragging.segId,
        updates: {
          properties: {
            x: Math.max(0, Math.min(100, dragging.origX + deltaX)),
            y: Math.max(0, Math.min(100, dragging.origY + deltaY)),
          },
        },
      },
    });
  };

  const stopDragging = () => setDragging(null);

  return (
    <div className="relative flex h-full items-center justify-center bg-slate-950 p-8">
      <div
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onClick={() => dispatch({ type: 'SELECT_SEGMENT', payload: null })}
        className="relative overflow-hidden rounded-xl bg-black shadow-[0_30px_100px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
        style={{ width: 'min(420px,42vw)', aspectRatio: `${project.canvas.width}/${project.canvas.height}` }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="pointer-events-none absolute left-[6%] right-[6%] top-[14%] border-t border-dashed border-white/20" />
        <div className="pointer-events-none absolute left-[6%] right-[6%] bottom-[14%] border-t border-dashed border-white/20" />

        {activeSegments.map((segment) => (
          <div
            key={segment.id}
            onMouseDown={(event) => handleMouseDown(event, segment)}
            className={`absolute cursor-move select-none rounded px-4 py-2 font-semibold transition ${
              project.selectedSegmentId === segment.id
                ? 'ring-2 ring-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.35)]'
                : 'hover:shadow-[0_0_20px_rgba(34,211,238,0.25)]'
            } ${
              segment.properties.transition === 'fade'
                ? 'animate-pulse'
                : segment.properties.transition === 'zoom'
                  ? 'scale-[1.02]'
                  : segment.properties.transition === 'slide-up'
                    ? '-translate-y-0.5'
                    : ''
            }`}
            style={{
              left: `${segment.properties.x}%`,
              top: `${segment.properties.y}%`,
              transform: `translate(-50%, -50%) rotate(${segment.properties.rotation || 0}deg)`,
              color: segment.properties.color || '#ffffff',
              fontSize: `${Math.max(12, (segment.properties.fontSize || 48) * 0.16)}px`,
              backgroundColor: segment.properties.backgroundColor || 'transparent',
              opacity: dragging?.segId === segment.id ? 0.7 : segment.properties.opacity,
              width:
                segment.properties.mediaType === 'video' || segment.properties.mediaType === 'image'
                  ? `${Math.max(20, Math.min(180, (segment.properties.scale || 1) * 100))}%`
                  : 'auto',
            }}
          >
            {segment.properties.mediaUrl && segment.properties.mediaType === 'video' ? (
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-black">
                <video
                  ref={(element) => {
                    videoRefs.current[segment.id] = element;
                  }}
                  src={segment.properties.mediaUrl}
                  className="h-full w-full rounded-lg shadow-2xl"
                  style={{ objectFit: segment.properties.objectFit || 'contain' }}
                  preload="metadata"
                  muted={Boolean(segment.properties.muted)}
                  playsInline
                  controls={false}
                />
              </div>
            ) : null}

            {segment.properties.mediaType === 'avatar' ? (
              <div className="rounded-xl border border-cyan-300/40 bg-gradient-to-br from-cyan-500/20 via-slate-900 to-indigo-500/20 px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200">Avatar</p>
                <p className="mt-1 text-xs font-semibold text-white">{segment.properties.text || 'Avatar block'}</p>
              </div>
            ) : null}

            {segment.properties.mediaUrl && segment.properties.mediaType === 'image' ? (
              <Image
                src={segment.properties.mediaUrl}
                alt={segment.properties.text || 'Media'}
                className="h-full w-full rounded-lg"
                width={640}
                height={640}
                style={{ objectFit: segment.properties.objectFit || 'contain' }}
              />
            ) : null}

            {segment.properties.mediaType === 'audio' ? (
              <div className="rounded-md border border-emerald-300/50 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200">
                {segment.properties.text || 'Audio track'}
              </div>
            ) : null}

            {!segment.properties.mediaType || (!segment.properties.mediaUrl && segment.properties.mediaType !== 'audio' && segment.properties.mediaType !== 'avatar') ? (
              <>{segment.properties.text || 'Texto'}</>
            ) : null}

            {project.selectedSegmentId === segment.id ? (
              <>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    dispatch({ type: 'DELETE_SEGMENT', payload: { id: segment.id } });
                  }}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-rose-300/70 bg-rose-500/90 text-[10px] font-black text-white shadow-lg"
                  title="Eliminar elemento"
                >
                  x
                </button>
                <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border border-slate-900 bg-white" />
                <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border border-slate-900 bg-white" />
                <span className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full border border-slate-900 bg-white" />
                <span className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full border border-slate-900 bg-white" />
              </>
            ) : null}
          </div>
        ))}

        <div className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-red-500/90 shadow-[0_0_18px_rgba(239,68,68,0.5)]" style={{ left: playheadLeft }} />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 font-mono text-xs text-white">
        {project.currentTime.toFixed(1)}s / {project.duration.toFixed(1)}s
      </div>
    </div>
  );
}

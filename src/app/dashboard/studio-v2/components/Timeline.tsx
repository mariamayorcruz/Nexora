'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../store/EditorContext';

export function Timeline() {
  const { project, dispatch, isPlaying, setIsPlaying } = useEditor();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [resizing, setResizing] = useState<{
    segmentId: string;
    edge: 'left' | 'right';
    startX: number;
    initialStart: number;
    initialDuration: number;
  } | null>(null);

  const pxPerSec = 50 * (project.zoom || 1);
  const totalWidth = Math.max(900, project.duration * pxPerSec + 120);
  const playheadLeft = project.currentTime * pxPerSec;
  const viewStart = Math.max(0, project.viewStart || 0);
  const viewEnd = Math.max(viewStart + 1, Math.min(project.duration, project.viewEnd || project.duration));

  const trackTone = useMemo(
    () => ({
      overlay: 'bg-cyan-500/35 border-cyan-300/50',
      media: 'bg-violet-500/35 border-violet-300/50',
      audio: 'bg-emerald-500/35 border-emerald-300/50',
    }),
    []
  );

  const handleScrub = useCallback((clientX: number, rect: DOMRect) => {
    const relative = Math.max(0, Math.min(clientX - rect.left, totalWidth));
    const time = relative / pxPerSec;
    dispatch({ type: 'SET_TIME', payload: time });
  }, [dispatch, pxPerSec, totalWidth]);

  const formatTime = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResizeStart = (
    event: React.MouseEvent,
    segmentId: string,
    edge: 'left' | 'right',
    initialStart: number,
    initialDuration: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setResizing({
      segmentId,
      edge,
      startX: event.clientX,
      initialStart,
      initialDuration,
    });
  };

  useEffect(() => {
    if (!resizing) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const deltaSeconds = (event.clientX - resizing.startX) / pxPerSec;

      let newStart = resizing.initialStart;
      let newDuration = resizing.initialDuration;

      if (resizing.edge === 'right') {
        newDuration = Math.max(0.5, resizing.initialDuration + deltaSeconds);
      } else {
        const maxDelta = resizing.initialDuration - 0.5;
        const clampedDelta = Math.max(-resizing.initialStart, Math.min(maxDelta, deltaSeconds));
        newStart = resizing.initialStart + clampedDelta;
        newDuration = resizing.initialDuration - clampedDelta;
      }

      dispatch({
        type: 'UPDATE_SEGMENT',
        payload: {
          id: resizing.segmentId,
          updates: {
            startTime: newStart,
            duration: newDuration,
            endTime: newStart + newDuration,
          },
        },
      });
    };

    const onMouseUp = () => setResizing(null);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dispatch, pxPerSec, resizing]);

  useEffect(() => {
    if (!scrubbing || !timelineRef.current) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      if (!timelineRef.current) {
        return;
      }

      const rect = timelineRef.current.getBoundingClientRect();
      handleScrub(event.clientX, rect);
    };

    const onMouseUp = () => setScrubbing(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleScrub, scrubbing]);

  const splitAtPlayhead = useCallback(() => {
    const candidateTracks = project.selectedSegmentId
      ? project.tracks.map((track) => ({
          ...track,
          segments: track.segments.filter((segment) => segment.id === project.selectedSegmentId),
        }))
      : project.tracks;

    for (const track of candidateTracks) {
      for (const segment of track.segments) {
        if (project.currentTime > segment.startTime && project.currentTime < segment.endTime) {
          const firstDuration = Math.max(0.5, project.currentTime - segment.startTime);
          const secondDuration = Math.max(0.5, segment.endTime - project.currentTime);

          dispatch({
            type: 'UPDATE_SEGMENT',
            payload: {
              id: segment.id,
              updates: {
                duration: firstDuration,
                endTime: segment.startTime + firstDuration,
              },
            },
          });

          dispatch({
            type: 'ADD_SEGMENT',
            payload: {
              ...segment,
              id: `seg-split-${Date.now()}`,
              startTime: project.currentTime,
              duration: secondDuration,
              endTime: project.currentTime + secondDuration,
            },
          });

          return;
        }
      }
    }
  }, [dispatch, project.currentTime, project.selectedSegmentId, project.tracks]);

  const deleteSelectedSegment = useCallback(() => {
    if (!project.selectedSegmentId) {
      return;
    }

    dispatch({
      type: 'DELETE_SEGMENT',
      payload: { id: project.selectedSegmentId },
    });
  }, [dispatch, project.selectedSegmentId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        splitAtPlayhead();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        const isTyping =
          tagName === 'input' ||
          tagName === 'textarea' ||
          target?.isContentEditable;

        if (isTyping || !project.selectedSegmentId) {
          return;
        }

        event.preventDefault();
        deleteSelectedSegment();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelectedSegment, project.selectedSegmentId, splitAtPlayhead]);

  const resizingSegment = resizing
    ? project.tracks
        .flatMap((track) => track.segments)
        .find((segment) => segment.id === resizing.segmentId)
    : null;

  const visibleTickStart = Math.max(0, Math.floor(viewStart) - 1);
  const visibleTickEnd = Math.min(Math.ceil(project.duration), Math.ceil(viewEnd) + 1);

  const visibleTicks = Array.from(
    { length: Math.max(0, visibleTickEnd - visibleTickStart + 1) },
    (_, idx) => visibleTickStart + idx
  );

  return (
    <section className="h-[150px] border-t border-slate-800 bg-slate-950/95 px-3 py-3">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
        <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
          <button onClick={() => setIsPlaying((v) => !v)} className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white">
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_TIME', payload: Math.max(0, project.currentTime - 1) })}
            className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
          >
            {'<<'}
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_TIME', payload: Math.min(project.duration, project.currentTime + 1) })}
            className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
          >
            {'>>'}
          </button>
          <button onClick={splitAtPlayhead} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">
            Split (S)
          </button>
          <button
            onClick={deleteSelectedSegment}
            disabled={!project.selectedSegmentId}
            className="rounded bg-rose-500/20 px-2 py-1 text-xs font-semibold text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Eliminar (Del)
          </button>
          <button
            onClick={() => dispatch({ type: 'FIT_TO_SCREEN', payload: { viewportPx: timelineRef.current?.clientWidth || 900 } })}
            className="rounded bg-cyan-500/20 px-2 py-1 text-xs font-semibold text-cyan-300"
          >
            Ajustar
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_DURATION', payload: project.duration + 60 })}
            className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
          >
            +60s
          </button>
          <span className="text-[10px] text-slate-500">
            {formatTime(project.duration)} / max {formatTime(project.maxDuration)}
          </span>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            <span>Zoom</span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              value={project.zoom || 1}
              onChange={(event) => dispatch({ type: 'SET_ZOOM', payload: Number(event.target.value) })}
              className="w-24 accent-cyan-500"
            />
          </div>
        </div>

        <div
          ref={timelineRef}
          className="relative flex-1 overflow-x-auto"
          onScroll={(event) => {
            const container = event.currentTarget;
            const start = container.scrollLeft / pxPerSec;
            const end = start + container.clientWidth / pxPerSec;
            dispatch({ type: 'SET_VIEW_RANGE', payload: { start, end } });
          }}
          onMouseDown={(event) => {
            if (resizing) {
              return;
            }

            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
            handleScrub(event.clientX, rect);
            setScrubbing(true);
          }}
        >
          <div style={{ width: totalWidth }} className="relative min-h-full">
            <div className="sticky top-0 z-10 flex h-6 border-b border-slate-800 bg-slate-950/95">
              {visibleTicks.map((second) => (
                <div
                  key={second}
                  className={`relative border-r ${second % 5 === 0 ? 'border-slate-600' : 'border-slate-800'} text-[10px] text-slate-400`}
                  style={{ width: pxPerSec, left: second * pxPerSec, position: 'absolute' }}
                >
                  {second % 5 === 0 ? <span className="absolute left-1 top-0">{second}s</span> : null}
                </div>
              ))}
            </div>

            {project.tracks.map((track, rowIndex) => (
              <div key={track.id} className={`relative h-9 border-b border-slate-800 ${rowIndex % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}`}>
                <span className="absolute left-2 top-1.5 z-10 text-[10px] uppercase tracking-[0.14em] text-slate-500">{track.name}</span>
                {track.segments.filter((segment) => segment.endTime > viewStart - 2 && segment.startTime < viewEnd + 2).map((segment) => {
                  const isSelected = project.selectedSegmentId === segment.id;

                  return (
                  <div
                    key={segment.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatch({ type: 'SELECT_SEGMENT', payload: segment.id });
                    }}
                    className={`absolute top-1 h-7 rounded-md border px-2 text-left text-[10px] text-white ${trackTone[track.type]} ${
                      isSelected ? 'ring-2 ring-white/50' : ''
                    }`}
                    style={{
                      left: segment.startTime * pxPerSec,
                      width: Math.max(20, segment.duration * pxPerSec),
                    }}
                    title={segment.properties.text || segment.id}
                  >
                    <span className="block truncate pr-3">{segment.properties.text || 'Segmento'}</span>
                    <span className="absolute right-1 top-1 text-[9px] text-white/70">{segment.duration.toFixed(1)}s</span>

                    {isSelected ? (
                      <>
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-white/40"
                          onMouseDown={(event) =>
                            handleResizeStart(event, segment.id, 'left', segment.startTime, segment.duration)
                          }
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-white/40"
                          onMouseDown={(event) =>
                            handleResizeStart(event, segment.id, 'right', segment.startTime, segment.duration)
                          }
                        />
                      </>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            ))}

            <div
              className="pointer-events-none absolute bottom-0 top-0 z-20 w-[2px] bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]"
              style={{ left: playheadLeft }}
            >
              <div className="absolute -top-1 -left-[5px] h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
            </div>

            {resizing && resizingSegment ? (
              <div className="pointer-events-none absolute left-3 top-8 z-30 rounded bg-slate-950/95 px-2 py-1 text-[10px] text-cyan-300">
                Start: {resizingSegment.startTime.toFixed(1)}s | Duration: {resizingSegment.duration.toFixed(1)}s
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

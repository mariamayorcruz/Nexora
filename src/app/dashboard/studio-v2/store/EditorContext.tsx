'use client';

import React, { createContext, useContext, useMemo, useReducer, useState } from 'react';
import { Segment, SegmentProperties, StudioProject } from '../types/editor';

type Action =
  | { type: 'SET_TIME'; payload: number }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_VIEW_RANGE'; payload: { start: number; end: number } }
  | { type: 'FIT_TO_SCREEN'; payload?: { viewportPx?: number } }
  | { type: 'SELECT_SEGMENT'; payload: string | null }
  | {
      type: 'UPDATE_SEGMENT';
      payload: {
        id: string;
        updates: Omit<Partial<Segment>, 'properties'> & {
          properties?: Partial<SegmentProperties>;
        };
      };
    }
  | { type: 'ADD_SEGMENT'; payload: Segment }
  | { type: 'DELETE_SEGMENT'; payload: { id: string } }
  | { type: 'SET_PROJECT'; payload: StudioProject };

const initialProject: StudioProject = {
  id: 'nexora-studio-local',
  name: 'Proyecto sin titulo',
  duration: 60,
  maxDuration: 3600,
  currentTime: 0,
  zoom: 1,
  viewStart: 0,
  viewEnd: 60,
  canvas: { width: 1080, height: 1920 },
  tracks: [
    { id: 'track-overlay', type: 'overlay', name: 'Textos', segments: [] },
    { id: 'track-media', type: 'media', name: 'Media', segments: [] },
    { id: 'track-audio', type: 'audio', name: 'Audio', segments: [] },
  ],
  selectedSegmentId: null,
};

function resolveDuration(state: StudioProject) {
  const maxEnd = state.tracks
    .flatMap((track) => track.segments)
    .reduce((max, segment) => Math.max(max, segment.endTime), 0);

  return Math.min(state.maxDuration, Math.max(10, Math.max(state.duration, maxEnd)));
}

function editorReducer(state: StudioProject, action: Action): StudioProject {
  switch (action.type) {
    case 'SET_PROJECT':
      return {
        ...action.payload,
        maxDuration: action.payload.maxDuration || 3600,
        zoom: action.payload.zoom || 1,
        viewStart: action.payload.viewStart || 0,
        viewEnd: action.payload.viewEnd || action.payload.duration || 60,
      };

    case 'SET_TIME':
      return {
        ...state,
        currentTime: Math.max(0, Math.min(action.payload, state.duration)),
      };

    case 'SET_ZOOM':
      return {
        ...state,
        zoom: Math.max(0.5, Math.min(3, action.payload)),
      };

    case 'SET_DURATION':
      return {
        ...state,
        duration: Math.max(10, Math.min(action.payload, state.maxDuration)),
      };

    case 'SET_VIEW_RANGE': {
      const start = Math.max(0, action.payload.start);
      const end = Math.max(start + 1, Math.min(state.duration, action.payload.end));
      return {
        ...state,
        viewStart: start,
        viewEnd: end,
      };
    }

    case 'FIT_TO_SCREEN': {
      const viewportPx = Math.max(480, action.payload?.viewportPx || 900);
      const adaptiveZoom = Math.max(0.1, Math.min(1, viewportPx / Math.max(1, state.duration * 50)));
      return {
        ...state,
        zoom: adaptiveZoom,
        viewStart: 0,
        viewEnd: state.duration,
      };
    }

    case 'SELECT_SEGMENT':
      return {
        ...state,
        selectedSegmentId: action.payload,
      };

    case 'ADD_SEGMENT': {
      const segment = action.payload;
      const nextState = {
        ...state,
        tracks: state.tracks.map((track) =>
          track.id === segment.trackId
            ? { ...track, segments: [...track.segments, segment] }
            : track
        ),
        selectedSegmentId: segment.id,
      };

      return {
        ...nextState,
        duration: resolveDuration(nextState),
        viewEnd: Math.max(nextState.viewEnd, segment.endTime),
      };
    }

    case 'DELETE_SEGMENT': {
      const nextTracks = state.tracks.map((track) => ({
        ...track,
        segments: track.segments.filter((segment) => segment.id !== action.payload.id),
      }));

      const stillExists = nextTracks.some((track) =>
        track.segments.some((segment) => segment.id === state.selectedSegmentId)
      );

      const nextState = {
        ...state,
        tracks: nextTracks,
        selectedSegmentId: stillExists ? state.selectedSegmentId : null,
      };

      return {
        ...nextState,
        duration: resolveDuration(nextState),
      };
    }

    case 'UPDATE_SEGMENT': {
      const nextState = {
        ...state,
        tracks: state.tracks.map((track) => ({
          ...track,
          segments: track.segments.map((segment) => {
            if (segment.id !== action.payload.id) {
              return segment;
            }

            return {
              ...segment,
              ...action.payload.updates,
              properties: {
                ...segment.properties,
                ...(action.payload.updates.properties || {}),
              },
            };
          }),
        })),
      };

      return {
        ...nextState,
        duration: resolveDuration(nextState),
      };
    }

    default:
      return state;
  }
}

interface EditorContextValue {
  project: StudioProject;
  dispatch: React.Dispatch<Action>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [project, dispatch] = useReducer(editorReducer, initialProject);
  const [isPlaying, setIsPlaying] = useState(false);

  const value = useMemo(
    () => ({ project, dispatch, isPlaying, setIsPlaying }),
    [project, isPlaying]
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error('useEditor must be used within EditorProvider');
  }

  return ctx;
}

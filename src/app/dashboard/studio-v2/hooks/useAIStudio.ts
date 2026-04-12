'use client';

import { useCallback, useState } from 'react';
import type { AiOutputPayload, GenerationConfig } from '@/lib/ai-studio';
import { useEditor } from '../store/EditorContext';

const GENERATE_COST = 20;

type CreditBalance = {
  available: number;
  used: number;
  plan: number;
  expires: string;
};

export type FreeAudioTrack = {
  id: string;
  name: string;
  url: string;
  duration: number;
  license: string;
  source: string;
  mood?: string;
};

export type StockClip = {
  id: string;
  name: string;
  url: string;
  duration: number;
  source: string;
};

function safeBrief(prompt: string) {
  const value = prompt.trim();
  if (value.length >= 8) {
    return value;
  }

  return 'Genera un hook y texto comercial breve para captar atencion en redes.';
}

export function useAIStudio() {
  const { project, dispatch } = useEditor();
  const [loading, setLoading] = useState(false);

  const addTextToTimeline = (text: string) => {
    const value = text.trim();
    if (!value) {
      return false;
    }

    const start = Math.min(project.duration, project.currentTime);
    const duration = 5;

    dispatch({
      type: 'ADD_SEGMENT',
      payload: {
        id: `seg-text-${Date.now()}`,
        trackId: 'track-overlay',
        assetId: `asset-text-${Date.now()}`,
        startTime: start,
        duration,
        endTime: start + duration,
        layerIndex: 1,
        properties: {
          x: 50,
          y: 50,
          text: value,
          fontSize: 48,
          color: '#ffffff',
          opacity: 1,
        },
      },
    });

    return true;
  };

  const addAudioMarkerToTimeline = (label: string, duration = 12) => {
    const start = Math.min(project.duration, project.currentTime);

    dispatch({
      type: 'ADD_SEGMENT',
      payload: {
        id: `seg-audio-${Date.now()}`,
        trackId: 'track-audio',
        assetId: `asset-audio-${Date.now()}`,
        startTime: start,
        duration,
        endTime: start + duration,
        layerIndex: 1,
        properties: {
          x: 50,
          y: 88,
          text: label,
          color: '#d1fae5',
          opacity: 1,
          mediaType: 'audio',
          volume: 1,
          muted: false,
        },
      },
    });

    if (start + duration > project.duration) {
      dispatch({ type: 'SET_DURATION', payload: start + duration + 15 });
    }
  };

  const addMusicPresetToTimeline = (preset: string) => {
    addAudioMarkerToTimeline(`Music: ${preset}`, 16);
  };

  const addAudioTrackToTimeline = (track: FreeAudioTrack) => {
    const start = Math.min(project.duration, project.currentTime);
    const duration = Math.max(5, Math.min(track.duration || 20, project.maxDuration));

    dispatch({
      type: 'ADD_SEGMENT',
      payload: {
        id: `seg-track-${Date.now()}`,
        trackId: 'track-audio',
        assetId: `asset-track-${track.id}`,
        startTime: start,
        duration,
        endTime: start + duration,
        layerIndex: 1,
        properties: {
          x: 50,
          y: 88,
          text: `${track.name} (${track.source})`,
          color: '#d1fae5',
          opacity: 1,
          mediaType: 'audio',
          mediaUrl: track.url,
          volume: 1,
          muted: false,
        },
      },
    });

    if (start + duration > project.duration) {
      dispatch({ type: 'SET_DURATION', payload: start + duration + 15 });
    }
  };

  const addAvatarToTimeline = (avatarName: string) => {
    const start = Math.min(project.duration, project.currentTime);
    const duration = 8;

    dispatch({
      type: 'ADD_SEGMENT',
      payload: {
        id: `seg-avatar-${Date.now()}`,
        trackId: 'track-overlay',
        assetId: `asset-avatar-${avatarName.toLowerCase().replace(/\s+/g, '-')}`,
        startTime: start,
        duration,
        endTime: start + duration,
        layerIndex: 2,
        properties: {
          x: 50,
          y: 64,
          text: `Avatar: ${avatarName}`,
          color: '#dbeafe',
          backgroundColor: 'rgba(30,41,59,0.72)',
          fontSize: 34,
          opacity: 1,
          mediaType: 'avatar',
          scale: 1,
        },
      },
    });
  };

  const addElementToTimeline = (element: {
    label: string;
    elementType: 'sticker' | 'lower-third' | 'button' | 'subtitle';
    text: string;
  }) => {
    const start = Math.min(project.duration, project.currentTime);
    const duration = 6;

    dispatch({
      type: 'ADD_SEGMENT',
      payload: {
        id: `seg-element-${Date.now()}`,
        trackId: 'track-overlay',
        assetId: `asset-element-${element.elementType}-${Date.now()}`,
        startTime: start,
        duration,
        endTime: start + duration,
        layerIndex: 3,
        properties: {
          x: element.elementType === 'lower-third' ? 50 : 62,
          y: element.elementType === 'lower-third' ? 86 : 30,
          text: element.text,
          color: '#ffffff',
          backgroundColor:
            element.elementType === 'button'
              ? 'rgba(14,116,144,0.85)'
              : element.elementType === 'subtitle'
                ? 'rgba(15,23,42,0.82)'
                : 'rgba(30,41,59,0.74)',
          fontSize: element.elementType === 'subtitle' ? 28 : 32,
          opacity: 1,
          elementType: element.elementType,
          presetStyle: element.label,
          scale: 1,
        },
      },
    });
  };

  const addStockClipToTimeline = (clip: StockClip) => {
    const start = Math.min(project.duration, project.currentTime);
    const duration = Math.max(5, Math.min(clip.duration || 20, project.maxDuration));

    dispatch({
      type: 'ADD_SEGMENT',
      payload: {
        id: `seg-stock-${Date.now()}`,
        trackId: 'track-media',
        assetId: `asset-stock-${clip.id}`,
        startTime: start,
        duration,
        endTime: start + duration,
        layerIndex: 0,
        properties: {
          x: 50,
          y: 50,
          text: `Stock: ${clip.name}`,
          color: '#ffffff',
          opacity: 1,
          scale: 1,
          rotation: 0,
          objectFit: 'cover',
          mediaUrl: clip.url,
          mediaType: 'video',
          volume: 0.8,
          muted: false,
        },
      },
    });

    if (start + duration > project.duration) {
      dispatch({ type: 'SET_DURATION', payload: start + duration + 15 });
    }
  };

  const applyTransitionToSelected = (transition: 'fade' | 'slide-up' | 'zoom') => {
    if (!project.selectedSegmentId) {
      return false;
    }

    dispatch({
      type: 'UPDATE_SEGMENT',
      payload: {
        id: project.selectedSegmentId,
        updates: {
          properties: {
            transition,
          },
        },
      },
    });

    return true;
  };

  const addUploadedFilesToTimeline = (files: File[]) => {
    let inserted = 0;

    files.forEach((file, index) => {
      const isAudio = file.type.startsWith('audio/');
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      const mediaType = isAudio ? 'audio' : isVideo ? 'video' : isImage ? 'image' : 'video';
      const mediaUrl = URL.createObjectURL(file);
      const trackId = isAudio ? 'track-audio' : 'track-media';
      const start = Math.min(project.duration, project.currentTime + index * 2);
      const duration = isAudio ? 18 : isVideo ? 60 : 8;

      dispatch({
        type: 'ADD_SEGMENT',
        payload: {
          id: `seg-upload-${Date.now()}-${index}`,
          trackId,
          assetId: `local-${file.type}-${file.name}`,
          startTime: start,
          duration,
          endTime: start + duration,
          layerIndex: index,
          properties: {
            x: 50,
            y: isAudio ? 88 : 50,
            text: `${isAudio ? 'Audio' : 'Media'}: ${file.name}`,
            fontSize: isAudio ? 22 : 34,
            color: '#ffffff',
            opacity: 1,
            scale: 1,
            volume: 1,
            muted: false,
            rotation: 0,
            objectFit: 'contain',
            mediaUrl,
            mediaType,
          },
        },
      });

      if (start + duration > project.duration) {
        dispatch({ type: 'SET_DURATION', payload: start + duration + 15 });
      }

      inserted += 1;
    });

    return inserted;
  };

  const trackStudioEvent = async (eventName: string, payload: Record<string, unknown>) => {
    try {
      await fetch('/api/tracking/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventName,
          eventType: 'product_usage',
          path: '/dashboard/studio',
          payload,
        }),
      });
    } catch {
      // Tracking should never block product flow.
    }
  };

  const getCredits = useCallback(async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/users/credits', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const data = (await response.json()) as CreditBalance & { error?: string };
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo consultar saldo de creditos.');
    }

    return data;
  }, []);

  const generateAsset = async (brief: string, config: GenerationConfig) => {
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const prompt = safeBrief(brief);

      const response = await fetch('/api/ai/studio', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'ad-copy',
          prompt,
          offer: 'Nexora Studio',
          audience: 'equipos de ventas y marketing',
          channel: 'Instagram',
          tone: config.tone,
          format: config.format,
          platform: config.platform,
          duration: config.duration,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo generar el asset.');
      }

      const output = data.job?.output as AiOutputPayload;

      await trackStudioEvent('studio_v2_segment_created', {
        segments_added: output?.beats?.length || 1,
        credits_consumed: data.reused ? 0 : GENERATE_COST,
      });

      return {
        reused: Boolean(data.reused),
        creditsRemaining: data.usage?.creditsRemaining,
        output,
      };
    } finally {
      setLoading(false);
    }
  };

  const regeneratePreviewPart = async (
    brief: string,
    config: GenerationConfig,
    currentOutput: AiOutputPayload,
    target: 'hook' | 'conflict' | 'resolution' | 'cta'
  ) => {
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const prompt = safeBrief(brief);

      const response = await fetch('/api/ai/studio', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'ad-copy',
          prompt,
          offer: 'Nexora Studio',
          audience: 'equipos de ventas y marketing',
          channel: 'Instagram',
          tone: config.tone,
          format: config.format,
          platform: config.platform,
          duration: config.duration,
          regenerate: target,
          currentOutput,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo regenerar esa parte.');
      }

      await trackStudioEvent('studio_v2_segment_created', {
        segments_added: 1,
        credits_consumed: 5,
        regenerate_target: target,
      });

      return {
        creditsRemaining: data.usage?.creditsRemaining,
        output: data.job?.output as AiOutputPayload,
      };
    } finally {
      setLoading(false);
    }
  };

  const commitOutputToCanvas = (output: AiOutputPayload) => {
    const beats = output.beats?.length
      ? output.beats
      : [
          {
            id: 'hook',
            label: 'HOOK',
            timeLabel: '0-4s',
            startSec: 0,
            endSec: 4,
            text: output.headline,
            visual: output.angle,
          },
        ];

    beats.forEach((beat, index) => {
      const start = Math.min(project.duration, project.currentTime + beat.startSec);
      const duration = Math.max(2, beat.endSec - beat.startSec);

      dispatch({
        type: 'ADD_SEGMENT',
        payload: {
          id: `seg-${Date.now()}-${index}`,
          trackId: 'track-overlay',
          assetId: `asset-text-${Date.now()}-${index}`,
          startTime: start,
          duration,
          endTime: start + duration,
          layerIndex: index,
          properties: {
            x: 50,
            y: 18 + index * 16,
            text: beat.text,
            fontSize: beat.id === 'hook' ? 58 : 42,
            color: '#ffffff',
            opacity: 1,
          },
        },
      });
    });
  };

  const createProjectSnapshot = async () => {
    const token = localStorage.getItem('token');

    const response = await fetch('/api/ai/studio/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: project.name,
        prompt: 'Snapshot timeline nexora-studio',
        outputFormat: 'vertical 9:16',
        captionStyle: 'bold clean',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo crear el proyecto.');
    }

    return data.project;
  };

  const renderProject = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/ai/studio/render', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'timeline-to-video',
        prompt: `Render del proyecto ${project.name} con ${project.tracks.reduce((acc, track) => acc + track.segments.length, 0)} segmentos.`,
        outputFormat: 'vertical 9:16',
        captionStyle: 'bold clean',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo iniciar el render.');
    }

    await trackStudioEvent('studio_v2_render_initiated', {
      credits_consumed: 0,
      segments_in_timeline: project.tracks.reduce((acc, track) => acc + track.segments.length, 0),
    });

    return data;
  };

  return {
    generateAsset,
    createProjectSnapshot,
    renderProject,
    getCredits,
    commitOutputToCanvas,
    regeneratePreviewPart,
    addUploadedFilesToTimeline,
    addAudioTrackToTimeline,
    addAvatarToTimeline,
    addElementToTimeline,
    addStockClipToTimeline,
    applyTransitionToSelected,
    addTextToTimeline,
    addAudioMarkerToTimeline,
    addMusicPresetToTimeline,
    generateCost: GENERATE_COST,
    loading,
  };
}

export type AssetType = 'text' | 'image' | 'video' | 'audio' | 'avatar' | 'sticker' | 'lower-third';
export type TrackType = 'overlay' | 'media' | 'audio';

export interface SegmentProperties {
  x: number;
  y: number;
  text?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  opacity: number;
  scale?: number;
  volume?: number;
  muted?: boolean;
  rotation?: number;
  objectFit?: 'contain' | 'cover';
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'avatar';
  elementType?: 'sticker' | 'lower-third' | 'button' | 'subtitle';
  presetStyle?: string;
  title?: string;
  transition?: 'fade' | 'slide-up' | 'zoom';
}

export interface Segment {
  id: string;
  trackId: string;
  assetId: string;
  startTime: number;
  duration: number;
  endTime: number;
  layerIndex: number;
  properties: SegmentProperties;
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  segments: Segment[];
}

export interface StudioProject {
  id: string;
  name: string;
  duration: number;
  maxDuration: number;
  currentTime: number;
  zoom: number;
  viewStart: number;
  viewEnd: number;
  canvas: {
    width: number;
    height: number;
  };
  tracks: Track[];
  selectedSegmentId: string | null;
}

export interface AiGeneratedSegment {
  id: string;
  text: string;
  duration: number;
}

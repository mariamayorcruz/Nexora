export interface FreeLibraryTrack {
  id: string;
  name: string;
  url: string;
  duration: number;
  mood: string;
  license: string;
  source: string;
  tags: string[];
}

// Curated free tracks (royalty-free sources with no API key requirement).
export const FREE_MUSIC_LIBRARY: FreeLibraryTrack[] = [
  {
    id: 'pixabay-1',
    name: 'Corporate Technology',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8f668cf6f0.mp3?filename=corporate-technology-11211.mp3',
    duration: 118,
    mood: 'corporate',
    license: 'Pixabay Free',
    source: 'Pixabay',
    tags: ['trending', 'commercial', 'upbeat'],
  },
  {
    id: 'pixabay-2',
    name: 'Inspiring Ambient',
    url: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_9464f7793f.mp3?filename=inspiring-ambient-116199.mp3',
    duration: 152,
    mood: 'ambient',
    license: 'Pixabay Free',
    source: 'Pixabay',
    tags: ['calm', 'story', 'background'],
  },
  {
    id: 'pixabay-3',
    name: 'Lo-Fi Study Beat',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/02/audio_0f8a8ec5ef.mp3?filename=lofi-study-112191.mp3',
    duration: 180,
    mood: 'lofi',
    license: 'Pixabay Free',
    source: 'Pixabay',
    tags: ['lofi', 'chill', 'creator'],
  },
  {
    id: 'pixabay-4',
    name: 'Cinematic Trailer',
    url: 'https://cdn.pixabay.com/download/audio/2022/11/22/audio_1dbe95d95f.mp3?filename=cinematic-trailer-127589.mp3',
    duration: 96,
    mood: 'cinematic',
    license: 'Pixabay Free',
    source: 'Pixabay',
    tags: ['epic', 'promo', 'ads'],
  },
  {
    id: 'pixabay-5',
    name: 'Upbeat Fashion Pop',
    url: 'https://cdn.pixabay.com/download/audio/2021/12/22/audio_a8b3415230.mp3?filename=fashion-pop-11693.mp3',
    duration: 125,
    mood: 'upbeat',
    license: 'Pixabay Free',
    source: 'Pixabay',
    tags: ['fashion', 'instagram', 'trending'],
  },
  {
    id: 'pixabay-6',
    name: 'Future Bass Promo',
    url: 'https://cdn.pixabay.com/download/audio/2023/01/27/audio_9ac5bc9915.mp3?filename=future-bass-139362.mp3',
    duration: 101,
    mood: 'electronic',
    license: 'Pixabay Free',
    source: 'Pixabay',
    tags: ['edm', 'reels', 'shorts'],
  },
  {
    id: 'pixabay-7',
    name: 'Acoustic Motivation',
    url: 'https://cdn.pixabay.com/download/audio/2021/10/20/audio_c2cf40f9f8.mp3?filename=acoustic-motivation-3405.mp3',
    duration: 134,
    mood: 'acoustic',
    license: 'Pixabay Free',
    source: 'Pixabay',
    tags: ['warm', 'human', 'storytelling'],
  },
  {
    id: 'pixabay-8',
    name: 'Modern Hip Hop',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/22/audio_0f62be5285.mp3?filename=modern-hip-hop-11254.mp3',
    duration: 129,
    mood: 'hiphop',
    license: 'Pixabay Free',
    source: 'Pixabay',
    tags: ['urban', 'tiktok', 'creator'],
  },
];

export function searchFreeLibrary(query: string) {
  const value = query.trim().toLowerCase();
  if (!value) {
    return FREE_MUSIC_LIBRARY;
  }

  return FREE_MUSIC_LIBRARY.filter((track) => {
    return (
      track.name.toLowerCase().includes(value) ||
      track.mood.toLowerCase().includes(value) ||
      track.source.toLowerCase().includes(value) ||
      track.tags.some((tag) => tag.toLowerCase().includes(value))
    );
  });
}

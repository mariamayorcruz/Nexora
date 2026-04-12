'use client';

import type { ContentFormat, ContentPlatform, ContentTone, GenerationConfig } from '@/lib/ai-studio';

const TONES: Array<{ id: ContentTone; label: string; emoji: string; desc: string }> = [
  { id: 'viral-aggressive', label: 'Viral y desafiante', emoji: '🔥', desc: 'Frena el scroll con fricción y tensión.' },
  { id: 'gen-z-raw', label: 'Creator nativo', emoji: '📱', desc: 'Tono social-first, rápido y actual.' },
  { id: 'ceo-direct', label: 'CEO directo', emoji: '🎯', desc: 'Sin relleno, con presión de negocio.' },
  { id: 'story-relaxed', label: 'Storytelling', emoji: '☕', desc: 'Más humano, más conversación.' },
  { id: 'curiosity-gap', label: 'Curiosidad', emoji: '🧩', desc: 'Abre loops para retención.' },
  { id: 'pain-pleasure', label: 'Dolor a alivio', emoji: '⚡', desc: 'Contraste fuerte entre caos y control.' },
];

export function ToneSelector({
  config,
  onChange,
}: {
  config: GenerationConfig;
  onChange: (config: GenerationConfig) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Vibe</p>
        <div className="mt-2 space-y-2">
          {TONES.map((tone) => (
            <button
              key={tone.id}
              onClick={() => onChange({ ...config, tone: tone.id })}
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${
                config.tone === tone.id
                  ? 'border-cyan-400 bg-cyan-500/10 text-white'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="text-lg">{tone.emoji}</span>
              <span>
                <span className="block text-sm font-semibold">{tone.label}</span>
                <span className="block text-xs text-slate-400">{tone.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Formato</span>
          <select
            value={config.format}
            onChange={(event) => onChange({ ...config, format: event.target.value as ContentFormat })}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="hook-3s">Solo hook 0-3s</option>
            <option value="full-script">Guion completo</option>
            <option value="storyboard">Storyboard visual</option>
            <option value="caption-only">Caption only</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-slate-400">Plataforma</span>
          <select
            value={config.platform}
            onChange={(event) => onChange({ ...config, platform: event.target.value as ContentPlatform })}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="instagram-reels">Instagram Reels</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube-shorts">YouTube Shorts</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-slate-400">Duración</span>
          <select
            value={config.duration}
            onChange={(event) => onChange({ ...config, duration: Number(event.target.value) as GenerationConfig['duration'] })}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>
        </label>
      </div>
    </div>
  );
}

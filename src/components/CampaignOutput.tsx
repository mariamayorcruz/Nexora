'use client';

import Image from 'next/image';
import { Download, ImageIcon, RefreshCcw, Rocket, Sparkles } from 'lucide-react';
import { useState } from 'react';
import AdComposer from '@/components/AdComposer';

type ChannelCard = {
  key: string;
  label: string;
  color: string;
  copy: string;
  cta: string;
};

export default function CampaignOutput({
  title,
  status,
  creditsUsed,
  imageUrl,
  headline,
  hooks,
  channels,
  selectedHook,
  onSelectHook,
  onPublish,
  onPublishChannel,
  onRegenerate,
  language = 'es',
}: {
  title: string;
  status: string;
  creditsUsed: number;
  imageUrl?: string | null;
  headline?: string;
  hooks: string[];
  channels: ChannelCard[];
  selectedHook?: string | null;
  onSelectHook?: (hook: string) => void;
  onPublish?: () => void;
  onPublishChannel?: (channel: string, copy: string) => void;
  onRegenerate?: () => void;
  language?: string;
}) {
  const en = language === 'en';
  const [editingHeadline, setEditingHeadline] = useState(false);
  const [editedHeadline, setEditedHeadline] = useState('');

  return (
    <div className="flex min-h-[720px] flex-1 flex-col rounded-[24px] bg-[#040810] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Campaign output</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300">{status}</span>
          <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">{creditsUsed} {en ? 'credits' : 'créditos'}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[22px] bg-[#030610] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">{en ? 'Main visual' : 'Visual principal'}</p>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { labelKey: en ? 'Regenerate' : 'Regenerar', icon: RefreshCcw, onClick: onRegenerate, isRegen: true },
                {
                  labelKey: en ? 'Edit' : 'Editar',
                  icon: Sparkles,
                  onClick: () => {
                    setEditedHeadline(headline || title);
                    setEditingHeadline(true);
                  },
                  isRegen: false,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.labelKey}
                    type="button"
                    onClick={item.onClick}
                    disabled={item.isRegen && !onRegenerate}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-300 transition-all duration-150 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.labelKey}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  if (!imageUrl || imageUrl.startsWith('__gemini_description__')) return;
                  const link = document.createElement('a');
                  link.href = imageUrl;
                  link.download = 'nexora-campaign-image.jpg';
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-300 transition-all duration-150 hover:bg-white/[0.06] hover:text-white"
              >
                <Download className="h-3.5 w-3.5" />
                {en ? 'Download' : 'Descargar'}
              </button>
            </div>
          </div>
          {editingHeadline && (
            <div className="mt-3 flex gap-2">
              <input
                value={editedHeadline}
                onChange={(e) => setEditedHeadline(e.target.value)}
                className="flex-1 rounded-xl border border-cyan-500/30 bg-[#040810] px-3 py-2 text-sm text-white outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  onSelectHook?.(editedHeadline);
                  setEditingHeadline(false);
                }}
                className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-400"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => setEditingHeadline(false)}
                className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}
          {imageUrl ? (
            imageUrl.startsWith('__gemini_description__') ? (
              (() => {
                try {
                  const desc = JSON.parse(imageUrl.replace('__gemini_description__', '')) as {
                    description?: string;
                    style?: string;
                    colors?: string;
                    mood?: string;
                  };
                  return (
                    <div className="mt-4 flex aspect-[4/5] min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-[#040810] to-[#061220] p-6 text-center">
                      <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-cyan-300">✦ Visión de campaña</p>
                      <p className="text-sm leading-6 text-slate-300">{desc.description}</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-3">
                        {desc.style ? <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[10px] text-slate-400">{desc.style}</span> : null}
                        {desc.colors ? <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[10px] text-slate-400">{desc.colors}</span> : null}
                        {desc.mood ? <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[10px] text-slate-400">{desc.mood}</span> : null}
                      </div>
                      <p className="mt-4 text-[11px] text-slate-600">{en ? 'Enable fal.ai to generate a real image →' : 'Activa fal.ai para generar imagen real →'}</p>
                    </div>
                  );
                } catch {
                  return null;
                }
              })()
            ) : (
              <Image
                src={imageUrl}
                alt=""
                width={1200}
                height={1500}
                unoptimized
                className="mt-4 aspect-[4/5] w-full overflow-hidden rounded-[22px] object-cover"
              />
            )
          ) : (
            <div className="mt-4 flex aspect-[4/5] min-h-[280px] flex-col items-center justify-center gap-3 overflow-hidden rounded-[22px] bg-white/[0.03]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                <ImageIcon className="h-6 w-6" />
              </div>
              <p className="text-sm text-slate-400">{en ? 'Your visual will appear here after generating.' : 'Tu visual aparecerá aquí cuando generes la campaña.'}</p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-[22px] bg-[#030610] p-4">
            <p className="text-sm font-medium text-white">{en ? 'Hooks A / B / C' : 'Hooks A / B / C'}</p>
            <div className="mt-4 grid gap-3">
              {hooks.map((hook, index) => (
                <div key={`${hook}-${index}`} className="rounded-[18px] bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{String.fromCharCode(65 + index)}</p>
                      <p className="mt-2 text-sm leading-6 text-white">{hook}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectHook?.(hook)}
                      className={`rounded-full px-3 py-1.5 text-[11px] transition-all duration-150 ${
                        selectedHook === hook
                          ? 'bg-cyan-500 text-white'
                          : 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                      }`}
                    >
                      {selectedHook === hook ? (en ? '✓ Using' : '✓ Usando') : (en ? 'Use' : 'Usar')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] bg-[#030610] p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-white">{en ? 'Copies by channel' : 'Copies por canal'}</p>
              <button
                type="button"
                onClick={onPublish}
                disabled={!onPublish}
                className="flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Rocket className="h-3.5 w-3.5" />
                {en ? 'Publish all' : 'Publicar todo'}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {channels.map((channel) => (
                <div key={channel.key} className="rounded-[18px] bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                      style={{ backgroundColor: `${channel.color}18`, color: channel.color }}
                    >
                      {channel.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onPublishChannel?.(channel.key, channel.copy)}
                      className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px]"
                      style={{ backgroundColor: channel.color, color: '#041018' }}
                    >
                      {en ? 'Publish' : 'Publicar'}
                    </button>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white">
                    {(channel.copy || '')
                      .replace(/Â·/g, '·')
                      .replace(/—/g, '—')
                      .replace(/✨/g, '')
                      .replace(/Campaign Assembly Engine[^.]*[\.\s]*/gi, '')
                      .replace(/·\s*(Corporativo|Premium|Cercano|Urgente)\s*/gi, '')
                      .trim()}
                  </p>
                  <p className="mt-4 text-xs text-slate-500">{channel.cta}</p>
                </div>
              ))}
            </div>
          </div>

          {imageUrl && !imageUrl.startsWith('__gemini_description__') && (
            <div className="rounded-[22px] bg-[#030610] p-4">
              <p className="mb-4 text-sm font-medium text-white">✦ {en ? 'Branded ad previews' : 'Ads con branding aplicado'}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdComposer
                  imageUrl={imageUrl}
                  headline={headline || title}
                  subline={en ? 'No contracts · After hours · 15% off' : 'Sin contratos · After hours · 15% descuento'}
                  cta={en ? 'Free quote →' : 'Cotización gratis →'}
                  brand={{
                    primaryColor: '#2AAFB0',
                    secondaryColor: '#3D4F5E',
                    accentColor: '#8B7D35',
                    terracottaColor: '#B85C38',
                    businessName: 'Nexora',
                  }}
                  format="square"
                />
                <AdComposer
                  imageUrl={imageUrl}
                  headline={headline || title}
                  subline={en ? 'No contracts · After hours · 15% off' : 'Sin contratos · After hours · 15% descuento'}
                  cta={en ? 'Free quote →' : 'Cotización gratis →'}
                  brand={{
                    primaryColor: '#2AAFB0',
                    secondaryColor: '#3D4F5E',
                    accentColor: '#8B7D35',
                    terracottaColor: '#B85C38',
                    businessName: 'Nexora',
                  }}
                  format="story"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-[22px] bg-[rgba(6,182,212,0.06)] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300">
              <Rocket className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-medium text-white">{en ? 'Publish bar' : 'Barra de publicación'}</p>
              <p className="text-xs text-slate-400">{en ? 'Ready to launch on all selected channels.' : 'Lista para lanzar en todos los canales seleccionados.'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onPublish}
            disabled={!onPublish}
            className="rounded-full border border-white/[0.06] px-4 py-2 text-sm text-cyan-300 transition-all duration-150 hover:bg-white/[0.04] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {en ? 'Publish all ->' : 'Publicar todo ->'}
          </button>
        </div>
      </div>
    </div>
  );
}

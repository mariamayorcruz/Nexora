'use client';

import { ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export type AdPreviewVariant = 'feed' | 'story';

export type AdPreviewCardProps = {
  imageUrl: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  platform: 'facebook' | 'instagram';
  variant?: AdPreviewVariant;
};

const META_BLUE = 'bg-[#1877F2] hover:bg-[#166FE5] dark:bg-[#1877F2] dark:hover:bg-[#3b8df5]';

function PlatformBadge({ platform }: { platform: AdPreviewCardProps['platform'] }) {
  const isInstagram = platform === 'instagram';

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-2.5 dark:border-white/10">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
            isInstagram
              ? 'bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888]'
              : 'bg-[#1877F2]'
          }`}
          aria-hidden
        >
          {isInstagram ? 'IG' : 'f'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
            {isInstagram ? 'Instagram' : 'Facebook'}
          </p>
          <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">Sponsored · Ad preview</p>
        </div>
      </div>
      <span className="shrink-0 text-[11px] font-medium text-slate-400 dark:text-slate-500">···</span>
    </div>
  );
}

function CreativePlaceholder({ variant }: { variant: AdPreviewVariant }) {
  return (
    <div
      className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-200/90 to-slate-300/80 px-4 text-center dark:from-slate-700/80 dark:to-slate-800/90"
      role="img"
      aria-label="No creative image"
    >
      <ImageIcon className="h-10 w-10 text-slate-400 dark:text-slate-500" strokeWidth={1.25} aria-hidden />
      <p className="max-w-[200px] text-[12px] font-medium leading-snug text-slate-500 dark:text-slate-400">
        {variant === 'story' ? 'Add a vertical image URL' : 'Add an image URL or check the link'}
      </p>
    </div>
  );
}

export function AdPreviewCard({
  imageUrl,
  primaryText,
  headline,
  description,
  cta,
  platform,
  variant = 'feed',
}: AdPreviewCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const trimmedUrl = imageUrl.trim();
  const showImage = Boolean(trimmedUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [trimmedUrl]);

  const variantLabel = variant === 'story' ? 'Story' : 'Feed';

  const creative = showImage ? (
    /* eslint-disable-next-line @next/next/no-img-element -- arbitrary preview URLs in production tool */
    <img
      src={trimmedUrl}
      alt={headline.trim() || 'Ad creative'}
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setImageFailed(true)}
    />
  ) : (
    <CreativePlaceholder variant={variant} />
  );

  return (
    <article
      className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[#242526] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.35)]"
      aria-label={`${platform === 'instagram' ? 'Instagram' : 'Facebook'} ${variantLabel} ad preview`}
    >
      <PlatformBadge platform={platform} />

      {variant === 'feed' ? (
        <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-black/40">{creative}</div>
      ) : (
        <div className="px-2 pt-2">
          <div className="mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-lg bg-slate-100 dark:bg-black/40">
            {creative}
          </div>
        </div>
      )}

      <div className="space-y-2 px-3 pb-3 pt-2.5">
        <p
          className="line-clamp-4 text-[13px] leading-snug text-slate-800 dark:text-slate-200"
          title={primaryText.trim() ? primaryText : undefined}
        >
          {primaryText.trim() || '\u00A0'}
        </p>

        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-white/5 dark:bg-black/25">
          <p
            className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-50"
            title={headline.trim() ? headline : undefined}
          >
            {headline.trim() || '\u00A0'}
          </p>
          <p
            className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400"
            title={description.trim() ? description : undefined}
          >
            {description.trim() || '\u00A0'}
          </p>
          <button
            type="button"
            className={`mt-3 w-full truncate rounded-md px-3 py-2 text-center text-[13px] font-semibold text-white shadow-sm transition-colors ${META_BLUE}`}
            title={cta.trim() ? cta : undefined}
          >
            {cta.trim() || 'Learn more'}
          </button>
        </div>
      </div>
    </article>
  );
}

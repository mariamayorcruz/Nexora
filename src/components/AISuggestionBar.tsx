'use client';

import { Sparkles } from 'lucide-react';

export default function AISuggestionBar({
  suggestion,
  actionLabel,
  onUse,
  compact = false,
}: {
  suggestion: string;
  actionLabel?: string;
  onUse?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-start justify-between gap-3 rounded-2xl border border-white/5 bg-[rgba(6,182,212,0.05)] sm:flex-row sm:items-center ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      } transition-all duration-150`}
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(6,182,212,0.12)] text-cyan-400">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className={`min-w-0 text-slate-200 ${compact ? 'text-xs leading-5' : 'text-sm leading-6'}`}>{suggestion}</p>
      </div>
      {onUse ? (
        <button
          type="button"
          onClick={onUse}
          className="shrink-0 rounded-full border border-white/5 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all duration-150 hover:bg-white/5 hover:text-white"
        >
          {actionLabel || 'Usar ->'}
        </button>
      ) : null}
    </div>
  );
}

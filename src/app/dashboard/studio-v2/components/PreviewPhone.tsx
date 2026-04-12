'use client';

import type { AiOutputPayload } from '@/lib/ai-studio';

export function PreviewPhone({ output }: { output: AiOutputPayload | null }) {
  const hook = output?.beats?.[0];

  return (
    <div className="mx-auto w-[260px] rounded-[2rem] border-[10px] border-slate-700 bg-slate-800 p-2 shadow-xl">
      <div className="relative h-[500px] overflow-hidden rounded-[1.5rem] bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.1),rgba(0,0,0,0.9))]" />
        <div className="absolute inset-x-0 top-3 mx-auto h-5 w-28 rounded-full bg-slate-900" />

        <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 text-center">
          <p className="text-2xl font-black leading-tight text-white drop-shadow-lg">
            {hook?.text || 'Tu preview social aparece aquí'}
          </p>
        </div>

        <div className="absolute inset-x-4 bottom-20 rounded-xl bg-black/50 p-3 backdrop-blur">
          <p className="text-xs text-white/90">{hook?.visual || 'Selecciona tono y genera para ver visual + hook.'}</p>
        </div>

        <div className="absolute bottom-4 right-3 flex flex-col gap-3">
          <div className="h-9 w-9 rounded-full bg-white/20" />
          <div className="h-9 w-9 rounded-full bg-white/20" />
        </div>
      </div>
    </div>
  );
}

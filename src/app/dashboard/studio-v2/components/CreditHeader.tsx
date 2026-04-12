'use client';

type CreditBalance = {
  available: number;
  used: number;
  plan: number;
  expires: string;
};

export function CreditHeader({
  credits,
  loadingCredits,
}: {
  credits: CreditBalance | null;
  loadingCredits: boolean;
}) {
  const available = credits?.available ?? 0;
  const status = available < 100 ? 'critical' : available < 500 ? 'low' : 'ok';

  const badgeTone =
    status === 'critical'
      ? 'border-red-400/40 bg-red-500/10 text-red-300'
      : status === 'low'
      ? 'border-amber-400/40 bg-amber-500/10 text-amber-300'
      : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300';

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 via-cyan-500 to-blue-600 text-xs font-black text-slate-900">
          NX
        </div>
        <p className="text-sm font-semibold text-white">Nexora Studio</p>
      </div>

      <div className="flex items-center gap-4">
        <div className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${badgeTone}`}>
          {loadingCredits ? 'Cargando créditos...' : `${available.toLocaleString()} créditos`}
        </div>
        <div className="h-8 w-8 rounded-full bg-slate-700" />
      </div>
    </header>
  );
}

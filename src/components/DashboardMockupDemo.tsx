'use client';

import { useEffect, useState } from 'react';

const lines = [
  { label: 'HOOK', text: 'Si sigues asi, tu competencia te come el mercado.', delay: 500 },
  { label: 'CONFLICT', text: 'El 78% de negocios como el tuyo pierde leads por falta de seguimiento automatico.', delay: 2000 },
  { label: 'SOLUTION', text: 'Nexora convierte cada lead en una conversacion — sin que muevas un dedo.', delay: 4000 },
  { label: 'CTA', text: 'Empieza hoy. Tus primeros 3 clientes en 30 dias o te devolvemos el dinero.', delay: 6000 },
];

const channels = ['Instagram', 'WhatsApp', 'Email', 'Landing'];

function TypeWriter({ text, active }: { text: string; active: boolean }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!active) { setDisplayed(''); return; }
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, 28);
    return () => clearInterval(timer);
  }, [active, text]);

  return <span>{displayed}{active && displayed.length < text.length && <span className="animate-pulse">|</span>}</span>;
}

export default function DashboardMockupDemo() {
  const [activeLines, setActiveLines] = useState<number[]>([]);
  const [credits, setCredits] = useState(1240);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('Instagram');

  const handleGenerate = () => {
    if (generating || done) return;
    setGenerating(true);
    setCredits((c) => c - 45);

    lines.forEach((line, i) => {
      setTimeout(() => {
        setActiveLines((prev) => [...prev, i]);
        if (i === lines.length - 1) {
          setTimeout(() => { setGenerating(false); setDone(true); }, 2000);
        }
      }, line.delay);
    });
  };

  const handleReset = () => {
    setActiveLines([]);
    setGenerating(false);
    setDone(false);
    setCredits(1240);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/6 bg-[#080e1a]" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 text-xs font-bold text-slate-900">NX</div>
          <span className="text-sm font-semibold text-white">Nexora Studio</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">{credits.toLocaleString()} credits</span>
          {generating && <span className="flex items-center gap-1 text-[10px] text-cyan-400"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />Generating...</span>}
          {done && <span className="text-[10px] text-emerald-400">Done</span>}
        </div>
      </div>

      {/* Form */}
      <div className="border-b border-white/6 p-4">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[9px] uppercase tracking-wider text-slate-400">Offer</p>
            <div className="rounded-lg border border-white/8 bg-slate-800/50 px-3 py-2 text-xs text-white">CRM + AI for your business</div>
          </div>
          <div>
            <p className="mb-1 text-[9px] uppercase tracking-wider text-slate-400">Audience</p>
            <div className="rounded-lg border border-white/8 bg-slate-800/50 px-3 py-2 text-xs text-white">SMBs and agencies</div>
          </div>
        </div>

        <div className="mb-3">
          <p className="mb-1 text-[9px] uppercase tracking-wider text-slate-400">Channel</p>
          <div className="flex gap-2">
            {channels.map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${
                  selectedChannel === ch
                    ? 'border border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
                    : 'border border-white/8 text-slate-400 hover:text-white'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={done ? handleReset : handleGenerate}
          disabled={generating}
          className={`w-full rounded-xl py-2.5 text-xs font-semibold transition ${
            done
              ? 'border border-white/10 text-slate-300 hover:border-cyan-400/30 hover:text-white'
              : generating
              ? 'border border-white/6 text-slate-500 cursor-not-allowed'
              : 'border border-white/10 text-slate-200 hover:border-cyan-400/30 hover:text-white'
          }`}
        >
          {done ? 'Generate another →' : generating ? 'Generating with AI...' : `Generate UGC Script — 45 credits`}
        </button>
      </div>

      {/* Output */}
      <div className="p-4">
        <p className="mb-3 text-[9px] uppercase tracking-wider text-slate-400">Output — {selectedChannel}</p>

        {activeLines.length === 0 && !generating && (
          <div className="rounded-xl border border-white/6 bg-slate-900/50 p-4 text-center">
            <p className="text-xs text-slate-500">Your AI-generated script will appear here.</p>
            <p className="mt-1 text-[10px] text-slate-600">Hook · Conflict · Solution · CTA</p>
          </div>
        )}

        <div className="space-y-2">
          {lines.map((line, i) => (
            activeLines.includes(i) && (
              <div key={line.label} className="rounded-xl border border-white/6 bg-slate-900 p-3">
                <p className="mb-1 text-[9px] uppercase tracking-wider text-cyan-400">{line.label}</p>
                <p className="text-xs leading-relaxed text-white/80">
                  <TypeWriter text={line.text} active={activeLines.includes(i)} />
                </p>
              </div>
            )
          ))}
        </div>

        {done && (
          <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
            <p className="text-[10px] text-emerald-400">Script saved to your library. 45 credits used.</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface AiUsageData {
  totalJobs: number;
  jobsThisMonth: number;
  creditsUsedThisMonth: number;
  topTool: string;
  topUser: string;
  jobsByTool: Array<{ tool: string; count: number; credits: number }>;
  recentJobs: Array<{
    id: string;
    tool: string;
    user: string;
    creditsUsed: number;
    createdAt: string;
  }>;
}

export default function AdminStudioPage() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    void fetch('/api/admin/ai-usage', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => setData(json.usage || null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-b-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-rose-300">✦ Admin · Uso IA</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white">
          Uso de Inteligencia Artificial
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Groq · Gemini · Créditos consumidos por todos los clientes de Nexora.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Jobs totales', value: data?.totalJobs || 0, color: 'text-white' },
          { label: 'Jobs este mes', value: data?.jobsThisMonth || 0, color: 'text-cyan-400' },
          { label: 'Créditos usados (mes)', value: data?.creditsUsedThisMonth || 0, color: 'text-amber-400' },
          { label: 'Herramienta top', value: data?.topTool || 'ad-copy', color: 'text-emerald-400' },
        ].map((item) => (
          <div key={item.label} className="rounded-[20px] bg-[#040810] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className={`mt-3 text-2xl font-bold tracking-[-0.03em] ${item.color}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[20px] bg-[#040810] p-5">
          <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Uso por herramienta
          </p>
          {data?.jobsByTool?.length ? (
            <div className="space-y-3">
              {data.jobsByTool.map((item) => (
                <div key={item.tool} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-cyan-400" />
                    <span className="text-sm text-slate-300">{item.tool}</span>
                  </div>
                  <div className="flex gap-4 text-right">
                    <span className="text-sm text-white">{item.count} jobs</span>
                    <span className="text-sm text-slate-500">{item.credits} cr</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Sin datos aún.</p>
          )}
        </div>

        <div className="rounded-[20px] bg-[#040810] p-5">
          <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Jobs recientes
          </p>
          {data?.recentJobs?.length ? (
            <div className="space-y-3">
              {data.recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between border-b border-white/[0.04] pb-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{job.tool}</p>
                    <p className="text-xs text-slate-500">{job.user}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-cyan-400">{job.creditsUsed} cr</p>
                    <p className="text-xs text-slate-600">
                      {new Date(job.createdAt).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Sin jobs recientes.</p>
          )}
        </div>
      </div>
    </div>
  );
}

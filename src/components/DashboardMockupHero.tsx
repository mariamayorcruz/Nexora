export default function DashboardMockupHero() {
  const leads = [
    { name: 'Ana Torres', company: 'Florist Studio', status: 'New', statusColor: '#1e3a5f', statusText: '#60a5fa' },
    { name: 'Carlos Ruiz', company: 'Digital Agency', status: 'Qualified', statusColor: '#1a3a2a', statusText: '#34d399' },
    { name: 'Sofia Mendez', company: 'E-commerce', status: 'Proposal', statusColor: '#3a2a1a', statusText: '#fbbf24' },
    { name: 'James Kim', company: 'SaaS Startup', status: 'Closed', statusColor: '#1a3a2a', statusText: '#34d399' },
  ];

  const metrics = [
    { label: 'Total leads', value: '142', change: '+12%' },
    { label: 'Campaigns', value: '3', change: 'active' },
    { label: 'AI credits', value: '1,240', change: 'remaining' },
    { label: 'Pipeline', value: '$8,400', change: '+$1.2k' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/6 bg-[#080e1a]" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 text-xs font-bold text-slate-900">NX</div>
          <span className="text-sm font-semibold text-white">Nexora</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">● Live</span>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] font-semibold text-cyan-300">MA</div>
        </div>
      </div>

      <div className="border-b border-white/6 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-white/30">Monday, April 21</p>
        <h1 className="text-base font-bold text-white">Good morning, Maria</h1>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-white/6 bg-slate-900 p-3">
            <p className="text-[9px] uppercase tracking-wider text-white/40">{m.label}</p>
            <p className="mt-1 text-base font-bold text-white">{m.value}</p>
            <p className="text-[10px] text-emerald-400">{m.change}</p>
          </div>
        ))}
      </div>

      <div className="mx-3 mb-3 rounded-xl border border-white/6 bg-slate-900 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-white">Recent leads</p>
          <span className="text-[10px] text-cyan-400">View all →</span>
        </div>
        {leads.map((lead) => (
          <div key={lead.name} className="flex items-center justify-between border-b border-white/4 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-[9px] font-semibold text-cyan-300">
                {lead.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <p className="text-xs text-white">{lead.name}</p>
                <p className="hidden text-[10px] text-white/30 sm:block">{lead.company}</p>
              </div>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: lead.statusColor, color: lead.statusText }}>
              {lead.status}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-3 mb-3 rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-3">
        <p className="mb-1 text-[9px] uppercase tracking-wider text-cyan-400">AI Studio — last output · Instagram</p>
        <p className="text-xs leading-relaxed text-white/80">&quot;Si sigues así, tu competencia te come el mercado.&quot;</p>
        <p className="mt-1 text-[10px] text-white/30">20 credits · 2 min ago</p>
      </div>
    </div>
  );
}

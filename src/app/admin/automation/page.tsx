'use client';

import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

type AdminAlert = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
};

type AutomationPlay = {
  id: string;
  title: string;
  summary: string;
  trigger: string;
  action: string;
  cadence: string;
  priority: 'high' | 'medium' | 'low';
};

type AutomationConfig = {
  aiAssistantEnabled: boolean;
  lifecycleAutomationEnabled: boolean;
  whatsappEnabled: boolean;
  phoneRoutingEnabled: boolean;
  crmSyncEnabled: boolean;
  escalationEnabled: boolean;
  notes: string;
};

type FunnelAttribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  landingPath: string | null;
};

type FunnelConversionRow = {
  email: string;
  source: string | null;
  resource: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  convertedToPaidAt: string | null;
  attribution?: FunnelAttribution | null;
};

function utmCell(row: FunnelConversionRow) {
  const a = row.attribution;
  if (!a) return '—';
  const parts = [a.utmSource, a.utmMedium, a.utmCampaign].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

function dash(s: string | null | undefined, max = 48) {
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function AutomationWorkflowPage() {
  const [data, setData] = useState<{ alerts: AdminAlert[]; plays: AutomationPlay[]; queuePreview: string[]; config: AutomationConfig } | null>(null);
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [funnelWon, setFunnelWon] = useState<number | null>(null);
  const [funnelConversions, setFunnelConversions] = useState<FunnelConversionRow[]>([]);
  const [conversionDetailOpen, setConversionDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const ac = new AbortController();

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')?.trim();
        if (!token) {
          console.warn('[admin/stats debug automation] no token in localStorage');
          return;
        }

        const auth = { Authorization: `Bearer ${token}` };
        const [autoRes, statsRes] = await Promise.all([
          fetch('/api/admin/automation', { headers: auth, cache: 'no-store', signal: ac.signal }),
          fetch('/api/admin/stats', { headers: auth, cache: 'no-store', signal: ac.signal }),
        ]);

        if (ac.signal.aborted) return;

        const payload = await autoRes.json();
        const statsData = await statsRes.json();

        if (ac.signal.aborted) return;

        setData(payload.automation || null);
        setConfig(payload.automation?.config || null);

        const statsAccepted =
          statsRes.ok &&
          statsData.stats != null &&
          typeof statsData.stats === 'object' &&
          !Array.isArray(statsData.stats);

        console.log('[admin/stats debug automation]', {
          httpStatus: statsRes.status,
          tokenPresent: Boolean(token),
          payloadKeys: statsData && typeof statsData === 'object' ? Object.keys(statsData) : [],
          hasStatsKey: Object.prototype.hasOwnProperty.call(statsData, 'stats'),
          statsType: statsData.stats === null ? 'null' : typeof statsData.stats,
          statsIsArray: Array.isArray(statsData.stats),
          statsAccepted,
        });

        if (statsAccepted) {
          const funnel = statsData.stats.funnel as { won?: number; conversions?: FunnelConversionRow[] } | undefined;
          if (funnel) {
            console.log('[admin/stats debug automation] setFunnelWon/setFunnelConversions applied', {
              won: funnel.won,
              conversionsLen: Array.isArray(funnel.conversions) ? funnel.conversions.length : 0,
            });
            setFunnelWon(typeof funnel.won === 'number' ? funnel.won : null);
            setFunnelConversions(Array.isArray(funnel.conversions) ? funnel.conversions : []);
          } else {
            setFunnelWon(null);
            setFunnelConversions([]);
          }
        } else {
          console.error('[admin/stats debug automation] stats rejected', statsRes.status, statsData?.error);
          setFunnelWon(null);
          setFunnelConversions([]);
        }
      } catch (error) {
        if (ac.signal.aborted) return;
        console.error('Error fetching automation center:', error);
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchData();
    return () => ac.abort();
  }, []);

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/automation', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });
      if (!response.ok) throw new Error('No se pudo guardar');
      setMessage('Automation guardada.');
    } catch (error) {
      console.error('Error saving automation center:', error);
      setMessage('No se pudo guardar la automatización.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-500">Cargando automation workflow...</div>;
  }

  if (!data || !config) {
    return <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-200">No pudimos cargar automation.</div>;
  }

  /** Misma fuente que la tabla: API garantiza won === conversions.length */
  const conversionCount = typeof funnelWon === 'number' ? funnelWon : funnelConversions.length;

  const steps = [
    { stage: 'Atracción', count: data.queuePreview.length * 12, automation: 'Welcome email + pixel tracking', interactive: false },
    { stage: 'Captación', count: data.plays.length * 4, automation: 'Lead magnet delivery', interactive: false },
    { stage: 'Calificación', count: data.alerts.length + 8, automation: 'CRM sync + score', interactive: false },
    {
      stage: 'Conversión',
      count: conversionCount,
      automation: 'Checkout + onboard',
      interactive: true as const,
    },
  ];

  const toggles: Array<{ key: keyof AutomationConfig; label: string }> = [
    { key: 'aiAssistantEnabled', label: 'Asistente IA' },
    { key: 'lifecycleAutomationEnabled', label: 'Lifecycle' },
    { key: 'whatsappEnabled', label: 'WhatsApp' },
    { key: 'phoneRoutingEnabled', label: 'Telefonía' },
    { key: 'crmSyncEnabled', label: 'CRM Sync' },
    { key: 'escalationEnabled', label: 'Escalado humano' },
  ];

  return (
    <div className="space-y-8 text-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Automation Workflow</h1>
          <p className="mt-1 text-sm text-slate-400">Funnel y reglas conectadas en una sola vista.</p>
        </div>
        <button onClick={saveConfig} disabled={saving} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60">
          {saving ? 'Guardando...' : 'Guardar reglas'}
        </button>
      </div>

      {message ? <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">{message}</div> : null}

      <section className="overflow-x-auto pb-4">
        <div className="flex min-w-max items-center gap-4">
          {steps.map((step, index) => (
            <div key={step.stage} className="flex items-center gap-4">
              <button
                type="button"
                disabled={!step.interactive}
                onClick={() => step.interactive && setConversionDetailOpen((open) => !open)}
                className={`w-48 rounded-xl border border-slate-700 bg-slate-900 p-4 text-left transition ${
                  step.interactive
                    ? 'cursor-pointer hover:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40'
                    : 'cursor-default opacity-95'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase text-slate-500">{step.stage}</span>
                  <span className="text-sm font-bold text-cyan-400">{step.count}</span>
                </div>
                <p className="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-400">Auto: {step.automation}</p>
                {step.interactive ? (
                  <p className="mt-1 text-[10px] text-cyan-500/80">Clic para ver conversiones (admin)</p>
                ) : null}
              </button>
              {index < steps.length - 1 ? <ArrowRight className="text-slate-600" size={20} /> : null}
            </div>
          ))}
        </div>
      </section>

      {conversionDetailOpen ? (
        <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Detalle de conversión (pagos / suscripción activa)</h2>
            <span className="text-xs text-slate-500">{funnelConversions.length} filas · vista admin</span>
          </div>
          {funnelConversions.length === 0 ? (
            <p className="text-sm text-slate-500">No hay filas en el embudo cerrado o aún no hay datos sincronizados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Source / recurso</th>
                    <th className="py-2 pr-3 font-medium">UTM</th>
                    <th className="py-2 pr-3 font-medium">Referrer</th>
                    <th className="py-2 pr-3 font-medium">Landing</th>
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 font-medium">Estado sub</th>
                    <th className="py-2 font-medium">Conversión / pago</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelConversions.map((row, i) => (
                    <tr key={`${row.email}-${i}`} className="border-b border-slate-800/80 text-slate-300">
                      <td className="py-2 pr-3 font-mono text-xs text-slate-200">{row.email}</td>
                      <td className="py-2 pr-3 text-xs">
                        {[row.source, row.resource].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-400">{utmCell(row)}</td>
                      <td className="max-w-[140px] py-2 pr-3 text-xs text-slate-400" title={row.attribution?.referrer || undefined}>
                        {dash(row.attribution?.referrer)}
                      </td>
                      <td className="max-w-[140px] py-2 pr-3 text-xs text-slate-400" title={row.attribution?.landingPath || undefined}>
                        {dash(row.attribution?.landingPath)}
                      </td>
                      <td className="py-2 pr-3 text-xs">{row.plan ?? '—'}</td>
                      <td className="py-2 pr-3 text-xs">{row.subscriptionStatus ?? '—'}</td>
                      <td className="py-2 text-xs text-slate-400">
                        {row.convertedToPaidAt
                          ? new Date(row.convertedToPaidAt).toLocaleString('es', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 font-semibold text-white">Reglas activas</h2>
          <div className="space-y-3">
            {data.plays.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <div className="flex items-center gap-4">
                  <div className={`h-2 w-2 rounded-full ${rule.priority === 'high' ? 'bg-emerald-400' : rule.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                  <div>
                    <p className="text-sm text-white">Si: <span className="text-cyan-400">{rule.trigger}</span></p>
                    <p className="text-xs text-slate-400">Entonces: {rule.action}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">{rule.cadence}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 font-semibold text-white">Switches operativos</h2>
          <div className="space-y-3">
            {toggles.map((toggle) => (
              <label key={toggle.key} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
                <span className="text-sm text-slate-300">{toggle.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(config[toggle.key])}
                  onChange={(event) => setConfig({ ...config, [toggle.key]: event.target.checked })}
                  className="h-4 w-4"
                />
              </label>
            ))}
            <textarea
              value={config.notes}
              onChange={(event) => setConfig({ ...config, notes: event.target.value })}
              className="min-h-[120px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              placeholder="Notas del workflow"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

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

export default function AutomationWorkflowPage() {
  const [data, setData] = useState<{ alerts: AdminAlert[]; plays: AutomationPlay[]; queuePreview: string[]; config: AutomationConfig } | null>(null);
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/automation', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const payload = await response.json();
        setData(payload.automation || null);
        setConfig(payload.automation?.config || null);
      } catch (error) {
        console.error('Error fetching automation center:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
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

  const steps = [
    { stage: 'Atracción', count: data.queuePreview.length * 12, automation: 'Welcome email + pixel tracking' },
    { stage: 'Captación', count: data.plays.length * 4, automation: 'Lead magnet delivery' },
    { stage: 'Calificación', count: data.alerts.length + 8, automation: 'CRM sync + score' },
    { stage: 'Conversión', count: Math.max(1, data.plays.length - 1), automation: 'Checkout + onboard' },
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
              <div className="w-48 rounded-xl border border-slate-700 bg-slate-900 p-4 transition hover:border-cyan-500/50">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase text-slate-500">{step.stage}</span>
                  <span className="text-sm font-bold text-cyan-400">{step.count}</span>
                </div>
                <p className="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-400">Auto: {step.automation}</p>
              </div>
              {index < steps.length - 1 ? <ArrowRight className="text-slate-600" size={20} /> : null}
            </div>
          ))}
        </div>
      </section>

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

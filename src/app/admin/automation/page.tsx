'use client';

import { useEffect, useState } from 'react';

interface AdminAlert {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}

interface AutomationPlay {
  id: string;
  title: string;
  summary: string;
  trigger: string;
  action: string;
  cadence: string;
  priority: 'high' | 'medium' | 'low';
}

interface AutomationConfig {
  aiAssistantEnabled: boolean;
  lifecycleAutomationEnabled: boolean;
  whatsappEnabled: boolean;
  phoneRoutingEnabled: boolean;
  crmSyncEnabled: boolean;
  escalationEnabled: boolean;
  notes: string;
}

export default function AdminAutomationPage() {
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
        });
        const payload = await response.json();
        setData(payload.automation);
        setConfig(payload.automation.config);
      } catch (error) {
        console.error('Error fetching automation center:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
      setMessage('Automatización guardada.');
    } catch (error) {
      console.error('Error saving automation center:', error);
      setMessage('No pudimos guardar la automatización.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center">Cargando automatización...</div>;
  }

  if (!data || !config) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">No pudimos cargar la automatización.</div>;
  }

  const toggles: Array<{ key: keyof AutomationConfig; label: string; help: string }> = [
    { key: 'aiAssistantEnabled', label: 'Asistente IA activo', help: 'Diagnóstico y ayuda inteligente dentro del producto.' },
    { key: 'lifecycleAutomationEnabled', label: 'Lifecycle automatizado', help: 'Secuencias por signup, trial, pago y retención.' },
    { key: 'whatsappEnabled', label: 'WhatsApp opcional', help: 'Seguimiento por WhatsApp si el cliente lo autoriza.' },
    { key: 'phoneRoutingEnabled', label: 'Telefonía opcional', help: 'Conexión con llamadas o routing comercial si el cliente lo elige.' },
    { key: 'crmSyncEnabled', label: 'Sync con CRM', help: 'Sincronización con pipeline comercial y equipo de ventas.' },
    { key: 'escalationEnabled', label: 'Escalado humano', help: 'Paso de IA a soporte humano cuando haga falta.' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Automation center</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Automatización inteligente para operación, soporte y cierre</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
            Esta capa convierte señales de campañas, pagos y lifecycle en acciones automatizadas. Aquí también puedes preparar WhatsApp, telefonía y escalado humano cuando el cliente lo permita.
          </p>
        </div>
        <button onClick={saveConfig} className="btn-primary" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar automatización'}
        </button>
      </div>

      {message && <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">{message}</div>}

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Queue preview</p>
          <div className="mt-6 space-y-3">
            {data.queuePreview.map((item) => (
              <div key={item} className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Configuración base</p>
          <div className="mt-6 space-y-4">
            {toggles.map((item) => (
              <label key={item.key} className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 p-4">
                <div>
                  <p className="font-semibold text-gray-900">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{item.help}</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(config[item.key])}
                  onChange={(event) => setConfig({ ...config, [item.key]: event.target.checked })}
                  className="mt-1 h-5 w-5"
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Notas estratégicas</span>
              <textarea
                value={config.notes}
                onChange={(event) => setConfig({ ...config, notes: event.target.value })}
                className="input-field min-h-[120px]"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Alertas activas</p>
          <div className="mt-6 space-y-4">
            {data.alerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-gray-900">{alert.title}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                      alert.severity === 'high'
                        ? 'bg-red-50 text-red-600'
                        : alert.severity === 'medium'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-600">{alert.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-1">
          {data.plays.map((play) => (
            <article key={play.id} className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-gray-900">{play.title}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    play.priority === 'high'
                      ? 'bg-red-50 text-red-600'
                      : play.priority === 'medium'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {play.priority}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600">{play.summary}</p>
              <div className="mt-5 space-y-3 text-sm text-gray-600">
                <p><span className="font-semibold text-gray-900">Trigger:</span> {play.trigger}</p>
                <p><span className="font-semibold text-gray-900">Acción:</span> {play.action}</p>
                <p><span className="font-semibold text-gray-900">Cadencia:</span> {play.cadence}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

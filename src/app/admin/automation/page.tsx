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

export default function AdminAutomationPage() {
  const [data, setData] = useState<{ alerts: AdminAlert[]; plays: AutomationPlay[]; queuePreview: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/automation', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        setData(payload.automation);
      } catch (error) {
        console.error('Error fetching automation center:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="py-12 text-center">Cargando automatizacion...</div>;
  }

  if (!data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">No pudimos cargar la automatizacion.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Automation center</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Automatizaciones inteligentes para operar mejor</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          Esta capa no solo reporta. También traduce señales de campañas, suscripciones y pagos en acciones que se pueden automatizar.
        </p>
      </div>

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
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
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
      </section>
    </div>
  );
}

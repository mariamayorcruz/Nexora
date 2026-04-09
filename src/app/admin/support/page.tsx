'use client';

import { useEffect, useState } from 'react';

interface SupportPlaybookCard {
  id: string;
  title: string;
  audience: string;
  trigger: string;
  goal: string;
  channel: string;
}

interface LifecycleCard {
  id: string;
  name: string;
  audience: string;
  trigger: string;
  subject: string;
  preview: string;
  cta?: string;
  replyTo?: string;
}

interface SupportData {
  queueSummary: {
    openTickets: number;
    aiResolvedRate: number;
    averageFirstResponse: string;
  };
  playbooks: SupportPlaybookCard[];
  lifecycle: LifecycleCard[];
  channels: string[];
  supportEmailReady: boolean;
  aiReady: boolean;
}

export default function AdminSupportPage() {
  const [data, setData] = useState<SupportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/support', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        setData(payload.support);
      } catch (error) {
        console.error('Error fetching support center:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="py-12 text-center">Cargando support center...</div>;
  }

  if (!data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">No pudimos cargar el support center.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Post-sale & support center</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Servicio post-venta, soporte IA y seguimiento del cliente</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          Este panel organiza lo que pasa después de vender: onboarding, postventa, ayuda técnica y seguimiento para retención.
        </p>
      </div>

      <section className="grid gap-5 md:grid-cols-4">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Tickets abiertos</p>
          <p className="mt-3 text-4xl font-semibold text-gray-900">{data.queueSummary.openTickets}</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Resolucion IA</p>
          <p className="mt-3 text-4xl font-semibold text-gray-900">{data.queueSummary.aiResolvedRate}%</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Primera respuesta</p>
          <p className="mt-3 text-4xl font-semibold text-gray-900">{data.queueSummary.averageFirstResponse}</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Canales</p>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{data.channels.length}</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Infraestructura</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-5 text-center">
              <p className="text-sm font-semibold text-gray-900">Asistente IA</p>
              <p className={`mt-3 text-sm font-semibold ${data.aiReady ? 'text-emerald-600' : 'text-gray-500'}`}>
                {data.aiReady ? 'Activo' : 'Pendiente'}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-5 text-center">
              <p className="text-sm font-semibold text-gray-900">Support email</p>
              <p className={`mt-3 text-sm font-semibold ${data.supportEmailReady ? 'text-emerald-600' : 'text-gray-500'}`}>
                {data.supportEmailReady ? 'Listo' : 'Pendiente'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Playbooks de post-venta</h2>
          <div className="mt-6 space-y-4">
            {data.playbooks.map((playbook) => (
              <div key={playbook.id} className="rounded-2xl bg-gray-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-gray-900">{playbook.title}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">{playbook.channel}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{playbook.audience}</p>
                <p className="mt-3 text-sm leading-6 text-gray-700">{playbook.goal}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-gray-400">Trigger: {playbook.trigger}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {data.lifecycle.map((template) => (
          <article key={template.id} className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-gray-400">{template.audience}</p>
                <h2 className="mt-2 text-xl font-semibold text-gray-900">{template.name}</h2>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">{template.trigger}</span>
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Subject</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">{template.subject}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Preview</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">{template.preview}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.22em] text-gray-400">
              {template.cta && <span>CTA: {template.cta}</span>}
              {template.replyTo && <span>Reply-to: {template.replyTo}</span>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface EmailTemplateCard {
  id: string;
  name: string;
  audience: string;
  trigger: string;
  subject: string;
  preview: string;
}

interface EmailData {
  smtpReady: boolean;
  senderReady: boolean;
  supportEmailReady: boolean;
  templates: EmailTemplateCard[];
  checklist: string[];
}

export default function AdminEmailsPage() {
  const [data, setData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const readinessItems: Array<{ label: string; value: boolean }> = data
    ? [
        { label: 'SMTP', value: data.smtpReady },
        { label: 'EMAIL_FROM', value: data.senderReady },
        { label: 'SUPPORT_EMAIL', value: data.supportEmailReady },
      ]
    : [];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/emails', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        setData(payload.emails);
      } catch (error) {
        console.error('Error fetching email center:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="py-12 text-center">Cargando email center...</div>;
  }

  if (!data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">No pudimos cargar el email center.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Lifecycle email center</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Base de emails transaccionales y de retencion</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          Aqui puedes ver si la infraestructura de envio esta lista y que correos deberian existir para mover activacion, cobro y retencion.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Readiness checklist</p>
          <div className="mt-6 space-y-3">
            {data.checklist.map((item) => (
              <div key={item} className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Estado tecnico</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {readinessItems.map((item) => (
              <div key={item.label} className="rounded-2xl bg-gray-50 p-5 text-center">
                <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                <p className={`mt-3 text-sm font-semibold ${item.value ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {item.value ? 'Listo' : 'Pendiente'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {data.templates.map((template) => (
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
          </article>
        ))}
      </section>
    </div>
  );
}

'use client';

import { useState } from 'react';

const previewCards = [
  {
    title: 'Auditoria en 7 minutos',
    detail: 'Detecta qué está frenando conversiones y qué mover primero para recuperar rentabilidad.',
  },
  {
    title: 'Plan de accion concreto',
    detail: 'Recibe un orden de prioridades para captación, seguimiento comercial y cierre.',
  },
  {
    title: 'Ruta de implementacion',
    detail: 'Define en qué módulo de Nexora empezar según tu situación actual.',
  },
];

const proofCases = [
  {
    title: 'Estudio creativo (servicios)',
    result: '+31% en leads calificados en 45 dias',
    detail: 'Unificaron campañas y seguimiento comercial para dejar de perder prospectos entre canales.',
  },
  {
    title: 'Ecommerce niche',
    result: '-22% en costo por adquisición en 6 semanas',
    detail: 'Reasignaron presupuesto con lectura diaria de rendimiento y pausaron campañas de bajo retorno.',
  },
  {
    title: 'Consultoría B2B',
    result: '+18% en cierres desde pipeline en 2 meses',
    detail: 'Pasaron de seguimiento manual a un flujo consistente con etapas y siguientes acciones claras.',
  },
];

export default function MasterclassLead() {
  const [form, setForm] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/lead-magnets/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          source: 'masterclass',
          resource: 'nexora-decision-map',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No pudimos registrar tu acceso.');
      }

      window.location.href = data.redirectUrl || '/masterclass/gracias';
    } catch (error) {
      console.error('Lead magnet form error:', error);
      setMessage(error instanceof Error ? error.message : 'No pudimos registrar tu acceso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="diagnostico" className="bg-[#fffaf0] px-4 py-24 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.02fr_0.98fr]">
        <div>
          <span className="section-tag">Auditoria gratis</span>
          <h2 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
            Auditoria de campañas en 7 minutos: detecta fugas y activa un plan de crecimiento.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Responde un formulario corto y recibe un diagnóstico accionable con prioridades por impacto.
            Así sabes exactamente qué corregir para vender más sin seguir improvisando.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {previewCards.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold leading-6 text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Recibe tu auditoria</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="input-field"
                placeholder="Tu nombre"
              />
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="input-field"
                placeholder="tu@email.com"
                required
              />
            </div>

            {message && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {message}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-slate-500">
                Te enviaremos el diagnóstico y una ruta recomendada para empezar en Nexora según tu caso.
              </p>
              <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
                {loading ? 'Procesando...' : 'Quiero mi auditoria gratis'}
              </button>
            </div>
          </form>

          <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Prueba social</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {proofCases.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-base font-semibold text-emerald-700">{item.result}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Qué incluye la auditoria</p>
          <h3 className="mt-3 text-2xl font-semibold text-slate-900">
            Una evaluación práctica para mejorar resultados, no un reporte decorativo.
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Te entrega prioridades claras para optimizar inversión, mejorar seguimiento y aumentar cierres.
          </p>

          <div className="mt-6 space-y-4">
            {[
              'Qué campañas están consumiendo presupuesto sin retorno suficiente.',
              'Qué parte de tu seguimiento comercial está frenando cierres.',
              'Qué acción ejecutar esta semana para mejorar ROI y pipeline.',
            ].map((item, index) => (
              <div key={item} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Paso 0{index + 1}</p>
                <p className="mt-2 text-base font-medium leading-7 text-slate-800">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Lo que recibes al enviar</p>
            <p className="mt-2 text-base font-medium leading-7 text-slate-800">
              Recibes el diagnóstico al instante y puedes avanzar a demo o decidir tu plan según tu situación actual.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';

const previewCards = [
  {
    title: 'Mapa de decisiones Nexora',
    detail: 'Una guía corta para ordenar oferta, mensaje, embudo y siguiente paso comercial.',
  },
  {
    title: 'Marco para bajar ideas a propuesta',
    detail: 'Te ayuda a dejar de pensar en abstracto y empezar a vender con una estructura clara.',
  },
  {
    title: 'Siguiente paso accionable',
    detail: 'El recurso termina llevándote a una decisión concreta, no a más ruido.',
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
    <section id="masterclass" className="bg-[#fffaf0] px-4 py-24 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.02fr_0.98fr]">
        <div>
          <span className="section-tag">Master class gratis</span>
          <h2 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
            No entregues solo un “gracias”. Entrega claridad que haga avanzar a la persona.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Cuando alguien pide tu master class gratis, la experiencia debe sentirse como el inicio de una relación seria.
            Por eso Nexora entrega un recurso propio, accionable y elegante desde el primer minuto.
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
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Recibe acceso inmediato</p>
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
                Acceso a una guía propia de Nexora con mapa, framework y siguiente paso comercial.
              </p>
              <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
                {loading ? 'Preparando acceso...' : 'Quiero la master class gratis'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Vista previa del valor</p>
          <h3 className="mt-3 text-2xl font-semibold text-slate-900">
            La entrega debe sentirse útil, premium y orientada a decisión.
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            En vez de mandar un archivo genérico o material ajeno, esta experiencia prepara al lead para pensar mejor
            su oferta, su sistema de ventas y el siguiente paso contigo.
          </p>

          <div className="mt-6 space-y-4">
            {[
              'Qué estás vendiendo realmente y cuál es la promesa principal.',
              'Qué parte del embudo está frenando claridad o conversión.',
              'Cómo bajar eso a una oferta, pitch o secuencia dentro de Nexora.',
            ].map((item, index) => (
              <div key={item} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Paso 0{index + 1}</p>
                <p className="mt-2 text-base font-medium leading-7 text-slate-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import RevealOnScroll from '@/components/ui/RevealOnScroll';

type AuditNiche = 'servicios' | 'ecommerce' | 'inmobiliario' | 'coaching';

const VALID_NICHES: AuditNiche[] = ['servicios', 'ecommerce', 'inmobiliario', 'coaching'];

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


export default function MasterclassLead() {
  const [form, setForm] = useState({ name: '', email: '', niche: 'servicios' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const niche = String(params.get('niche') || '').trim().toLowerCase() as AuditNiche;
    if (VALID_NICHES.includes(niche)) {
      setForm((current) => ({ ...current, niche }));
    }
  }, []);

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
          niche: form.niche,
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
    <section id="diagnostico" className="bg-[#070b1d] px-4 py-24 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.02fr_0.98fr]">
        <div>
          <RevealOnScroll>
            <div>
              <span className="section-tag section-tag-dark">Auditoria gratis</span>
              <h2 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
                Auditoria de campañas en 7 minutos: detecta fugas y activa un plan de crecimiento.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Responde un formulario corto y recibe un diagnóstico accionable con prioridades por impacto.
                Así sabes exactamente qué corregir para vender más sin seguir improvisando.
              </p>
            </div>
          </RevealOnScroll>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {previewCards.map((item, index) => (
              <RevealOnScroll key={item.title} delayMs={120 + index * 90}>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-[0_10px_40px_rgba(2,6,23,0.4)]">
                  <p className="text-sm font-semibold leading-6 text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>

          <RevealOnScroll delayMs={240}>
            <form onSubmit={handleSubmit} className="mt-10 rounded-[2rem] border border-white/10 bg-slate-900/75 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.48)]">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Recibe tu auditoria</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-500/15"
                  placeholder="Tu nombre"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-500/15"
                  placeholder="tu@email.com"
                  required
                />
                <select
                  value={form.niche}
                  onChange={(event) => setForm((current) => ({ ...current, niche: event.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-500/15"
                >
                  <option value="servicios">Servicios</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="inmobiliario">Inmobiliario</option>
                  <option value="coaching">Coaching / Infoproducto</option>
                </select>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Puedes compartir esta URL para preseleccionar nicho, por ejemplo: /?niche=ecommerce
              </p>

              {message && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {message}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-slate-400">
                  Te enviaremos el diagnóstico y una ruta recomendada para empezar en Nexora según tu caso.
                </p>
                <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto disabled:opacity-60">
                  {loading ? 'Procesando...' : 'Quiero mi auditoria gratis'}
                </button>
              </div>
            </form>
          </RevealOnScroll>

        </div>

        <RevealOnScroll delayMs={180}>
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-6 shadow-[0_22px_70px_rgba(2,6,23,0.48)]">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Qué incluye la auditoria</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Una evaluación práctica para mejorar resultados, no un reporte decorativo.
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Te entrega prioridades claras para optimizar inversión, mejorar seguimiento y aumentar cierres.
            </p>

            <div className="mt-6 space-y-4">
              {[
                'Qué campañas están consumiendo presupuesto sin retorno suficiente.',
                'Qué parte de tu seguimiento comercial está frenando cierres.',
                'Qué acción ejecutar esta semana para mejorar ROI y pipeline.',
              ].map((item, index) => (
                <RevealOnScroll key={item} delayMs={250 + index * 90}>
                  <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Paso 0{index + 1}</p>
                    <p className="mt-2 text-base font-medium leading-7 text-slate-100">{item}</p>
                  </div>
                </RevealOnScroll>
              ))}
            </div>

            <RevealOnScroll delayMs={540}>
              <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Lo que recibes al enviar</p>
                <p className="mt-2 text-base font-medium leading-7 text-slate-100">
                  Recibes el diagnóstico al instante y puedes avanzar a demo o decidir tu plan según tu situación actual.
                </p>
              </div>
            </RevealOnScroll>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

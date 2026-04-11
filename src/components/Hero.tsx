'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, PlayCircle, ShieldCheck, Sparkles, Zap } from 'lucide-react';

const metrics = [
  { label: 'Dashboards que reemplazas', value: '4+' },
  { label: 'Tiempo operativo que puedes ahorrar', value: '-12h/sem' },
  { label: 'Tiempo para activar una nueva cuenta', value: '< 10 min' },
];

const workflow = [
  { title: 'Conecta tus cuentas', detail: 'Centraliza Meta, Google y TikTok en una sola consola.' },
  { title: 'Revisa rendimiento en vivo', detail: 'Identifica qué campañas consumen presupuesto sin convertir.' },
  { title: 'Activa acciones y equipo', detail: 'Coordina campañas, pagos y panel admin desde la misma base.' },
];

export default function Hero() {
  return (
    <section className="hero-mesh relative overflow-hidden px-4 pb-24 pt-32 sm:px-6 lg:px-8 lg:pb-28 lg:pt-36">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.22),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.14),transparent_25%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-fadeInUp">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-4 py-2 text-sm font-medium text-orange-200">
            <Sparkles className="h-4 w-4" />
            Menos operación manual, más decisiones que sí empujan ventas
          </div>

          <h1 className="mt-8 max-w-4xl text-5xl font-semibold leading-tight text-white md:text-6xl lg:text-7xl">
            La forma más clara de
            <span className="gradient-text block"> controlar, vender y escalar tus anuncios.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
            Nexora reúne campañas, métricas, facturación y administración en una sola experiencia.
            Si hoy te cuesta mantener control y crecer con orden, aquí tienes una forma más clara de operar.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/auth/signup" className="btn-primary inline-flex items-center justify-center gap-2">
              Crear cuenta
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#diagnostico" className="btn-secondary inline-flex items-center justify-center gap-2">
              Obtener diagnostico gratis
            </Link>
            <Link href="#demo" className="btn-secondary inline-flex items-center justify-center gap-2">
              <PlayCircle className="h-4 w-4" />
              Ver demo guiada
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-slate-400">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Acceso inmediato
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              Operación más clara y confiable
            </span>
            <span className="inline-flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-300" />
              Sin contratos anuales forzados
            </span>
          </div>

          <div className="mt-14 grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-3xl font-semibold text-white">{metric.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-slideInRight">
          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-orange-500/30 via-transparent to-cyan-400/25 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-[0_30px_120px_rgba(15,23,42,0.6)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Live workspace</p>
                  <p className="mt-2 text-lg font-semibold text-white">Centro operativo de campañas</p>
                </div>
                <div className="flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-400/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-300/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Pipeline semanal</p>
                      <p className="mt-1 text-2xl font-semibold text-white">$48,920</p>
                    </div>
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                      +18.4% vs. semana pasada
                    </span>
                  </div>

                  <div className="mt-8 space-y-4">
                    {[82, 64, 91, 58].map((value, index) => (
                      <div key={value} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Canal {index + 1}</span>
                          <span className="font-medium text-slate-200">{value}% eficiencia</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#fb923c_0%,#facc15_50%,#38bdf8_100%)]"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {workflow.map((item, index) => (
                    <div key={item.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
                          0{index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-400">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-4">
                  <p className="text-sm text-cyan-200">Cuentas activas</p>
                  <p className="mt-2 text-2xl font-semibold text-white">12</p>
                </div>
                <div className="rounded-2xl border border-orange-400/15 bg-orange-400/10 p-4">
                  <p className="text-sm text-orange-100">Campañas monitoreadas</p>
                  <p className="mt-2 text-2xl font-semibold text-white">38</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4">
                  <p className="text-sm text-emerald-200">ROAS agregado</p>
                  <p className="mt-2 text-2xl font-semibold text-white">3.4x</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

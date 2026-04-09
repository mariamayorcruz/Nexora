'use client';

import { PauseCircle, PlayCircle, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type DemoScene = {
  title: string;
  badge: string;
  script: string;
  bullets: string[];
};

const scenes: DemoScene[] = [
  {
    badge: 'Escena 01',
    title: 'Entramos al dashboard y detectamos foco de dinero',
    script:
      'Bienvenido a Nexora. Aquí no pierdes tiempo saltando entre plataformas. En segundos ves qué campañas están consumiendo presupuesto, cuáles están convirtiendo y dónde conviene actuar primero.',
    bullets: [
      'Resumen semanal con gasto, ROAS y oportunidades.',
      'Señales rápidas para campañas activas, pausadas y con riesgo.',
      'Jerarquía visual clara para leer resultados sin ruido.',
    ],
  },
  {
    badge: 'Escena 02',
    title: 'Abrimos campañas y bajamos al detalle operativo',
    script:
      'Desde el centro de campañas puedes revisar presupuesto, impresiones, clics y conversiones en una sola capa. La idea no es solo ver métricas: es tomar decisiones más rápido con menos fricción.',
    bullets: [
      'Lectura operativa de campañas por cuenta y estado.',
      'Indicadores visibles para presupuesto, clics y conversiones.',
      'Preparado para crecer sin desordenar la operación.',
    ],
  },
  {
    badge: 'Escena 03',
    title: 'Pasamos a administración, pagos y escalado',
    script:
      'Nexora también te da la base para vender el producto de verdad. Autenticación, suscripciones, Stripe y panel admin conviven dentro del mismo proyecto, listos para una operación más seria.',
    bullets: [
      'Registro e inicio de sesión conectados.',
      'Base de cobro y control de suscripciones.',
      'Panel administrativo para usuarios, campañas y configuración.',
    ],
  },
];

function getPreferredVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith('es') && voice.localService) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('es')) ??
    null
  );
}

export default function Demo() {
  const [activeScene, setActiveScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [supportsSpeech, setSupportsSpeech] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    setSupportsSpeech(true);
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const stopPlayback = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const playScene = (index: number) => {
    setActiveScene(index);

    if (typeof window === 'undefined' || !('speechSynthesis' in window) || isMuted) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(scenes[index].script);
    const preferredVoice = getPreferredVoice(voicesRef.current);

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = 'es-ES';
    }

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => {
      if (index < scenes.length - 1) {
        playScene(index + 1);
      } else {
        setIsPlaying(false);
      }
    };
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleMainAction = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    playScene(activeScene);
  };

  const videoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;

  return (
    <section id="demo" className="bg-slate-950 px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <span className="section-tag section-tag-dark">Demo</span>
          <h2 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
            Un demo que sí cuenta la historia del producto.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Como todavía no había video en `public`, cambié el placeholder por una demo guiada que habla usando la voz del navegador.
            Si luego agregas un video real, basta con definir `NEXT_PUBLIC_DEMO_VIDEO_URL` y este bloque lo mostrará automáticamente.
          </p>
        </div>

        <div className="mt-12 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_25px_80px_rgba(15,23,42,0.5)]">
            {videoUrl ? (
              <video
                className="aspect-video w-full bg-black object-cover"
                controls
                playsInline
                preload="metadata"
              >
                <source src={videoUrl} />
                Tu navegador no pudo cargar el video.
              </video>
            ) : (
              <div className="aspect-video bg-[linear-gradient(135deg,#020617_0%,#111827_45%,#0f172a_100%)] p-6 sm:p-8">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Demo guiada con voz</p>
                      <p className="mt-2 text-xl font-semibold text-white">{scenes[activeScene].title}</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                      {scenes[activeScene].badge}
                    </div>
                  </div>

                  <div className="mt-6 grid flex-1 gap-5 lg:grid-cols-[0.86fr_1.14fr]">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-sm leading-7 text-slate-300">{scenes[activeScene].script}</p>
                      <div className="mt-6 space-y-3">
                        {scenes[activeScene].bullets.map((bullet) => (
                          <div key={bullet} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                            {bullet}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">ROAS</p>
                          <p className="mt-3 text-3xl font-semibold text-white">3.4x</p>
                          <p className="mt-2 text-sm text-emerald-300">Rendimiento agregado saludable</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Campañas activas</p>
                          <p className="mt-3 text-3xl font-semibold text-white">18</p>
                          <p className="mt-2 text-sm text-cyan-300">3 cuentas sincronizadas</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-4 flex items-center justify-between text-sm">
                          <span className="text-slate-400">Prioridad operativa</span>
                          <span className="font-medium text-white">Campaña remarketing LATAM</span>
                        </div>
                        <div className="space-y-3">
                          {[76, 59, 88].map((value, index) => (
                            <div key={value} className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>Bloque {index + 1}</span>
                                <span>{value}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full bg-[linear-gradient(90deg,#fb923c_0%,#f97316_50%,#38bdf8_100%)]"
                                  style={{ width: `${value}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">Estado del workspace</p>
                          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                            Operación estable
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-slate-900/90 p-3">
                            <p className="text-xs text-slate-500">Auth</p>
                            <p className="mt-2 font-medium text-white">Activa</p>
                          </div>
                          <div className="rounded-2xl bg-slate-900/90 p-3">
                            <p className="text-xs text-slate-500">Stripe</p>
                            <p className="mt-2 font-medium text-white">Integrable</p>
                          </div>
                          <div className="rounded-2xl bg-slate-900/90 p-3">
                            <p className="text-xs text-slate-500">Admin</p>
                            <p className="mt-2 font-medium text-white">Listo</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={handleMainAction} className="btn-primary inline-flex items-center gap-2">
                        {isPlaying ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                        {isPlaying ? 'Pausar demo' : 'Reproducir demo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          stopPlayback();
                          setActiveScene(0);
                        }}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Reiniciar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextValue = !isMuted;
                          setIsMuted(nextValue);

                          if (nextValue) {
                            stopPlayback();
                          }
                        }}
                        className="btn-ghost inline-flex items-center gap-2"
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        {isMuted ? 'Activar voz' : 'Silenciar voz'}
                      </button>
                    </div>

                    <p className="text-sm text-slate-400">
                      {supportsSpeech
                        ? 'Usa Web Speech API para narrar la demo directamente en el navegador.'
                        : 'Tu navegador no soporta narración automática, pero el recorrido visual sigue disponible.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {scenes.map((scene, index) => (
              <button
                key={scene.title}
                type="button"
                onClick={() => {
                  stopPlayback();
                  setActiveScene(index);
                }}
                className={`w-full rounded-[1.75rem] border p-6 text-left transition ${
                  activeScene === index
                    ? 'border-orange-400/40 bg-orange-400/10 shadow-[0_18px_60px_rgba(249,115,22,0.12)]'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
                }`}
              >
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{scene.badge}</p>
                <h3 className="mt-3 text-xl font-semibold text-white">{scene.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{scene.script}</p>
              </button>
            ))}

          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ConnectState = {
  adAccounts?: Array<{ id: string; platform: string; accountName: string; connected: boolean }>;
};

export default function IntegracionesPage() {
  const [state, setState] = useState<ConnectState>({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    void fetch('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => setState({ adAccounts: data.adAccounts || [] }))
      .catch(() => setState({ adAccounts: [] }));
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#040810] px-6 py-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">✦ Integraciones</p>
        <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.03em] text-white">Conecta tus canales de operación</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Centraliza Facebook, Instagram y el resto de tus fuentes para que Nexora lea campaña, lead y actividad desde un solo sistema.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Instagram', connected: state.adAccounts?.some((item) => item.platform === 'instagram') },
          { label: 'Facebook', connected: state.adAccounts?.some((item) => item.platform === 'facebook') },
          { label: 'Google', connected: state.adAccounts?.some((item) => item.platform === 'google') },
          { label: 'TikTok', connected: state.adAccounts?.some((item) => item.platform === 'tiktok') },
        ].map((item) => (
          <div key={item.label} className="rounded-[24px] bg-[#040810] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className={`mt-3 text-xl font-semibold ${item.connected ? 'text-emerald-300' : 'text-slate-300'}`}>
              {item.connected ? 'Conectado' : 'Pendiente'}
            </p>
          </div>
        ))}
      </section>

      <div className="rounded-[28px] bg-[#040810] p-6">
        <p className="text-sm text-slate-300">
          Usa este espacio como lectura rápida de estado. La configuración operativa y de cuenta sigue disponible desde Ajustes y Soporte.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/settings"
            className="inline-flex rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400"
          >
            Abrir ajustes
          </Link>
          <Link
            href="/dashboard/support"
            className="inline-flex rounded-full bg-white/[0.04] px-4 py-2 text-sm text-slate-300 transition-all duration-150 hover:bg-white/[0.06] hover:text-white"
          >
            Pedir ayuda
          </Link>
        </div>
      </div>
    </div>
  );
}

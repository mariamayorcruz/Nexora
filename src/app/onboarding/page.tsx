'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, Layers3, Target, Users } from 'lucide-react';

const INDUSTRY_OPTIONS = [
  { value: 'ecommerce', label: 'Ecommerce' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'salud', label: 'Salud' },
  { value: 'educacion', label: 'Educación' },
  { value: 'otro', label: 'Otro' },
] as const;

const GOAL_OPTIONS = [
  { value: 'conseguir_mas_leads', label: 'Conseguir más leads' },
  { value: 'cerrar_mas_ventas', label: 'Cerrar más ventas' },
  { value: 'automatizar_seguimiento', label: 'Automatizar seguimiento' },
] as const;

const CHANNEL_OPTIONS = ['Instagram', 'WhatsApp', 'Email', 'Facebook'] as const;
const CUSTOMER_RANGE_OPTIONS = ['0-10', '10-50', '50-200', '200+'] as const;

type MeResponse = {
  user?: {
    name?: string | null;
    onboardingCompletedAt?: string | null;
    subscription?: {
      status?: string | null;
    } | null;
  } | null;
};

const inputClassName =
  'w-full rounded-2xl border border-slate-600 bg-slate-800/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [form, setForm] = useState({
    businessName: '',
    industries: [] as string[],
    primaryGoals: [] as string[],
    channels: [] as string[],
    customerRange: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const validateAccess = async () => {
      try {
        const response = await fetch('/api/users/me?allowIncomplete=1', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        if (!response.ok) {
          router.push('/auth/login');
          return;
        }

        const data = (await response.json()) as MeResponse;
        const status = data?.user?.subscription?.status?.toLowerCase?.() || null;
        const completed = data?.user?.onboardingCompletedAt ?? null;

        setUserName(data?.user?.name || '');

        if (completed) {
          router.push('/dashboard');
          return;
        }

        if (!['active', 'trialing'].includes(status || '')) {
          router.push('/dashboard/billing');
          return;
        }
      } catch (requestError) {
        console.error('Onboarding access validation failed:', requestError);
        router.push('/auth/login');
        return;
      } finally {
        setLoading(false);
      }
    };

    void validateAccess();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = useMemo(() => {
    let completed = 0;
    if (form.businessName.trim()) completed += 1;
    if (form.industries.length > 0) completed += 1;
    if (form.primaryGoals.length > 0) completed += 1;
    if (form.channels.length > 0) completed += 1;
    if (form.customerRange) completed += 1;
    return Math.round((completed / 5) * 100);
  }, [form]);

  const toggleIndustry = (industry: (typeof INDUSTRY_OPTIONS)[number]['value']) => {
    setForm((current) => ({
      ...current,
      industries: current.industries.includes(industry)
        ? current.industries.filter((item) => item !== industry)
        : [...current.industries, industry],
    }));
  };

  const togglePrimaryGoal = (goal: (typeof GOAL_OPTIONS)[number]['value']) => {
    setForm((current) => ({
      ...current,
      primaryGoals: current.primaryGoals.includes(goal)
        ? current.primaryGoals.filter((item) => item !== goal)
        : [...current.primaryGoals, goal],
    }));
  };

  const toggleChannel = (channel: (typeof CHANNEL_OPTIONS)[number]) => {
    setForm((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || 'No pudimos guardar tu onboarding.');
        return;
      }

      router.push('/dashboard');
    } catch (requestError) {
      console.error('Onboarding submit failed:', requestError);
      setError('No pudimos guardar tu onboarding. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 px-6 text-slate-200">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400" />
          <p className="mt-4 text-sm text-slate-400">Preparando tu espacio…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 px-4 py-10 text-slate-200 sm:px-6 lg:px-8">
      <section className="w-full max-w-2xl rounded-[32px] border border-slate-700/50 bg-slate-900/80 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl sm:p-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300">Nexora</p>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            Configura tu negocio en Nexora
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            {userName
              ? `${userName}, responde estas 5 preguntas para personalizar tu primer paso dentro del sistema.`
              : 'Responde estas 5 preguntas para personalizar tu primer paso dentro del sistema.'}
          </p>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Progreso</p>
            <p className="text-sm font-bold text-cyan-300">{progress}%</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Building2 className="h-4 w-4 text-cyan-300" />
                  Nombre de tu negocio
                </label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
                  className={inputClassName}
                  placeholder="Ej. María Cruz Lanas"
                  maxLength={120}
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Layers3 className="h-4 w-4 text-cyan-300" />
                  Tipo de negocio / industria
                </label>
                <div className="flex flex-wrap gap-3">
                  {INDUSTRY_OPTIONS.map((option) => {
                    const active = form.industries.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleIndustry(option.value)}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm transition ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/20 text-white'
                            : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                        }`}
                      >
                        <CheckCircle2 className={`h-4 w-4 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Target className="h-4 w-4 text-cyan-300" />
                  Objetivo principal
                </label>
                <div className="flex flex-wrap gap-3">
                  {GOAL_OPTIONS.map((option) => {
                    const active = form.primaryGoals.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => togglePrimaryGoal(option.value)}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm transition ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/20 text-white'
                            : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                        }`}
                      >
                        <CheckCircle2 className={`h-4 w-4 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Canales que usas</label>
                <div className="flex flex-wrap gap-3">
                  {CHANNEL_OPTIONS.map((channel) => {
                    const active = form.channels.includes(channel);
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => toggleChannel(channel)}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm transition ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/20 text-white'
                            : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                        }`}
                      >
                        <CheckCircle2 className={`h-4 w-4 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                        {channel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Users className="h-4 w-4 text-cyan-300" />
                  Cuántos clientes tienes actualmente
                </label>
                <select
                  value={form.customerRange}
                  onChange={(event) => setForm((current) => ({ ...current, customerRange: event.target.value }))}
                  className={inputClassName}
                >
                  <option value="">Selecciona un rango</option>
                  {CUSTOMER_RANGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">
                  Esto solo nos ayuda a adaptar tu experiencia inicial. Toma menos de 1 minuto.
                </p>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
                >
                  {saving ? 'Guardando…' : 'Guardar y continuar'}
                  {!saving && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </form>
      </section>
    </div>
  );
}

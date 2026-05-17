'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BILLING_PLANS, BillingCycle, BillingPlan } from '@/lib/billing';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, config: object) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const selectedPlanFromUrl = searchParams.get('plan') as BillingPlan | null;
  const selectedBillingFromUrl = (searchParams.get('billing') as BillingCycle | null) || null;
  const [fallbackSelection, setFallbackSelection] = useState<{ plan: BillingPlan; billing: BillingCycle } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    terms: false,
    marketingOptIn: true,
  });

  useEffect(() => {
    if (selectedPlanFromUrl) return;
    try {
      const rawSelection = localStorage.getItem('nexoraSelectedPlan');
      if (!rawSelection) return;
      const parsed = JSON.parse(rawSelection) as {
        plan?: BillingPlan;
        billing?: BillingCycle;
        savedAt?: number;
      };
      if (!parsed.plan || !Object.prototype.hasOwnProperty.call(BILLING_PLANS, parsed.plan)) return;
      const isFresh = typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt < 30 * 60 * 1000;
      if (!isFresh) {
        localStorage.removeItem('nexoraSelectedPlan');
        return;
      }
      setFallbackSelection({
        plan: parsed.plan,
        billing: parsed.billing === 'yearly' ? 'yearly' : 'monthly',
      });
    } catch (selectionError) {
      console.error('Error reading selected plan:', selectionError);
    }
  }, [selectedPlanFromUrl]);

  const selectedPlan = selectedPlanFromUrl || fallbackSelection?.plan || null;
  const selectedBilling = selectedBillingFromUrl || fallbackSelection?.billing || 'monthly';
  const selectedPlanConfig = useMemo(
    () => (selectedPlan ? BILLING_PLANS[selectedPlan] : null),
    [selectedPlan]
  );

  const handleGoogleResponse = async (response: { credential: string }) => {
    setGoogleLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error con Google');
      localStorage.setItem('token', data.token);
      if (selectedPlanConfig && !data.user?.founderAccess) {
        localStorage.setItem(
          'nexoraSelectedPlan',
          JSON.stringify({
            plan: selectedPlanConfig.key,
            billing: selectedBilling,
            savedAt: Date.now(),
          })
        );
        router.push(
          `/dashboard/billing?plan=${selectedPlanConfig.key}&billing=${selectedBilling}&autostart=1&source=signup`
        );
        return;
      }
      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error con Google Sign-In');
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signup_with',
          locale: 'es',
        });
      }
    };
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [handleGoogleResponse]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!formData.terms) {
      setError('Debes aceptar los términos y condiciones.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          marketingOptIn: formData.marketingOptIn,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'No pudimos crear tu cuenta.');
        return;
      }
      localStorage.setItem('token', data.token);
      if (selectedPlanConfig && !data.user?.founderAccess) {
        localStorage.setItem(
          'nexoraSelectedPlan',
          JSON.stringify({
            plan: selectedPlanConfig.key,
            billing: selectedBilling,
            savedAt: Date.now(),
          })
        );
        router.push(
          `/dashboard/billing?plan=${selectedPlanConfig.key}&billing=${selectedBilling}&autostart=1&source=signup`
        );
        return;
      }
      router.push('/onboarding');
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#05080f] px-6 py-12">
      <div className="w-full max-w-md">
        <header className="text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-lg font-bold text-white">
            NX
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Crea tu cuenta en Nexora
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            CRM + IA + Automatización para hacer crecer tu negocio
          </p>
        </header>

        {selectedPlanConfig && (
          <div className="mt-6 rounded-[20px] border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-300">
            <p className="font-semibold">Plan seleccionado: {selectedPlanConfig.marketingLabel}</p>
            <p className="mt-1 text-cyan-400/70">
              7 días por $1 · Luego {selectedBilling === 'yearly' ? 'facturación anual' : `$${selectedPlanConfig.monthlyPrice}/mes`}
            </p>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
              {error}
            </div>
          )}

          {GOOGLE_CLIENT_ID && (
            <>
              <div ref={googleButtonRef} className="w-full" />
              {googleLoading && (
                <p className="text-center text-xs text-slate-500">Conectando con Google...</p>
              )}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-xs text-slate-600">o regístrate con email</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Nombre completo
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                autoComplete="name"
                className="w-full rounded-xl border border-white/[0.08] bg-[#040810] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-500/40"
                placeholder="Tu nombre"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Correo electrónico
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-white/[0.08] bg-[#040810] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-500/40"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Contraseña
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/[0.08] bg-[#040810] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-500/40"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/[0.08] bg-[#040810] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-500/40"
                placeholder="Repite tu contraseña"
              />
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.checked })}
                className="mt-1 h-4 w-4 rounded accent-cyan-400"
              />
              <span className="text-xs leading-5 text-slate-400">
                Acepto los{' '}
                <Link href="/legal/terms" className="text-cyan-400 hover:text-cyan-300">
                  términos de servicio
                </Link>{' '}
                y la{' '}
                <Link href="/legal/privacy" className="text-cyan-400 hover:text-cyan-300">
                  política de privacidad
                </Link>.
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.marketingOptIn}
                onChange={(e) => setFormData({ ...formData, marketingOptIn: e.target.checked })}
                className="mt-1 h-4 w-4 rounded accent-cyan-400"
              />
              <span className="text-xs leading-5 text-slate-400">
                Quiero recibir tips, mejoras y casos de uso de Nexora.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? 'Creando tu cuenta...' : 'Crear cuenta →'}
            </button>

            <p className="text-center text-xs text-slate-600">
              7 días por $1 · Sin compromiso · Cancela cuando quieras
            </p>
          </form>

          <p className="text-center text-xs text-slate-600">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-cyan-400 hover:text-cyan-300">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Signup() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05080f]" />}>
      <SignupForm />
    </Suspense>
  );
}

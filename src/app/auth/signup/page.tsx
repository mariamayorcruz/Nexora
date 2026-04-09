'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { BILLING_PLANS, BillingCycle, BillingPlan } from '@/lib/billing';

const inputClassName =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    if (selectedPlanFromUrl) {
      return;
    }

    try {
      const rawSelection = localStorage.getItem('nexoraSelectedPlan');
      if (!rawSelection) {
        return;
      }

      const parsed = JSON.parse(rawSelection) as {
        plan?: BillingPlan;
        billing?: BillingCycle;
        savedAt?: number;
      };

      if (!parsed.plan || !Object.prototype.hasOwnProperty.call(BILLING_PLANS, parsed.plan)) {
        return;
      }

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
        router.push(`/dashboard/billing?plan=${selectedPlanConfig.key}&billing=${selectedBilling}&autostart=1&source=signup`);
        return;
      }

      router.push('/dashboard');
    } catch (requestError) {
      console.error('Signup request error:', requestError);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-[28px] border border-gray-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">Crea tu cuenta</h2>
          <p className="mb-8 text-center text-gray-600">Empieza a gestionar crecimiento, creatividad y campañas desde un solo lugar.</p>

          {selectedPlanConfig && (
            <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Estás activando el plan {selectedPlanConfig.marketingLabel}</p>
              <p className="mt-1">
                Cuando termines tu cuenta te llevaremos directo a Stripe para completar tu suscripción{' '}
                {selectedBilling === 'yearly' ? 'anual' : 'mensual'}.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Nombre completo</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                required
                autoComplete="name"
                className={inputClassName}
                placeholder="Tu nombre"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                required
                autoComplete="email"
                spellCheck={false}
                className={inputClassName}
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Contraseña</label>
              <input
                type="password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                required
                autoComplete="new-password"
                className={inputClassName}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Confirmar contraseña</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                required
                autoComplete="new-password"
                className={inputClassName}
                placeholder="Repite tu contraseña"
              />
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <input
                type="checkbox"
                checked={formData.terms}
                onChange={(event) => setFormData({ ...formData, terms: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm leading-6 text-gray-600">
                Acepto los <Link href="#" className="font-medium text-primary hover:underline">términos de servicio</Link> y la{' '}
                <Link href="#" className="font-medium text-primary hover:underline">política de privacidad</Link>.
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={formData.marketingOptIn}
                onChange={(event) => setFormData({ ...formData, marketingOptIn: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm leading-6 text-gray-600">
                Quiero recibir emails con ideas, mejoras, casos de uso y ofertas de Nexora mientras activo mi cuenta.
              </span>
            </label>

            <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-600">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="font-semibold text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default function Signup() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SignupForm />
    </Suspense>
  );
}

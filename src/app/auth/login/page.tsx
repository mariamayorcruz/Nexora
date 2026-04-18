'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const inputClassName =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary';

const CREDENTIALS_ERROR =
  'No pudimos iniciar sesión. Verifica tus datos e intenta nuevamente.';
const NETWORK_ERROR = 'Problema de conexión. Intenta nuevamente.';
const EMPTY_FIELDS_ERROR = 'Completa todos los campos para continuar';

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const fieldsFilled = Boolean(formData.email.trim() && formData.password.trim());

  useEffect(() => {
    if (localStorage.getItem('token')) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) {
      return;
    }
    const email = formData.email.trim().toLowerCase();
    if (!email || !formData.password.trim()) {
      setError(EMPTY_FIELDS_ERROR);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(CREDENTIALS_ERROR);
        return;
      }

      localStorage.setItem('token', data.token);
      router.replace('/dashboard');
    } catch (requestError) {
      console.error('Login request error:', requestError);
      setError(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-md">
        <header className="text-center">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Crea campañas, automatiza leads y escala con IA
          </h1>
          <p className="mt-4 text-pretty text-base text-gray-600">
            Accede en segundos a tu dashboard
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">
              Correo electrónico
            </label>
            <input
              id="login-email"
              type="email"
              value={formData.email}
              onChange={(event) => {
                setError(null);
                setFormData({ ...formData, email: event.target.value });
              }}
              autoComplete="email"
              autoFocus
              spellCheck={false}
              className={inputClassName}
              placeholder="tu@email.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              value={formData.password}
              onChange={(event) => {
                setError(null);
                setFormData({ ...formData, password: event.target.value });
              }}
              autoComplete="current-password"
              className={inputClassName}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-4 pt-2">
            <button
              type="submit"
              disabled={loading || !fieldsFilled}
              className="btn-primary w-full cursor-pointer py-3 text-base disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar a Nexora'}
            </button>
            <p className="text-center text-xs text-gray-500">No necesitas tarjeta de crédito</p>
          </div>
        </form>
      </div>
    </div>
  );
}

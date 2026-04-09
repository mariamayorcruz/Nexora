'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Navbar from '@/components/Navbar';

const inputClassName =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary';

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [socialMessage, setSocialMessage] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSocialMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'No pudimos iniciar sesion.');
        return;
      }

      localStorage.setItem('token', data.token);
      router.push('/dashboard');
    } catch (requestError) {
      console.error('Login request error:', requestError);
        setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialClick = (provider: 'Google' | 'GitHub') => {
    setError('');
    setSocialMessage(
        `El acceso con ${provider} todavía no está configurado en Nexora. Por ahora entra con email y contraseña para no frenar tu acceso.`
    );
  };

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-[28px] border border-gray-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h2 className="mb-8 text-center text-3xl font-bold text-gray-900">Inicia sesión</h2>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {socialMessage && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {socialMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                autoComplete="current-password"
                className={inputClassName}
                placeholder="Escribe tu contraseña"
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">
              {loading ? 'Entrando...' : 'Inicia sesión'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-600">
            ¿No tienes cuenta?{' '}
            <Link href="/auth/signup" className="font-semibold text-primary hover:underline">
              Registrate aqui
            </Link>
          </p>

          <div className="mt-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-300" />
            <span className="text-sm text-gray-500">O continua con</span>
            <div className="h-px flex-1 bg-gray-300" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleSocialClick('Google')}
              className="flex items-center justify-center rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <span className="text-base text-gray-900">G</span>
              <span className="ml-2">Google</span>
            </button>
            <button
              type="button"
              onClick={() => handleSocialClick('GitHub')}
              className="flex items-center justify-center rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <span className="text-base text-gray-900">GH</span>
              <span className="ml-2">GitHub</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

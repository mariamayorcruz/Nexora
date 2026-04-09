'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Navbar from '@/components/Navbar';

const inputClassName =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary';

export default function Signup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    terms: false,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Las contrasenas no coinciden.');
      return;
    }

    if (!formData.terms) {
      setError('Debes aceptar los terminos y condiciones.');
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'No pudimos crear tu cuenta.');
        return;
      }

      localStorage.setItem('token', data.token);
      router.push('/dashboard');
    } catch (requestError) {
      console.error('Signup request error:', requestError);
      setError('Error de conexion. Intenta de nuevo.');
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
          <p className="mb-8 text-center text-gray-600">Empieza a gestionar crecimiento, creatividad y campanas desde un solo lugar.</p>

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
              <label className="mb-2 block text-sm font-medium text-gray-700">Contrasena</label>
              <input
                type="password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                required
                autoComplete="new-password"
                className={inputClassName}
                placeholder="Minimo 8 caracteres"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Confirmar contrasena</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                required
                autoComplete="new-password"
                className={inputClassName}
                placeholder="Repite tu contrasena"
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
                Acepto los <Link href="#" className="font-medium text-primary hover:underline">terminos de servicio</Link> y la{' '}
                <Link href="#" className="font-medium text-primary hover:underline">politica de privacidad</Link>.
              </span>
            </label>

            <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-600">
            Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="font-semibold text-primary hover:underline">
              Inicia sesion
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

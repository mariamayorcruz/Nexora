'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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

export default function Login() {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const fieldsFilled = Boolean(formData.email.trim() && formData.password.trim());

  const handleGoogleResponse = useCallback(
    async (response: { credential: string }) => {
      setGoogleLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error con Google');

        localStorage.setItem('token', data.token);
        router.replace('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error con Google Sign-In');
      } finally {
        setGoogleLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (localStorage.getItem('token')) {
      router.replace('/dashboard');
    }
  }, [router]);

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
          width: 380,
          text: 'continue_with',
          locale: 'es',
        });
      }
    };

    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [handleGoogleResponse]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const email = formData.email.trim().toLowerCase();
    if (!email || !formData.password.trim()) {
      setError('Completa todos los campos para continuar');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: formData.password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError('No pudimos iniciar sesion. Verifica tus datos e intenta nuevamente.');
        return;
      }

      localStorage.setItem('token', data.token);
      router.replace('/dashboard');
    } catch {
      setError('Problema de conexion. Intenta nuevamente.');
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
            Bienvenido a Nexora
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            CRM + IA + Automatizacion para hacer crecer tu negocio
          </p>
        </header>

        <div className="mt-8 space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          {GOOGLE_CLIENT_ID ? (
            <>
              <div ref={googleButtonRef} className="flex w-full justify-center" />
              {googleLoading ? (
                <p className="text-center text-xs text-slate-500">Conectando con Google...</p>
              ) : null}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-xs text-slate-600">o continua con email</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>
            </>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-slate-400">
                Correo electronico
              </label>
              <input
                id="login-email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setError(null);
                  setFormData({ ...formData, email: e.target.value });
                }}
                autoComplete="email"
                autoFocus
                className="w-full rounded-xl border border-white/[0.08] bg-[#040810] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-slate-400">
                Contrasena
              </label>
              <input
                id="login-password"
                type="password"
                value={formData.password}
                onChange={(e) => {
                  setError(null);
                  setFormData({ ...formData, password: e.target.value });
                }}
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/[0.08] bg-[#040810] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !fieldsFilled}
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar a Nexora'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600">
            ¿No tienes cuenta?{' '}
            <Link href="/auth/signup" className="text-cyan-400 hover:text-cyan-300">
              Registrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import CookiePreferences from '@/components/CookiePreferences';

export default function Footer() {
  return (
    <footer className="bg-[#050816] px-4 pb-10 pt-20 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-10 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.9fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 via-amber-300 to-rose-500 text-slate-950">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Nexora</p>
                <p className="text-sm text-slate-400">AI Ads Operating System</p>
              </div>
            </Link>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
              Plataforma para centralizar campañas, CRM, funnel, cobros y asistencia IA dentro de una operación más clara y más seria.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Producto</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <Link href="#solution" className="block transition hover:text-white">
                Solución
              </Link>
              <Link href="#demo" className="block transition hover:text-white">
                Demo
              </Link>
              <Link href="#diagnostico" className="block transition hover:text-white">
                Diagnóstico
              </Link>
              <Link href="#pricing" className="block transition hover:text-white">
                Precios
              </Link>
              <Link href="#faq" className="block transition hover:text-white">
                FAQ
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Acceso</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <Link href="/auth/login" className="block transition hover:text-white">
                Iniciar sesión
              </Link>
              <Link href="/auth/signup" className="block transition hover:text-white">
                Crear cuenta
              </Link>
              <Link href="/dashboard" className="block transition hover:text-white">
                Dashboard
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">¿Por qué Nexora?</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Porque te ayuda a pasar de acciones sueltas a un sistema comercial claro: atraer, seguir, convertir y tomar decisiones con apoyo de IA.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Legal</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <Link href="/legal/terms" className="block transition hover:text-white">
                Terms of Service
              </Link>
              <Link href="/legal/privacy" className="block transition hover:text-white">
                Privacy Information
              </Link>
              <Link href="/security/disclosure" className="block transition hover:text-white">
                Responsible Disclosure
              </Link>
              <Link href="/trust" className="block transition hover:text-white">
                Trust
              </Link>
              <Link href="/contact" className="block transition hover:text-white">
                Contact
              </Link>
              <Link href="/cookies" className="block transition hover:text-white">
                Cookie Preferences
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-4 border-t border-white/10 pt-6 text-sm text-slate-400">
          <CookiePreferences />
          <p>
            © Copyright 2026 Nexora, Inc. All rights reserved. Various trademarks held by their respective owners.
            Nexora, Inc. Mission District, San Francisco, CA, United States.
          </p>
        </div>
      </div>
    </footer>
  );
}

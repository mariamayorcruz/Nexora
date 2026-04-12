'use client';

import Link from 'next/link';
import { Menu, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '#solution', label: 'Solución' },
  { href: '#demo', label: 'Demo' },
  { href: '#diagnostico', label: 'Diagnóstico' },
  { href: '#pricing', label: 'Precios' },
  { href: '#faq', label: 'FAQ' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 via-amber-300 to-rose-500 shadow-[0_10px_30px_rgba(251,146,60,0.35)]">
            <Sparkles className="h-5 w-5 text-slate-950" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-wide">Nexora</p>
            <p className="text-xs text-slate-400">AI Ads Operating System</p>
          </div>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/auth/login" className="text-sm font-medium text-slate-300 transition hover:text-white">
            Iniciar sesión
          </Link>
          <Link href="/auth/signup" className="btn-primary">
            Empezar ahora
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:hidden"
          aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-white/10 bg-slate-950/95 px-4 pb-6 pt-4 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setIsOpen(false)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            >
              Iniciar sesión
            </Link>
            <Link href="/auth/signup" onClick={() => setIsOpen(false)} className="btn-primary text-center">
              Empezar ahora
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

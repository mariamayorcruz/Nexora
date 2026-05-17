'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useLang } from '@/context/LanguageContext';

const navItems = {
  en: [
    { href: '#solution', label: 'Product' },
    { href: '#demo', label: 'Demo' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ],
  es: [
    { href: '#solution', label: 'Producto' },
    { href: '#demo', label: 'Demo' },
    { href: '#pricing', label: 'Precios' },
    { href: '#faq', label: 'FAQ' },
  ],
};

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { lang, setLang } = useLang();
  const items = navItems[lang];

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href="/" aria-label="GotNexora home">
          <Image
            src="/LogoHorizontal.png"
            alt="GotNexora"
            width={200}
            height={52}
            className="h-12 w-auto"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden items-center gap-3 md:flex">
          {/* Lang toggle */}
          <div className="flex gap-1 rounded-full bg-slate-100 p-1">
            {(['en', 'es'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                  lang === l
                    ? 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <Link
            href="/auth/login"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            {lang === 'en' ? 'Log in' : 'Iniciar sesión'}
          </Link>

          <Link
            href="/auth/signup"
            className="rounded-xl bg-[#0ea5e9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0284c7]"
          >
            {lang === 'en' ? 'Start free trial' : 'Prueba gratis'}
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 md:hidden"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="border-t border-slate-200 bg-white px-4 pb-6 pt-4 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              <Link
                href="/auth/login"
                onClick={() => setIsOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700"
              >
                {lang === 'en' ? 'Log in' : 'Iniciar sesión'}
              </Link>
              <Link
                href="/auth/signup"
                onClick={() => setIsOpen(false)}
                className="flex-1 rounded-xl bg-[#0ea5e9] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0284c7]"
              >
                {lang === 'en' ? 'Start free trial' : 'Prueba gratis'}
              </Link>
            </div>
            <div className="mt-2 flex justify-center">
              <div className="flex gap-1 rounded-full bg-slate-100 p-1">
                {(['en', 'es'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                      lang === l
                        ? 'bg-white text-slate-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

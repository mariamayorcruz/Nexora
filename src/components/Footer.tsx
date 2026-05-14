'use client';

import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';

const content = {
  en: {
    tagline: 'CRM + AI + Automation for businesses that want to grow without hiring an agency.',
    product: 'Product',
    productLinks: [
      { href: '#solution', label: 'Features' },
      { href: '#demo', label: 'Demo' },
      { href: '#pricing', label: 'Pricing' },
      { href: '#faq', label: 'FAQ' },
    ],
    access: 'Access',
    accessLinks: [
      { href: '/auth/login', label: 'Log in' },
      { href: '/auth/signup', label: 'Sign up' },
      { href: '/dashboard', label: 'Dashboard' },
    ],
    why: 'Why Nexora',
    whyText: 'Because your business deserves a system that attracts, follows up and closes customers. Powered by AI, without agency fees.',
    legal: 'Legal',
    legalLinks: [
      { href: '/legal/terms', label: 'Terms of Service' },
      { href: '/legal/privacy', label: 'Privacy Policy' },
      { href: '/security/disclosure', label: 'Responsible Disclosure' },
      { href: '/trust', label: 'Trust' },
      { href: '/contact', label: 'Contact' },
    ],
    copyright: '© 2026 Nexora, Inc. All rights reserved. San Francisco, CA.',
  },
  es: {
    tagline: 'CRM + IA + Automatización para negocios que quieren crecer sin contratar una agencia.',
    product: 'Producto',
    productLinks: [
      { href: '#solution', label: 'Características' },
      { href: '#demo', label: 'Demo' },
      { href: '#pricing', label: 'Precios' },
      { href: '#faq', label: 'FAQ' },
    ],
    access: 'Acceso',
    accessLinks: [
      { href: '/auth/login', label: 'Iniciar sesión' },
      { href: '/auth/signup', label: 'Crear cuenta' },
      { href: '/dashboard', label: 'Dashboard' },
    ],
    why: 'Por qué Nexora',
    whyText: 'Porque tu negocio merece un sistema que atraiga, dé seguimiento y cierre clientes. Con IA, sin tarifas de agencia.',
    legal: 'Legal',
    legalLinks: [
      { href: '/legal/terms', label: 'Términos de servicio' },
      { href: '/legal/privacy', label: 'Privacidad' },
      { href: '/security/disclosure', label: 'Divulgación responsable' },
      { href: '/trust', label: 'Confianza' },
      { href: '/contact', label: 'Contacto' },
    ],
    copyright: '© 2026 Nexora, Inc. Todos los derechos reservados. San Francisco, CA.',
  },
};

export default function Footer() {
  const { lang } = useLang();
  const t = content[lang];

  return (
    <footer className="bg-slate-900 px-4 pb-10 pt-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr_0.8fr]">

          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-900 text-sm font-bold">NX</div>
              <div>
                <p className="font-bold text-white">Nexora</p>
                <p className="text-xs text-slate-500">gotnexora.com</p>
              </div>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">{t.tagline}</p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t.product}</h3>
            <div className="mt-4 space-y-3">
              {t.productLinks.map((link) => (
                <Link key={link.href} href={link.href} className="block text-sm text-slate-500 transition hover:text-white">{link.label}</Link>
              ))}
            </div>
          </div>

          {/* Access */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t.access}</h3>
            <div className="mt-4 space-y-3">
              {t.accessLinks.map((link) => (
                <Link key={link.href} href={link.href} className="block text-sm text-slate-500 transition hover:text-white">{link.label}</Link>
              ))}
            </div>
          </div>

          {/* Why */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t.why}</h3>
            <p className="mt-4 text-sm leading-6 text-slate-500">{t.whyText}</p>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t.legal}</h3>
            <div className="mt-4 space-y-3">
              {t.legalLinks.map((link) => (
                <Link key={link.href} href={link.href} className="block text-sm text-slate-500 transition hover:text-white">{link.label}</Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-6">
          <p className="text-xs text-slate-600">{t.copyright}</p>
        </div>
      </div>
    </footer>
  );
}

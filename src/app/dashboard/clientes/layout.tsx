'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppLanguage } from '@/hooks/use-app-language';

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { language } = useAppLanguage();

  const tabActive = (href: string) => {
    if (href === '/dashboard/clientes/lista') {
      return pathname === href || pathname.startsWith('/dashboard/leads/');
    }
    return pathname === href;
  };

  const tabs = [
    { href: '/dashboard/clientes/lista' as const, label: language === 'en' ? 'List' : 'Lista' },
    { href: '/dashboard/clientes/crm' as const, label: 'CRM' },
    { href: '/dashboard/clientes/pipeline' as const, label: language === 'en' ? 'Pipeline' : 'Pipeline' },
    { href: '/dashboard/clientes/calendario' as const, label: language === 'en' ? 'Calendar' : 'Calendario' },
  ];

  return (
    <div className="space-y-6">
      <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-400">
        {language === 'en' ? 'Clients' : 'Clientes'}
      </p>

      <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-3" aria-label={language === 'en' ? 'Clients sections' : 'Secciones de clientes'}>
        {tabs.map((tab) => {
          const active = tabActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

'use client';

import { useAppLanguage } from '@/hooks/use-app-language';

export default function AutomatizacionesLayout({ children }: { children: React.ReactNode }) {
  const { language } = useAppLanguage();

  return (
    <div className="space-y-6">
      <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-400">
        {language === 'en' ? 'Automations' : 'Automatizaciones'}
      </p>
      {children}
    </div>
  );
}

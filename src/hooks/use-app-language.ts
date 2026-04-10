'use client';

import { useEffect, useState } from 'react';
import { APP_LANGUAGE_STORAGE_KEY, normalizeLanguage, type AppLanguage } from '@/lib/i18n';

export function useAppLanguage() {
  const [language, setLanguage] = useState<AppLanguage>('es');

  useEffect(() => {
    const syncLanguage = () => {
      try {
        const savedLanguage = localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
        setLanguage(normalizeLanguage(savedLanguage));
      } catch {
        setLanguage('es');
      }
    };

    syncLanguage();
    window.addEventListener('nexora-language-change', syncLanguage);
    return () => window.removeEventListener('nexora-language-change', syncLanguage);
  }, []);

  const updateLanguage = (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    try {
      localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {}
    window.dispatchEvent(new Event('nexora-language-change'));
  };

  return { language, setLanguage: updateLanguage };
}

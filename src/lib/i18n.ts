export type AppLanguage = 'es' | 'en';

export const APP_LANGUAGE_STORAGE_KEY = 'nexora-language';

export function normalizeLanguage(value?: string | null): AppLanguage {
  return value === 'en' ? 'en' : 'es';
}

export function getLanguageLabel(language: AppLanguage) {
  return language === 'en' ? 'English' : 'Español';
}

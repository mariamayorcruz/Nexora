/**
 * Precios de la suscripción Nexora: un precio base en USD y su equivalente
 * local redondeado. La empresa cobra desde EEUU; el comprador ve su moneda.
 */

import { getCountryConfig, type CountryCode } from '@/lib/countries';

/** Tipos de cambio de referencia (fallback si no hay tasa fresca en BD/env). */
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  CLP: 950,
  ARS: 1050,
  BRL: 5.3,
  COP: 4100,
  MXN: 18,
  PEN: 3.8,
};

export function getFxRate(currency: string): number {
  const fromEnv = Number(process.env[`FX_RATE_${currency}`]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return FALLBACK_RATES[currency] ?? 1;
}

function roundTo(value: number, multiple: number): number {
  if (multiple <= 1) return Math.round(value * 100) / 100;
  return Math.round(value / multiple) * multiple;
}

export interface LocalPrice {
  currency: string;
  amount: number;
  formatted: string;
  usdAmount: number;
  usdFormatted: string;
}

export function localizePriceUsd(usdAmount: number, countryCode?: CountryCode | string | null): LocalPrice {
  const country = getCountryConfig(countryCode);
  const rate = getFxRate(country.currency);
  const raw = usdAmount * rate;
  const amount = roundTo(raw, country.priceRounding);

  const formatted = new Intl.NumberFormat(country.currencyLocale, {
    style: 'currency',
    currency: country.currency,
    minimumFractionDigits: country.fractionDigits,
    maximumFractionDigits: country.fractionDigits,
  }).format(amount);

  const usdFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(usdAmount);

  return { currency: country.currency, amount, formatted, usdAmount, usdFormatted };
}

/** Formatea un monto que ya viene en su moneda (catálogo del cliente). */
export function formatMoney(amount: number, currency: string, locale = 'es-CL'): string {
  const digits = currency === 'CLP' || currency === 'COP' || currency === 'ARS' ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

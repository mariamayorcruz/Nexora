/**
 * Configuración por país: idioma, moneda, métodos de pago y formato.
 * Chile es el mercado principal; el resto de LatAm queda listo para activar.
 */

export type CountryCode =
  | 'CL'
  | 'AR'
  | 'BR'
  | 'CO'
  | 'MX'
  | 'PE'
  | 'US';

export type CheckoutMethod =
  | 'card'
  | 'webpay'
  | 'bank_transfer'
  | 'pix'
  | 'pse'
  | 'oxxo'
  | 'mercadopago';

export type SellerProvider = 'flow' | 'mercadopago' | 'stripe';

export interface CountryConfig {
  code: CountryCode;
  name: string;
  language: 'es' | 'pt' | 'en';
  currency: string;
  currencyLocale: string;
  /** Decimales que se muestran en el precio local. */
  fractionDigits: number;
  /** Redondeo "psicológico" del precio local (múltiplo). */
  priceRounding: number;
  timezone: string;
  phonePrefix: string;
  /** Métodos con los que los compradores del cliente pueden pagarle. */
  checkoutMethods: CheckoutMethod[];
  /** Proveedores que el cliente puede conectar para recibir su dinero. */
  sellerProviders: SellerProvider[];
}

export const DEFAULT_COUNTRY: CountryCode = 'CL';

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  CL: {
    code: 'CL',
    name: 'Chile',
    language: 'es',
    currency: 'CLP',
    currencyLocale: 'es-CL',
    fractionDigits: 0,
    priceRounding: 100,
    timezone: 'America/Santiago',
    phonePrefix: '+56',
    checkoutMethods: ['webpay', 'card', 'bank_transfer', 'mercadopago'],
    sellerProviders: ['flow', 'mercadopago', 'stripe'],
  },
  AR: {
    code: 'AR',
    name: 'Argentina',
    language: 'es',
    currency: 'ARS',
    currencyLocale: 'es-AR',
    fractionDigits: 0,
    priceRounding: 100,
    timezone: 'America/Argentina/Buenos_Aires',
    phonePrefix: '+54',
    checkoutMethods: ['mercadopago', 'card', 'bank_transfer'],
    sellerProviders: ['mercadopago', 'stripe'],
  },
  BR: {
    code: 'BR',
    name: 'Brasil',
    language: 'pt',
    currency: 'BRL',
    currencyLocale: 'pt-BR',
    fractionDigits: 2,
    priceRounding: 1,
    timezone: 'America/Sao_Paulo',
    phonePrefix: '+55',
    checkoutMethods: ['pix', 'card', 'mercadopago'],
    sellerProviders: ['mercadopago', 'stripe'],
  },
  CO: {
    code: 'CO',
    name: 'Colombia',
    language: 'es',
    currency: 'COP',
    currencyLocale: 'es-CO',
    fractionDigits: 0,
    priceRounding: 1000,
    timezone: 'America/Bogota',
    phonePrefix: '+57',
    checkoutMethods: ['pse', 'card', 'mercadopago'],
    sellerProviders: ['mercadopago', 'stripe'],
  },
  MX: {
    code: 'MX',
    name: 'México',
    language: 'es',
    currency: 'MXN',
    currencyLocale: 'es-MX',
    fractionDigits: 0,
    priceRounding: 10,
    timezone: 'America/Mexico_City',
    phonePrefix: '+52',
    checkoutMethods: ['card', 'oxxo', 'mercadopago', 'bank_transfer'],
    sellerProviders: ['mercadopago', 'stripe'],
  },
  PE: {
    code: 'PE',
    name: 'Perú',
    language: 'es',
    currency: 'PEN',
    currencyLocale: 'es-PE',
    fractionDigits: 0,
    priceRounding: 1,
    timezone: 'America/Lima',
    phonePrefix: '+51',
    checkoutMethods: ['card', 'bank_transfer', 'mercadopago'],
    sellerProviders: ['mercadopago', 'stripe'],
  },
  US: {
    code: 'US',
    name: 'United States',
    language: 'en',
    currency: 'USD',
    currencyLocale: 'en-US',
    fractionDigits: 2,
    priceRounding: 1,
    timezone: 'America/New_York',
    phonePrefix: '+1',
    checkoutMethods: ['card'],
    sellerProviders: ['stripe'],
  },
};

export const COUNTRY_LIST: CountryConfig[] = Object.values(COUNTRIES);

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(COUNTRIES, value);
}

export function getCountryConfig(code?: string | null): CountryConfig {
  return isCountryCode(code) ? COUNTRIES[code] : COUNTRIES[DEFAULT_COUNTRY];
}

/** País deducido de la cabecera de geolocalización de Vercel (con fallback a Chile). */
export function countryFromHeaders(headers: Headers): CountryConfig {
  const raw = headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || '';
  return getCountryConfig(raw.toUpperCase());
}

/** Convierte un teléfono local al formato internacional del país. */
export function toInternationalPhone(raw: string, code?: string | null): string {
  const country = getCountryConfig(code);
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  const prefix = country.phonePrefix.replace('+', '');
  if (digits.startsWith(prefix)) return `+${digits}`;
  return `+${prefix}${digits.replace(/^0+/, '')}`;
}

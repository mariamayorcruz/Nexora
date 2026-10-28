/**
 * Stripe minor-unit helpers for API version 2023-10-16.
 *
 * Amounts are integers in the currency's minor unit. The exponent comes from
 * an explicit table, never from "any three letters means two decimals".
 *
 * Exponent 0 — zero-decimal list on https://docs.stripe.com/currencies
 * (read 2026-10-28), excluding UGX: BIF CLP DJF GNF JPY KMF KRW MGA PYG RWF
 * VND VUV XAF XOF XPF.
 *
 * Exponent 2 — Stripe special cases ISK and UGX (API still uses two decimals;
 * the fractional part is always 00). HUF and TWD charges are two-decimal;
 * their payout exception is not used for invoice or subscription amounts.
 * Every other exponent-2 code is a presentment currency named on the current
 * currencies page or on the 2022-12-31 Stripe currencies page
 * (https://web.archive.org/web/20221231002856/https://stripe.com/docs/currencies)
 * and is not zero-decimal or three-decimal.
 *
 * Exponent 3 — that same archived Stripe page, section "Three-decimal
 * currencies": BHD JOD KWD OMR TND. The amount is thousandths (5.120 KWD is
 * 5120). Stripe required the last digit to be 0 for PaymentIntents, Refunds
 * and Disputes. This table does not round a stored amount to the nearest ten.
 * The current markdown export of the currencies page no longer prints that
 * section; these five codes are still not treated as exponent 2.
 * https://support.stripe.com/questions/which-payments-methods-and-products-are-available-in-the-uae
 * is the support article that names three-decimal presentment for UAE
 * accounts. Its rendered body was not available as text here.
 *
 * Any other code, including a well-formed unknown such as ZZZ, has exponent
 * null. Callers must not divide it.
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

const TWO_DECIMAL_CURRENCIES = new Set([
  'AED',
  'AFN',
  'ALL',
  'AMD',
  'ANG',
  'AOA',
  'ARS',
  'AUD',
  'AWG',
  'AZN',
  'BAM',
  'BBD',
  'BDT',
  'BGN',
  'BMD',
  'BND',
  'BOB',
  'BRL',
  'BSD',
  'BWP',
  'BYN',
  'BZD',
  'CAD',
  'CDF',
  'CHF',
  'CNY',
  'COP',
  'CRC',
  'CVE',
  'CZK',
  'DKK',
  'DOP',
  'DZD',
  'EGP',
  'ETB',
  'EUR',
  'FJD',
  'FKP',
  'GBP',
  'GEL',
  'GIP',
  'GMD',
  'GTQ',
  'GYD',
  'HKD',
  'HNL',
  'HRK',
  'HTG',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'ISK',
  'JMD',
  'KES',
  'KGS',
  'KHR',
  'KYD',
  'KZT',
  'LAK',
  'LBP',
  'LKR',
  'LRD',
  'LSL',
  'MAD',
  'MDL',
  'MKD',
  'MMK',
  'MNT',
  'MOP',
  'MRO',
  'MUR',
  'MVR',
  'MWK',
  'MXN',
  'MYR',
  'MZN',
  'NAD',
  'NGN',
  'NIO',
  'NOK',
  'NPR',
  'NZD',
  'PAB',
  'PEN',
  'PGK',
  'PHP',
  'PKR',
  'PLN',
  'QAR',
  'RON',
  'RSD',
  'RUB',
  'SAR',
  'SBD',
  'SCR',
  'SEK',
  'SGD',
  'SHP',
  'SLE',
  'SLL',
  'SOS',
  'SRD',
  'STD',
  'SZL',
  'THB',
  'TJS',
  'TOP',
  'TRY',
  'TTD',
  'TWD',
  'TZS',
  'UAH',
  'UGX',
  'USD',
  'UYU',
  'UZS',
  'WST',
  'XCD',
  'XCG',
  'YER',
  'ZAR',
  'ZMW',
]);

const INT4_MAX = 2147483647;

export function currencyExponent(currency: string | null | undefined): number | null {
  if (!currency) return null;
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (TWO_DECIMAL_CURRENCIES.has(code)) return 2;
  return null;
}

/** Positive integer half-up: (numerator + denominator/2) / denominator. */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error('division denominator must be positive');
  }
  if (numerator < 0n) {
    throw new Error('division numerator must be non-negative');
  }
  return (numerator + denominator / 2n) / denominator;
}

export function asMinor(value: bigint | number | string | null | undefined): bigint | null {
  if (value == null) return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('minor amount must be a non-negative integer');
    }
    return BigInt(value);
  }
  if (!/^\d+$/.test(value)) {
    throw new Error('minor amount must be a non-negative integer string');
  }
  return BigInt(value);
}

export function minorToString(value: bigint): string {
  return value.toString();
}

export function assertUnixSeconds(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > INT4_MAX) {
    throw new Error(`${label} is not a unix timestamp that fits a 32-bit integer`);
  }
  return value;
}

/**
 * Legacy Float mirror. Collected revenue does not read this value.
 * Unknown exponents are not divided by 100; the integer minor amount is
 * stored only when it is a safe integer.
 */
export function compatibilityMajorAmount(amountMinor: bigint, currency: string): number {
  const exponent = currencyExponent(currency);
  if (exponent == null) {
    if (amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('minor amount does not fit the legacy amount column');
    }
    return Number(amountMinor);
  }
  const factor = 10n ** BigInt(exponent);
  const major = amountMinor / factor;
  const fraction = amountMinor % factor;
  const text = exponent === 0 ? major.toString() : `${major.toString()}.${fraction.toString().padStart(exponent, '0')}`;
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new Error('legacy amount mirror is not finite');
  }
  return value;
}

export function formatMinorUnits(
  amountMinor: bigint | number | string,
  currency: string,
  exponent: number | null
): string {
  const minor = asMinor(amountMinor);
  if (minor == null) return 'No calculado';
  const code = currency.trim().toUpperCase();
  if (exponent == null) {
    return `${minor.toString()} ${code} (unidad menor)`;
  }
  if (exponent === 0) {
    return `${minor.toString()} ${code}`;
  }
  const factor = 10n ** BigInt(exponent);
  const major = minor / factor;
  const fraction = (minor % factor).toString().padStart(exponent, '0');
  return `${major.toString()}.${fraction} ${code}`;
}

export function formatMoneyLines(
  lines: Array<{ amountMinor: string; currency: string; exponent: number | null }> | null | undefined,
  whenEmpty: string
): string {
  if (!lines || lines.length === 0) return whenEmpty;
  return lines.map((line) => formatMinorUnits(line.amountMinor, line.currency, line.exponent)).join(' · ');
}

/**
 * Monthly minor units for one subscription.
 * Annual prices are rounded per subscription, then summed.
 * Two annual prices of 100 become 8 + 8 = 16, not round(200 / 12) = 17.
 * ARR is that already-rounded monthly sum times 12, so it can differ from
 * the sum of the list annual prices.
 */
export function monthlyRecurringMinor(input: {
  amountMinor: bigint;
  interval: string;
  intervalCount: number;
}): bigint | null {
  if (!Number.isInteger(input.intervalCount) || input.intervalCount < 1) return null;
  const count = BigInt(input.intervalCount);
  if (input.interval === 'month') {
    return divRoundHalfUp(input.amountMinor, count);
  }
  if (input.interval === 'year') {
    return divRoundHalfUp(input.amountMinor, 12n * count);
  }
  return null;
}

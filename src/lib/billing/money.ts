/**
 * Stripe minor-unit helpers for API version 2023-10-16.
 *
 * Source: https://docs.stripe.com/currencies (read for this implementation).
 * API amounts are integers in the currency's minor unit.
 * Two-decimal currencies use exponent 2 (1000 = 10.00).
 * Zero-decimal currencies use exponent 0 (500 JPY = 500).
 * UGX is listed as zero-decimal but Stripe still requires a two-decimal
 * representation (500 = 5 UGX, decimals always 00). ISK is the same.
 * HUF and TWD charges are two-decimal (payouts are the special case).
 * Three-decimal ISO currencies are not given a special Stripe presentment
 * exponent here; a 3-letter code that is not zero-decimal uses exponent 2.
 * A code that is not three letters has no exponent and must not be divided.
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

const INT4_MAX = 2147483647;

export function currencyExponent(currency: string | null | undefined): number | null {
  if (!currency) return null;
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  if (code === 'UGX') return 2;
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  return 2;
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

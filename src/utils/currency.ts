import { type CurrencyCode, getCurrencyMeta } from '@/constants/currencies';

/**
 * All monetary amounts are stored and passed through the financial engine
 * as integer minor units (e.g. cents for USD, whole units for XAF since it
 * has zero decimal digits). This keeps every calculation in the app on
 * integer math and avoids floating-point drift in balances and sums.
 */
export type MinorUnits = number;

export function majorToMinor(amountMajor: number, currency: CurrencyCode): MinorUnits {
  const { decimalDigits } = getCurrencyMeta(currency);
  return Math.round(amountMajor * 10 ** decimalDigits);
}

export function minorToMajor(amountMinor: MinorUnits, currency: CurrencyCode): number {
  const { decimalDigits } = getCurrencyMeta(currency);
  return amountMinor / 10 ** decimalDigits;
}

export interface FormatMoneyOptions {
  /** Show the currency symbol/code. Defaults to true. */
  showSymbol?: boolean;
  /** Force a sign ("+" / "-") even for positive amounts. Defaults to false. */
  forceSign?: boolean;
}

/**
 * Formats a minor-units integer amount into a display string using the
 * currency's own decimal digits and symbol placement, e.g.
 * formatMoney(425000, 'XAF') -> "425,000 FCFA"
 * formatMoney(150050, 'USD') -> "$1,500.50"
 */
export function formatMoney(amountMinor: MinorUnits, currency: CurrencyCode, options: FormatMoneyOptions = {}): string {
  const { showSymbol = true, forceSign = false } = options;
  const meta = getCurrencyMeta(currency);
  const sign = amountMinor < 0 ? '-' : forceSign ? '+' : '';
  const absMinor = Math.abs(amountMinor);
  const major = absMinor / 10 ** meta.decimalDigits;

  const [wholePart, fractionPart] = major.toFixed(meta.decimalDigits).split('.');
  const groupedWhole = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const numberString = fractionPart ? `${groupedWhole}.${fractionPart}` : groupedWhole;

  if (!showSymbol) {
    return `${sign}${numberString}`;
  }

  return meta.symbolPosition === 'before'
    ? `${sign}${meta.symbol}${numberString}`
    : `${sign}${numberString} ${meta.symbol}`;
}

/**
 * Parses a user-typed amount string (in major units, e.g. "12,500.50" or
 * "12500") into integer minor units for the given currency. Returns null
 * for unparseable input so callers can show a validation error.
 */
export function parseMoneyInput(input: string, currency: CurrencyCode): MinorUnits | null {
  const cleaned = input.replace(/[,\s]/g, '').trim();
  if (cleaned === '' || Number.isNaN(Number(cleaned))) {
    return null;
  }
  return majorToMinor(Number(cleaned), currency);
}

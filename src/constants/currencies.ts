export type CurrencyCode = 'XAF' | 'USD' | 'EUR' | 'GBP';

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  symbol: string;
  /** Number of digits after the decimal separator (ISO 4217 minor unit). XAF is zero-decimal. */
  decimalDigits: number;
  symbolPosition: 'before' | 'after';
}

/**
 * Supported currencies. XAF ships first as the primary target market;
 * add new entries here (and nowhere else) to support another currency —
 * everything else (storage, formatting, parsing) reads from this table.
 */
export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  XAF: { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', decimalDigits: 0, symbolPosition: 'after' },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimalDigits: 2, symbolPosition: 'before' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimalDigits: 2, symbolPosition: 'after' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimalDigits: 2, symbolPosition: 'before' },
};

export const DEFAULT_CURRENCY: CurrencyCode = 'XAF';

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value in CURRENCIES;
}

export function getCurrencyMeta(code: CurrencyCode): CurrencyMeta {
  const meta = CURRENCIES[code];
  if (!meta) {
    throw new Error(`Unsupported currency code: ${code}`);
  }
  return meta;
}

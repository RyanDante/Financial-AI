import { settingsRepository } from '@/database/repositories';
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from '@/constants/currencies';

export const CURRENCY_SETTING_KEY = 'default_currency';

/** The stored currency setting as a supported code, or the app default. */
export function resolveCurrency(setting: string | null | undefined): CurrencyCode {
  return setting && isCurrencyCode(setting) ? setting : DEFAULT_CURRENCY;
}

/**
 * The currency the user chose (onboarding / Settings). Totals, reserve and
 * AI answers use it; code outside React reads it here instead of assuming
 * DEFAULT_CURRENCY.
 */
export async function getActiveCurrency(): Promise<CurrencyCode> {
  return resolveCurrency(await settingsRepository.getSetting(CURRENCY_SETTING_KEY));
}

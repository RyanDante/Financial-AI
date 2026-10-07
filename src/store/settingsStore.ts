import { create } from 'zustand';
import { settingsRepository } from '@/database/repositories';
import { DEFAULT_CURRENCY, type CurrencyCode } from '@/constants/currencies';
import { CURRENCY_SETTING_KEY, resolveCurrency } from '@/features/currency/activeCurrency';
import { useFinanceStore } from './financeStore';

interface SettingsState {
  defaultCurrency: CurrencyCode;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  setDefaultCurrency: (currency: CurrencyCode) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  defaultCurrency: DEFAULT_CURRENCY,
  isLoaded: false,

  loadSettings: async () => {
    const value = await settingsRepository.getSetting(CURRENCY_SETTING_KEY);
    set({ defaultCurrency: resolveCurrency(value), isLoaded: true });
  },

  setDefaultCurrency: async (currency: CurrencyCode) => {
    await settingsRepository.setSetting(CURRENCY_SETTING_KEY, currency);
    set({ defaultCurrency: currency });
    // Totals, obligations and the reserve are per currency.
    await useFinanceStore.getState().loadAll();
  },
}));

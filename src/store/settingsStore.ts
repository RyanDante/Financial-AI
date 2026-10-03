import { create } from 'zustand';
import { settingsRepository } from '@/database/repositories';
import { DEFAULT_CURRENCY, type CurrencyCode } from '@/constants/currencies';

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
    const value = await settingsRepository.getSetting('default_currency');
    set({ defaultCurrency: (value as CurrencyCode) ?? DEFAULT_CURRENCY, isLoaded: true });
  },

  setDefaultCurrency: async (currency: CurrencyCode) => {
    await settingsRepository.setSetting('default_currency', currency);
    set({ defaultCurrency: currency });
  },
}));

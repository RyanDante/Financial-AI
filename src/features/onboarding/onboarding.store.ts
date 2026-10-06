import { create } from 'zustand';
import { settingsRepository, transactionsRepository } from '@/database/repositories';
import { needsOnboarding, ONBOARDED_KEY } from './onboarding';

interface OnboardingState {
  status: 'unknown' | 'needed' | 'done';
  loadOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  status: 'unknown',

  loadOnboarding: async () => {
    const [flag, transactions] = await Promise.all([settingsRepository.getSetting(ONBOARDED_KEY), transactionsRepository.listTransactions({ limit: 1 })]);
    set({ status: needsOnboarding(flag, transactions.length) ? 'needed' : 'done' });
  },

  completeOnboarding: async () => {
    await settingsRepository.setSetting(ONBOARDED_KEY, 'true');
    set({ status: 'done' });
  },
}));

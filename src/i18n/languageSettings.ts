import { settingsRepository } from '@/database/repositories';
import { useLanguageStore, type LanguageSetting } from './language';

const LANGUAGE_KEY = 'language';

/** Restores the saved language (Settings › Language) at startup. */
export async function loadLanguage(): Promise<void> {
  const stored = await settingsRepository.getSetting(LANGUAGE_KEY);
  useLanguageStore.getState().apply(stored === 'en' || stored === 'fr' ? stored : 'system');
}

export async function setLanguage(setting: LanguageSetting): Promise<void> {
  await settingsRepository.setSetting(LANGUAGE_KEY, setting);
  useLanguageStore.getState().apply(setting);
}

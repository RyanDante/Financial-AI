import { create } from 'zustand';
import { getLocales } from 'expo-localization';

export type Language = 'en' | 'fr';
export type LanguageSetting = 'system' | Language;

/** The phone's language when F-AI speaks it, else English. */
export function systemLanguage(): Language {
  try {
    return getLocales()[0]?.languageCode === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

export function resolveLanguage(setting: LanguageSetting): Language {
  return setting === 'system' ? systemLanguage() : setting;
}

interface LanguageState {
  setting: LanguageSetting;
  language: Language;
  /** Applies a setting in memory; persistence is in languageSettings.ts. */
  apply: (setting: LanguageSetting) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  setting: 'system',
  language: systemLanguage(),
  apply: (setting) => set({ setting, language: resolveLanguage(setting) }),
}));

/** The current language, for code outside React (AI agents, notifications). */
export function getLanguage(): Language {
  return useLanguageStore.getState().language;
}

/** BCP 47 locale for dates (toLocaleDateString) in the current language. */
export function getLocale(): string {
  return getLanguage() === 'fr' ? 'fr-FR' : 'en-GB';
}

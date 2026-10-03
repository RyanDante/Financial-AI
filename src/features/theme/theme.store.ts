import { create } from 'zustand';
import { colorScheme } from 'nativewind';
import { settingsRepository } from '@/database/repositories';
import { isThemeMode, type ThemeMode } from './theme.types';

const THEME_MODE_KEY = 'theme_mode';
const DEFAULT_MODE: ThemeMode = 'dark';

interface ThemeState {
  mode: ThemeMode;
  isLoaded: boolean;
  loadTheme: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

/**
 * The app defaults to dark regardless of OS appearance (matching the design
 * direction the rest of the UI was built for) unless the user has
 * explicitly picked a mode in Settings — this mirrors `settingsStore`'s
 * pattern for defaultCurrency. `colorScheme.set()` (nativewind) is what
 * actually repaints every `dark:`-aware className app-wide; this store
 * just remembers the choice and persists it.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: DEFAULT_MODE,
  isLoaded: false,

  loadTheme: async () => {
    const saved = await settingsRepository.getSetting(THEME_MODE_KEY);
    const mode = saved && isThemeMode(saved) ? saved : DEFAULT_MODE;
    colorScheme.set(mode);
    set({ mode, isLoaded: true });
  },

  setMode: async (mode: ThemeMode) => {
    colorScheme.set(mode);
    await settingsRepository.setSetting(THEME_MODE_KEY, mode);
    set({ mode });
  },
}));

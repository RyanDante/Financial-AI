import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
import { settingsRepository } from '@/database/repositories';
import { shouldLockOnResume } from './appLock';

const APP_LOCK_KEY = 'app_lock_enabled';

interface AppLockState {
  enabled: boolean;
  locked: boolean;
  backgroundedAt: number | null;
  /** Reads the setting; a cold start with the lock on starts locked. */
  loadLock: () => Promise<void>;
  /** Turning the lock on asks the user to authenticate once, so nobody locks themselves out. Returns a message when it can't be turned on. */
  setEnabled: (enabled: boolean) => Promise<string | null>;
  unlock: () => Promise<boolean>;
  onBackground: () => void;
  onForeground: () => void;
}

/**
 * The app lock (Settings › Security): fingerprint, Face ID or the device
 * passcode on open and after a minute in the background. Face ID needs a
 * development build on iOS; Expo Go falls back to the passcode there.
 */
export const useAppLockStore = create<AppLockState>((set, get) => ({
  enabled: false,
  locked: false,
  backgroundedAt: null,

  loadLock: async () => {
    const enabled = (await settingsRepository.getSetting(APP_LOCK_KEY)) === 'true';
    set({ enabled, locked: enabled });
  },

  setEnabled: async (enabled) => {
    if (enabled) {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (level === LocalAuthentication.SecurityLevel.NONE) {
        return 'Set up a screen lock (PIN, pattern, fingerprint or face) on this phone first.';
      }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on app lock', cancelLabel: 'Cancel' });
      if (!result.success) return result.error === 'user_cancel' || result.error === 'system_cancel' ? null : "Couldn't confirm it's you, so the lock stays off.";
    }
    await settingsRepository.setSetting(APP_LOCK_KEY, enabled ? 'true' : 'false');
    set({ enabled, locked: false });
    return null;
  },

  unlock: async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock F-AI', cancelLabel: 'Cancel' });
    if (result.success) set({ locked: false, backgroundedAt: null });
    return result.success;
  },

  onBackground: () => {
    if (get().backgroundedAt === null) set({ backgroundedAt: Date.now() });
  },

  onForeground: () => {
    const { enabled, backgroundedAt, locked } = get();
    set({ locked: locked || shouldLockOnResume(enabled, backgroundedAt, Date.now()), backgroundedAt: null });
  },
}));

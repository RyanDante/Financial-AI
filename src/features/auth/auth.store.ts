import { create } from 'zustand';
import { settingsRepository } from '@/database/repositories';
import { isFirebaseConfigured } from '@/services/firebase/config';
import * as authService from './auth.service';
import { ensureUserProfile } from './auth.repository';
import { getAuthErrorMessage, mapFirebaseUser } from './auth.mapper';
import type { AuthStatus, AuthUser } from './auth.types';

const WORKSPACE_OWNER_KEY = 'workspace_owner_uid';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  /**
   * True when this device's local SQLite data was already claimed by a
   * different signed-in account. We never auto-merge or auto-switch local
   * data between accounts (see docs/FIREBASE.md "Local workspace
   * ownership") — when this is true, sync refuses to run until the user
   * explicitly resolves it, so one account's financial data can never leak
   * into another's view on a shared device.
   */
  workspaceMismatch: boolean;
  _unsubscribe: (() => void) | null;
  initialize: () => void;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

async function resolveWorkspaceOwnership(uid: string): Promise<boolean> {
  const owner = await settingsRepository.getSetting(WORKSPACE_OWNER_KEY);
  if (!owner) {
    await settingsRepository.setSetting(WORKSPACE_OWNER_KEY, uid);
    return false;
  }
  return owner !== uid;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  error: null,
  workspaceMismatch: false,
  _unsubscribe: null,

  initialize: () => {
    if (get()._unsubscribe) return;

    // Firebase isn't configured until .env has real project values (see
    // src/services/firebase/config.ts) — most importantly, right after
    // cloning the repo before anyone has set that up. The app must keep
    // working in local-only mode in that case, not throw on startup.
    if (!isFirebaseConfigured()) {
      set({ status: 'unauthenticated' });
      return;
    }

    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      const user = mapFirebaseUser(firebaseUser);
      if (!user) {
        set({ status: 'unauthenticated', user: null, workspaceMismatch: false });
        return;
      }

      const workspaceMismatch = await resolveWorkspaceOwnership(user.uid);
      try {
        await ensureUserProfile(user);
      } catch {
        // Offline or Firestore unreachable — the local session is still valid;
        // the profile doc gets created on the next successful sync attempt.
      }
      set({ status: 'authenticated', user, workspaceMismatch });
    });

    set({ _unsubscribe: unsubscribe });
  },

  signUp: async (email, password, displayName) => {
    set({ error: null });
    try {
      await authService.signUp(email, password, displayName);
    } catch (error) {
      set({ error: getAuthErrorMessage(error) });
      throw error;
    }
  },

  signIn: async (email, password) => {
    set({ error: null });
    try {
      await authService.signIn(email, password);
    } catch (error) {
      set({ error: getAuthErrorMessage(error) });
      throw error;
    }
  },

  signOut: async () => {
    await authService.signOut();
  },

  resetPassword: async (email) => {
    set({ error: null });
    try {
      await authService.sendPasswordReset(email);
    } catch (error) {
      set({ error: getAuthErrorMessage(error) });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

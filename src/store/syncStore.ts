import { create } from 'zustand';
import { runFullSync } from '@/services/sync/sync.service';
import { processPendingUploads } from '@/services/cloud/storage';
import { subscribeToReconnect } from '@/services/connectivity';
import { useAuthStore } from '@/features/auth/auth.store';
import type { EntitySyncResult, SyncStatus } from '@/services/sync/sync.types';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  lastResults: EntitySyncResult[] | null;
  errorMessage: string | null;
  /** Separate from the main status — a failed attachment upload shouldn't make the whole sync read as "failed" when the financial data itself synced fine. */
  attachmentUploadError: string | null;
  _unsubscribeReconnect: (() => void) | null;
  runSync: () => Promise<void>;
  /** Starts the reconnect-triggered sync listener. Safe to call more than once. */
  initialize: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  lastSyncedAt: null,
  lastResults: null,
  errorMessage: null,
  attachmentUploadError: null,
  _unsubscribeReconnect: null,

  runSync: async () => {
    const auth = useAuthStore.getState();
    if (auth.status !== 'authenticated' || !auth.user) {
      set({ status: 'idle' });
      return;
    }
    if (auth.workspaceMismatch) {
      set({
        status: 'blocked',
        errorMessage: "This device's local data belongs to a different account — sign in with that account to sync it, or start a new workspace.",
      });
      return;
    }

    set({ status: 'syncing', errorMessage: null });

    const outcome = await runFullSync(auth.user.uid);

    if (!outcome.ok && outcome.reason === 'offline') {
      set({ status: 'offline' });
      return;
    }

    if (!outcome.ok) {
      const firstFailure = outcome.results?.find((r) => r.failed > 0 || r.error);
      set({
        status: 'error',
        errorMessage: firstFailure?.error ?? `Some ${firstFailure?.tableName ?? 'records'} failed to sync — will retry next time.`,
        lastResults: outcome.results ?? null,
      });
      return;
    }

    // Attachment uploads run after the financial data sync, using the same
    // connectivity we just confirmed. A failed upload is logged separately
    // (see attachmentUploadError) rather than flipping the overall status —
    // it retries automatically on the next sync pass either way.
    const uploadResult = await processPendingUploads(auth.user.uid);

    set({
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
      lastResults: outcome.results ?? null,
      errorMessage: null,
      attachmentUploadError:
        uploadResult.failed > 0 ? `${uploadResult.failed} attachment${uploadResult.failed > 1 ? 's' : ''} failed to upload — will retry next sync.` : null,
    });
  },

  initialize: () => {
    if (get()._unsubscribeReconnect) return;
    const unsubscribe = subscribeToReconnect(() => {
      if (useAuthStore.getState().status === 'authenticated') {
        get().runSync();
      }
    });
    set({ _unsubscribeReconnect: unsubscribe });
  },
}));

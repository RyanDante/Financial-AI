import { create } from 'zustand';

interface UIState {
  isAppReady: boolean;
  activeTransactionFilter: 'all' | 'income' | 'expense';
  setAppReady: (ready: boolean) => void;
  setTransactionFilter: (filter: UIState['activeTransactionFilter']) => void;
}

/** Purely ephemeral, device-local UI state — never persisted, never touches the database. */
export const useUIStore = create<UIState>((set) => ({
  isAppReady: false,
  activeTransactionFilter: 'all',
  setAppReady: (ready) => set({ isAppReady: ready }),
  setTransactionFilter: (filter) => set({ activeTransactionFilter: filter }),
}));

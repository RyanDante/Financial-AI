import { create } from 'zustand';
import { aiRepository } from '@/database/repositories';
import { sendUserMessage } from '@/ai';
import type { AIConversation, AIMessage } from '@/types/ai';

/** A message on screen: saved ones, plus the question being sent or one that failed to send. */
export type ChatMessage = AIMessage & { status?: 'sending' | 'failed' };

interface AIState {
  /** null until the first question of a new chat is sent. */
  conversationId: string | null;
  conversations: AIConversation[];
  messages: ChatMessage[];
  isLoaded: boolean;
  isSending: boolean;
  /** What the copilot is doing right now, e.g. "Reading your debts…". */
  step: string | null;
  /** Opens the most recent conversation, once. */
  load: () => Promise<void>;
  loadConversations: () => Promise<void>;
  newChat: () => void;
  openConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  /** Sends a failed question again. */
  retry: (messageId: string) => Promise<void>;
}

export const useAIStore = create<AIState>((set, get) => ({
  conversationId: null,
  conversations: [],
  messages: [],
  isLoaded: false,
  isSending: false,
  step: null,

  load: async () => {
    if (get().isLoaded) return;
    const conversations = await aiRepository.listConversations();
    const latest = conversations[0];
    const messages = latest ? await aiRepository.listMessages(latest.id) : [];
    set({ conversations, conversationId: latest?.id ?? null, messages, isLoaded: true });
  },

  loadConversations: async () => {
    set({ conversations: await aiRepository.listConversations() });
  },

  newChat: () => {
    if (get().isSending) return;
    set({ conversationId: null, messages: [] });
  },

  openConversation: async (id) => {
    if (get().isSending) return;
    const messages = await aiRepository.listMessages(id);
    set({ conversationId: id, messages });
  },

  deleteConversation: async (id) => {
    await aiRepository.deleteConversation(id);
    const conversations = await aiRepository.listConversations();
    set((state) => (state.conversationId === id ? { conversations, conversationId: null, messages: [] } : { conversations }));
  },

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().isSending) return;

    const pendingId = `pending-${Date.now()}`;
    const pending: ChatMessage = {
      id: pendingId,
      conversationId: get().conversationId ?? '',
      role: 'user',
      content: trimmed,
      toolCalls: null,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    set((state) => ({ messages: [...state.messages, pending], isSending: true, step: null }));

    try {
      let conversationId = get().conversationId;
      if (!conversationId) {
        conversationId = (await aiRepository.createConversation(null)).id;
        set({ conversationId });
      }
      const { userMessage, assistantMessage } = await sendUserMessage(conversationId, trimmed, { onStep: (step) => set({ step }) });
      set((state) => ({ messages: [...state.messages.filter((m) => m.id !== pendingId), userMessage, assistantMessage] }));
      get().loadConversations();
    } catch (error) {
      if (__DEV__) console.warn('[ai] send failed', error);
      set((state) => ({ messages: state.messages.map((m) => (m.id === pendingId ? { ...m, status: 'failed' } : m)) }));
    } finally {
      set({ isSending: false, step: null });
    }
  },

  retry: async (messageId) => {
    const failed = get().messages.find((m) => m.id === messageId && m.status === 'failed');
    if (!failed || get().isSending) return;
    set((state) => ({ messages: state.messages.filter((m) => m.id !== messageId) }));
    await get().sendMessage(failed.content);
  },
}));

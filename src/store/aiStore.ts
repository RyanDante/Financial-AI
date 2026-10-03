import { create } from 'zustand';
import { aiRepository } from '@/database/repositories';
import { sendUserMessage } from '@/ai';
import type { AIMessage } from '@/types/ai';

interface AIState {
  conversationId: string | null;
  messages: AIMessage[];
  isSending: boolean;
  ensureConversation: () => Promise<string>;
  sendMessage: (text: string) => Promise<void>;
}

export const useAIStore = create<AIState>((set, get) => ({
  conversationId: null,
  messages: [],
  isSending: false,

  ensureConversation: async () => {
    const existing = get().conversationId;
    if (existing) return existing;

    const conversations = await aiRepository.listConversations();
    const conversation = conversations[0] ?? (await aiRepository.createConversation('F-AI Assistant'));
    const messages = await aiRepository.listMessages(conversation.id);
    set({ conversationId: conversation.id, messages });
    return conversation.id;
  },

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    set({ isSending: true });
    const conversationId = await get().ensureConversation();

    const { userMessage, assistantMessage } = await sendUserMessage(conversationId, trimmed);
    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isSending: false,
    }));
  },
}));

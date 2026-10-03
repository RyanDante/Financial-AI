import type { ToolCallRecord } from '@/types/ai';
import type { ToolRegistry } from '../tools/types';

export interface AIProviderMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIProviderResult {
  content: string;
  toolCalls: ToolCallRecord[];
}

/**
 * Provider-agnostic interface the AI screen/store talks to. The UI never
 * imports a specific vendor SDK — it only ever sees this shape, so a local
 * on-device model and a cloud model are interchangeable behind the AI
 * Router (see src/ai/router).
 */
export interface AIProvider {
  readonly id: string;
  readonly isAvailableOffline: boolean;
  generateReply(params: { messages: AIProviderMessage[]; tools: ToolRegistry }): Promise<AIProviderResult>;
}

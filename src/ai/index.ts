import { aiRepository } from '@/database/repositories';
import type { AIMessage } from '@/types/ai';
import { ToolRegistry } from './tools/types';
import { registerFinancialTools } from './tools/financialTools';
import { MockAIProvider } from './providers/mockProvider';
import type { AIProviderMessage } from './providers/types';
import { AIRouter } from './router';

export const toolRegistry = new ToolRegistry();
registerFinancialTools(toolRegistry);

const mockProvider = new MockAIProvider();
export const aiRouter = new AIRouter({ fallback: mockProvider });

export interface SendUserMessageResult {
  userMessage: AIMessage;
  assistantMessage: AIMessage;
}

/**
 * The single entry point the AI store/UI calls: persists the user's
 * message, routes to a provider, lets it call tools, and persists the
 * assistant's reply (with the tool calls it made attached) so the
 * conversation is fully reconstructable from the database alone.
 */
export async function sendUserMessage(conversationId: string, text: string): Promise<SendUserMessageResult> {
  const userMessage = await aiRepository.addMessage(conversationId, 'user', text);
  const history = await aiRepository.listMessages(conversationId);

  const providerMessages: AIProviderMessage[] = history
    .filter((m): m is typeof m & { role: 'user' | 'assistant' | 'system' } => m.role !== 'tool')
    .map((m) => ({ role: m.role, content: m.content }));

  const provider = aiRouter.selectProvider();
  const result = await provider.generateReply({ messages: providerMessages, tools: toolRegistry });

  const assistantMessage = await aiRepository.addMessage(conversationId, 'assistant', result.content, result.toolCalls);

  return { userMessage, assistantMessage };
}

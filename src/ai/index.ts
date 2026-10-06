import { aiRepository } from '@/database/repositories';
import type { AIMessage } from '@/types/ai';
import { ToolRegistry } from './tools/types';
import { registerFinancialTools } from './tools/financialTools';
import { MockAIProvider } from './providers/mockProvider';
import type { AIProviderMessage } from './providers/types';
import { AIRouter } from './router';
import { aiConfig } from './config';
import { createLLMClient } from './llm/createClient';
import { LLMProvider } from './providers/llmProvider';

export const toolRegistry = new ToolRegistry();
registerFinancialTools(toolRegistry);

const mockProvider = new MockAIProvider();
const { client: llmClient, problem: clientProblem } = createLLMClient(aiConfig);

/**
 * `cloud` is the configured model (Claude, OpenAI or Gemini) when .env sets
 * one; otherwise every message goes to the deterministic MockAIProvider.
 * The model path itself still falls back to the deterministic agents when
 * offline, so the copilot always answers.
 */
export const aiRouter = new AIRouter({
  fallback: mockProvider,
  cloud: llmClient ? new LLMProvider(llmClient, toolRegistry) : undefined,
});

/** What's answering, for Settings › About and the AI screen. */
export const aiStatus = {
  provider: llmClient ? aiConfig.provider : ('mock' as const),
  model: llmClient?.model ?? null,
  problem: aiConfig.problem ?? clientProblem,
};

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

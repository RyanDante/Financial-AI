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
import { conversationTitle, describeToolStep } from './chatText';

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

export interface SendOptions {
  /** Called with a short description each time the copilot reads data (e.g. "Reading your debts…"). */
  onStep?: (step: string) => void;
}

/**
 * The single entry point the AI store/UI calls: routes the question to a
 * provider, lets it call tools, then persists the question and the reply
 * (with the tool calls it made attached) so the conversation is fully
 * reconstructable from the database alone.
 *
 * Nothing is saved until the reply exists, so a failure leaves no
 * half-finished exchange behind and the user can simply retry.
 */
export async function sendUserMessage(conversationId: string, text: string, options: SendOptions = {}): Promise<SendUserMessageResult> {
  const history = await aiRepository.listMessages(conversationId);

  const providerMessages: AIProviderMessage[] = [
    ...history
      .filter((m): m is typeof m & { role: 'user' | 'assistant' | 'system' } => m.role !== 'tool')
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: text },
  ];

  const provider = aiRouter.selectProvider();
  const result = await provider.generateReply({ messages: providerMessages, tools: observeTools(toolRegistry, options.onStep) });

  const userMessage = await aiRepository.addMessage(conversationId, 'user', text);
  const assistantMessage = await aiRepository.addMessage(conversationId, 'assistant', result.content, result.toolCalls);
  if (history.length === 0) await aiRepository.updateConversationTitle(conversationId, conversationTitle(text));

  return { userMessage, assistantMessage };
}

/** The same registry, reporting each tool it runs. */
function observeTools(registry: ToolRegistry, onStep?: (step: string) => void): ToolRegistry {
  if (!onStep) return registry;
  const observed = Object.create(registry) as ToolRegistry;
  observed.execute = (name, input) => {
    onStep(describeToolStep(name));
    return registry.execute(name, input);
  };
  return observed;
}

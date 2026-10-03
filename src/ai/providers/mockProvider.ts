import { DEFAULT_CURRENCY } from '@/constants/currencies';
import { defaultOrchestrator } from '../agents';
import type { AIProvider, AIProviderMessage, AIProviderResult } from './types';
import type { ToolRegistry } from '../tools/types';

/**
 * A deterministic, offline, zero-cost provider that demonstrates the full
 * pipeline (intent -> Orchestrator -> specialist agent -> tool -> engine
 * result -> labeled explanation) without calling any real LLM. It stands
 * in for both the future local and cloud providers — the AI screen,
 * store, and router all talk to it through the same AIProvider interface
 * they'll use for a real model later, and it's what every agent test in
 * src/ai/agents/ exercises instead of a live LLM API.
 *
 * This class itself does no intent classification or tool-calling
 * anymore — see src/ai/agents/orchestrator.ts. A real LLM provider's
 * `generateReply` would route through the same Orchestrator, just with
 * the model (not a regex) deciding which agent/tool to reach for.
 */
export class MockAIProvider implements AIProvider {
  readonly id = 'mock';
  readonly isAvailableOffline = true;

  async generateReply(params: { messages: AIProviderMessage[]; tools: ToolRegistry }): Promise<AIProviderResult> {
    const lastUserMessage = [...params.messages].reverse().find((m) => m.role === 'user');
    const text = lastUserMessage?.content ?? '';

    const response = await defaultOrchestrator.handle(text, { currency: DEFAULT_CURRENCY }, params.tools);

    return { content: response.message, toolCalls: response.toolResults };
  }
}

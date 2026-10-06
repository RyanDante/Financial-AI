import { DEFAULT_CURRENCY } from '@/constants/currencies';
import { makeAgentRoutingRecord } from '@/types/ai';
import { createDefaultAgentRegistry, Orchestrator } from '../agents';
import type { LLMClient } from '../llm/types';
import type { ToolRegistry } from '../tools/types';
import type { AIProvider, AIProviderMessage, AIProviderResult } from './types';

/**
 * The real-model provider: the same Orchestrator and specialist agents as
 * MockAIProvider, but each agent answers through the configured model
 * (Claude, OpenAI or Gemini), with its tool allowlist and the number guard.
 * It still answers offline: the Orchestrator falls back to the
 * deterministic agents whenever the model can't be used.
 */
export class LLMProvider implements AIProvider {
  readonly id: string;
  readonly isAvailableOffline = true;

  constructor(
    private client: LLMClient,
    private tools: ToolRegistry,
  ) {
    this.id = `${client.provider}:${client.model}`;
  }

  async generateReply(params: { messages: AIProviderMessage[]; tools: ToolRegistry }): Promise<AIProviderResult> {
    const conversation = params.messages.filter((m): m is AIProviderMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant');
    const last = conversation[conversation.length - 1];
    const text = last?.role === 'user' ? last.content : '';
    const history = conversation.slice(0, -1).map((m) => ({ role: m.role, text: m.content }));

    const orchestrator = new Orchestrator(createDefaultAgentRegistry(), {
      client: this.client,
      toolSpecs: (allowed) => this.tools.specs(allowed),
    });
    const response = await orchestrator.handle(text, { currency: DEFAULT_CURRENCY }, params.tools, { history });

    const toolCalls = response.agentName ? [makeAgentRoutingRecord(response.agentName), ...response.toolResults] : response.toolResults;
    return { content: response.message, toolCalls };
  }
}

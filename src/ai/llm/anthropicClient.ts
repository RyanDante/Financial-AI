import Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, LLMRequest, LLMResponse, LLMToolCall, LLMTurn } from './types';
import { LLMError } from './types';

/** Models that accept `output_config.effort` and server-side refusal fallbacks (see the Claude API model table). */
const MODELS_WITH_EFFORT_AND_FALLBACKS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

/**
 * Claude via the official Anthropic SDK (Messages API, client-side tool
 * loop). Thinking stays at the model's default (adaptive); effort is set
 * explicitly because Claude Opus 5.5 defaults to `medium`, which suits short
 * finance answers. A refused request falls back server-side to another model
 * ("fallbacks: default") instead of ending the turn.
 */
export class AnthropicClient implements LLMClient {
  readonly provider = 'anthropic';
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
    baseUrl?: string | null,
  ) {
    // 20 s per attempt, one SDK retry on connection errors, 408/409/429 and 5xx.
    this.client = new Anthropic({ apiKey, baseURL: baseUrl ?? undefined, timeout: 20_000, maxRetries: 1 });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const supportsExtras = MODELS_WITH_EFFORT_AND_FALLBACKS.has(this.model);
    try {
      const response = await this.client.beta.messages.create(
        {
          model: this.model,
          max_tokens: request.maxTokens ?? 16_000,
          system: request.system,
          messages: request.turns.map(toMessageParam),
          tools: request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters as Anthropic.Beta.BetaTool.InputSchema,
          })),
          ...(supportsExtras
            ? { output_config: { effort: 'medium' as const }, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
            : {}),
        },
        { signal: request.signal },
      );

      const toolCalls: LLMToolCall[] = [];
      let text = '';
      for (const block of response.content) {
        if (block.type === 'text') text += block.text;
        else if (block.type === 'tool_use') toolCalls.push({ id: block.id, name: block.name, input: (block.input ?? {}) as Record<string, unknown> });
      }

      const stopReason =
        response.stop_reason === 'refusal'
          ? 'refusal'
          : response.stop_reason === 'max_tokens'
            ? 'max_tokens'
            : toolCalls.length > 0
              ? 'tool_use'
              : 'end';
      return { text, toolCalls, stopReason, native: response.content };
    } catch (error) {
      throw toLLMError(error);
    }
  }
}

function toMessageParam(turn: LLMTurn): Anthropic.Beta.BetaMessageParam {
  if (turn.role === 'user') return { role: 'user', content: turn.text };
  if (turn.role === 'tool') {
    return {
      role: 'user',
      content: turn.results.map((result) => ({ type: 'tool_result', tool_use_id: result.id, content: result.content, is_error: result.isError })),
    };
  }
  // Re-send Claude's own content blocks unchanged (they may include thinking blocks).
  if (turn.native) return { role: 'assistant', content: turn.native as Anthropic.Beta.BetaMessageParam['content'] };
  return {
    role: 'assistant',
    content: [
      ...(turn.text ? [{ type: 'text' as const, text: turn.text }] : []),
      ...turn.toolCalls.map((call) => ({ type: 'tool_use' as const, id: call.id, name: call.name, input: call.input })),
    ],
  };
}

function toLLMError(error: unknown): LLMError {
  if (error instanceof Anthropic.AuthenticationError) return new LLMError('The Claude API key was rejected. Check EXPO_PUBLIC_AI_API_KEY.', false);
  if (error instanceof Anthropic.NotFoundError) return new LLMError('That Claude model ID was not found. Check EXPO_PUBLIC_AI_MODEL.', false);
  if (error instanceof Anthropic.RateLimitError) return new LLMError('Claude is rate-limiting requests right now.', true);
  if (error instanceof Anthropic.APIConnectionError) return new LLMError('Could not reach Claude (offline or timed out).', true);
  if (error instanceof Anthropic.APIError) return new LLMError(`Claude API error ${error.status ?? ''}`.trim(), (error.status ?? 0) >= 500);
  return new LLMError(error instanceof Error ? error.message : 'Unknown Claude error', false);
}

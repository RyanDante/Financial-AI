import { directTransport, type Transport } from './http';
import type { LLMClient, LLMRequest, LLMResponse, LLMToolCall, LLMTurn } from './types';
import { LLMError } from './types';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Models that accept `output_config.effort` and server-side refusal fallbacks. */
const MODELS_WITH_EFFORT_AND_FALLBACKS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: string; [key: string]: unknown };

interface MessagesResponse {
  content: ContentBlock[];
  stop_reason: string | null;
}

/**
 * Claude over the Messages API REST endpoint (client-side tool loop).
 *
 * This calls the API with fetch rather than @anthropic-ai/sdk because the
 * SDK fails while loading under React Native/Hermes (an internal circular
 * import leaves `BetaToolRunner` undefined), which crashed every screen
 * that imports the AI layer. Thinking stays at the model's default
 * (adaptive); effort is set explicitly because Claude Opus 5.5 defaults to
 * `medium`. A refused request falls back server-side to another model
 * ("fallbacks: default") instead of ending the turn.
 */
export class AnthropicClient implements LLMClient {
  readonly provider = 'anthropic';
  private baseUrl: string;

  constructor(
    private apiKey: string,
    readonly model: string,
    baseUrl?: string | null,
    private transport: Transport = directTransport,
  ) {
    this.baseUrl = baseUrl ?? ANTHROPIC_BASE_URL;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const supportsExtras = MODELS_WITH_EFFORT_AND_FALLBACKS.has(this.model);
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      'anthropic-version': API_VERSION,
      ...(supportsExtras ? { 'anthropic-beta': FALLBACK_BETA } : {}),
    };
    const body = {
      model: this.model,
      max_tokens: request.maxTokens ?? 16_000,
      system: request.system,
      messages: request.turns.map(toMessage),
      tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })),
      ...(supportsExtras ? { output_config: { effort: 'medium' }, fallbacks: 'default' } : {}),
    };

    const data = (await this.transport({
      provider: 'anthropic',
      vendor: 'Claude',
      url: `${this.baseUrl}/v1/messages`,
      headers,
      body,
      signal: request.signal,
      timeoutMs: request.timeoutMs,
    })) as MessagesResponse;
    if (!Array.isArray(data.content)) throw new LLMError('Claude returned no answer.', true);

    const toolCalls: LLMToolCall[] = [];
    let text = '';
    for (const block of data.content) {
      if (block.type === 'text' && typeof block.text === 'string') text += block.text;
      else if (block.type === 'tool_use') {
        const call = block as { id: string; name: string; input?: Record<string, unknown> };
        toolCalls.push({ id: call.id, name: call.name, input: call.input ?? {} });
      }
    }

    const stopReason =
      data.stop_reason === 'refusal' ? 'refusal' : data.stop_reason === 'max_tokens' ? 'max_tokens' : toolCalls.length > 0 ? 'tool_use' : 'end';
    // The full content (including any thinking blocks) is sent back unchanged inside the tool loop.
    return { text, toolCalls, stopReason, native: data.content };
  }
}

function toMessage(turn: LLMTurn): { role: 'user' | 'assistant'; content: unknown } {
  if (turn.role === 'user') {
    if (!turn.images?.length) return { role: 'user', content: turn.text };
    return {
      role: 'user',
      content: [
        ...turn.images.map((image) => ({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } })),
        { type: 'text', text: turn.text },
      ],
    };
  }
  if (turn.role === 'tool') {
    return {
      role: 'user',
      content: turn.results.map((result) => ({ type: 'tool_result', tool_use_id: result.id, content: result.content, is_error: result.isError })),
    };
  }
  if (turn.native) return { role: 'assistant', content: turn.native };
  return {
    role: 'assistant',
    content: [
      ...(turn.text ? [{ type: 'text', text: turn.text }] : []),
      ...turn.toolCalls.map((call) => ({ type: 'tool_use', id: call.id, name: call.name, input: call.input })),
    ],
  };
}

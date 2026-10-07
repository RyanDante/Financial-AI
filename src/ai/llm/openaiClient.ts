import { directTransport, type Transport } from './http';
import type { LLMClient, LLMRequest, LLMResponse, LLMTurn } from './types';
import { LLMError } from './types';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

interface ChatCompletion {
  choices: { message: ChatMessage; finish_reason: string | null }[];
}

/**
 * OpenAI Chat Completions over REST, which also covers OpenAI-compatible
 * hosts (Groq, Mistral, Together, a local server) via
 * EXPO_PUBLIC_AI_BASE_URL.
 */
export class OpenAIClient implements LLMClient {
  readonly provider = 'openai';
  private baseUrl: string;

  constructor(
    private apiKey: string,
    readonly model: string,
    baseUrl?: string | null,
    private transport: Transport = directTransport,
  ) {
    this.baseUrl = baseUrl ?? OPENAI_BASE_URL;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const isOpenAI = this.baseUrl === OPENAI_BASE_URL;
    const body = {
      model: this.model,
      messages: [{ role: 'system', content: request.system }, ...request.turns.flatMap(toChatMessages)],
      tools: request.tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })),
      tool_choice: 'auto',
      // OpenAI itself uses max_completion_tokens; most compatible hosts still expect max_tokens.
      ...(isOpenAI ? { max_completion_tokens: request.maxTokens ?? 4096 } : { max_tokens: request.maxTokens ?? 4096 }),
    };

    const data = (await this.transport({
      provider: 'openai',
      vendor: 'OpenAI',
      url: `${this.baseUrl}/chat/completions`,
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body,
      signal: request.signal,
      timeoutMs: request.timeoutMs,
    })) as ChatCompletion;
    const choice = data.choices?.[0];
    if (!choice) throw new LLMError('OpenAI returned no answer.', true);

    const toolCalls = (choice.message.tool_calls ?? []).map((call) => ({ id: call.id, name: call.function.name, input: parseArguments(call.function.arguments) }));
    const stopReason =
      choice.finish_reason === 'content_filter' ? 'refusal' : choice.finish_reason === 'length' ? 'max_tokens' : toolCalls.length > 0 ? 'tool_use' : 'end';
    return { text: typeof choice.message.content === 'string' ? choice.message.content : '', toolCalls, stopReason, native: choice.message };
  }
}

function toChatMessages(turn: LLMTurn): ChatMessage[] {
  if (turn.role === 'user') {
    if (!turn.images?.length) return [{ role: 'user', content: turn.text }];
    return [
      {
        role: 'user',
        content: [
          ...turn.images.map((image) => ({ type: 'image_url' as const, image_url: { url: `data:${image.mediaType};base64,${image.base64}` } })),
          { type: 'text' as const, text: turn.text },
        ],
      },
    ];
  }
  if (turn.role === 'tool') return turn.results.map((result) => ({ role: 'tool', tool_call_id: result.id, content: result.content }));
  if (turn.native) return [turn.native as ChatMessage];
  return [
    {
      role: 'assistant',
      content: turn.text || null,
      ...(turn.toolCalls.length
        ? { tool_calls: turn.toolCalls.map((call) => ({ id: call.id, type: 'function' as const, function: { name: call.name, arguments: JSON.stringify(call.input) } })) }
        : {}),
    },
  ];
}

/** Tool arguments arrive as a JSON string; a malformed one becomes an empty object and fails schema validation downstream. */
function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * A provider-neutral view of one model call, so the agent loop is written
 * once and each vendor (Claude, OpenAI, Gemini) only translates shapes.
 */

/** JSON Schema for a tool's input (object at the top level). */
export interface JSONSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: (string | number)[];
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
}

export interface LLMToolSpec {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMToolResult {
  id: string;
  name: string;
  /** JSON text of the tool's output, or an error message when `isError`. */
  content: string;
  isError: boolean;
}

export type LLMTurn =
  | { role: 'user'; text: string }
  /**
   * `native` is the vendor's own assistant payload (e.g. Claude's content
   * blocks, Gemini's parts with thought signatures). The client that made
   * it sends it back unchanged, because some vendors reject or degrade on
   * an edited assistant turn mid tool loop.
   */
  | { role: 'assistant'; text: string; toolCalls: LLMToolCall[]; native?: unknown }
  | { role: 'tool'; results: LLMToolResult[] };

export type LLMStopReason = 'end' | 'tool_use' | 'max_tokens' | 'refusal';

export interface LLMResponse {
  text: string;
  toolCalls: LLMToolCall[];
  stopReason: LLMStopReason;
  native?: unknown;
}

export interface LLMRequest {
  system: string;
  turns: LLMTurn[];
  tools: LLMToolSpec[];
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMClient {
  readonly provider: string;
  readonly model: string;
  complete(request: LLMRequest): Promise<LLMResponse>;
}

/** A failure the agent loop can fall back from (network, timeout, rate limit, bad response). */
export class LLMError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

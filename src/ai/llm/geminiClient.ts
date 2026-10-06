import { postJSON } from './http';
import type { LLMClient, LLMRequest, LLMResponse, LLMTurn } from './types';
import { LLMError } from './types';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
/** Ids we invent when Gemini omits one; never sent back as a real id. */
const LOCAL_ID_PREFIX = 'f-ai-local-';

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
  // Other fields (e.g. thought signatures) are kept by echoing the parts back unchanged.
  [key: string]: unknown;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GenerateContentResponse {
  candidates?: { content?: GeminiContent; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/** Gemini `models/{model}:generateContent` over REST, with function declarations. */
export class GeminiClient implements LLMClient {
  readonly provider = 'gemini';
  private baseUrl: string;

  constructor(
    private apiKey: string,
    readonly model: string,
    baseUrl?: string | null,
  ) {
    this.baseUrl = baseUrl ?? GEMINI_BASE_URL;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.turns.map(toContent),
      tools: [
        {
          functionDeclarations: request.tools.map((tool) => ({ name: tool.name, description: tool.description, parametersJsonSchema: tool.parameters })),
        },
      ],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { maxOutputTokens: request.maxTokens ?? 4096 },
    };

    const data = await postJSON<GenerateContentResponse>(
      `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
      { 'x-goog-api-key': this.apiKey },
      body,
      'Gemini',
      request.signal,
    );

    if (data.promptFeedback?.blockReason) return { text: '', toolCalls: [], stopReason: 'refusal' };
    const candidate = data.candidates?.[0];
    if (!candidate?.content) {
      if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') return { text: '', toolCalls: [], stopReason: 'refusal' };
      throw new LLMError('Gemini returned no answer.', true);
    }

    const parts = candidate.content.parts ?? [];
    const text = parts.map((p) => p.text ?? '').join('');
    // Gemini may omit call ids; make them unique and stable within this turn.
    const toolCalls = parts
      .filter((p) => p.functionCall)
      .map((p, i) => ({ id: p.functionCall?.id ?? `${LOCAL_ID_PREFIX}${i}-${p.functionCall?.name}`, name: p.functionCall?.name ?? '', input: p.functionCall?.args ?? {} }));
    const stopReason = candidate.finishReason === 'SAFETY' ? 'refusal' : candidate.finishReason === 'MAX_TOKENS' ? 'max_tokens' : toolCalls.length > 0 ? 'tool_use' : 'end';
    return { text, toolCalls, stopReason, native: candidate.content };
  }
}

function toContent(turn: LLMTurn): GeminiContent {
  if (turn.role === 'user') return { role: 'user', parts: [{ text: turn.text }] };
  if (turn.role === 'tool') {
    return {
      role: 'user',
      parts: turn.results.map((result) => ({
        functionResponse: {
          name: result.name,
          ...(result.id.startsWith(LOCAL_ID_PREFIX) ? {} : { id: result.id }),
          response: result.isError ? { error: result.content } : { result: safeParse(result.content) },
        },
      })),
    };
  }
  if (turn.native) return turn.native as GeminiContent;
  return {
    role: 'model',
    parts: [...(turn.text ? [{ text: turn.text }] : []), ...turn.toolCalls.map((call) => ({ functionCall: { name: call.name, args: call.input } }))],
  };
}

function safeParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

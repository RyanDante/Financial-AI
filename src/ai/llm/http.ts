import { LLMError } from './types';

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * POST JSON with a timeout (20 s by default) and one retry on network errors, 429 and
 * 5xx — the same policy the Anthropic SDK applies — for the vendors called
 * over plain REST.
 */
export async function postJSON<T>(url: string, headers: Record<string, string>, body: unknown, vendor: string, signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  let lastError: LLMError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.ok) return (await response.json()) as T;

      const detail = await response.text().catch(() => '');
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new LLMError(describeStatus(vendor, response.status, detail), retryable);
      if (!retryable) throw lastError;
    } catch (error) {
      if (error instanceof LLMError && !error.retryable) throw error;
      if (signal?.aborted) throw new LLMError(`${vendor} request was cancelled.`, false);
      lastError = error instanceof LLMError ? error : new LLMError(`Could not reach ${vendor} (offline or timed out).`, true);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastError ?? new LLMError(`${vendor} request failed.`, true);
}

function describeStatus(vendor: string, status: number, detail: string): string {
  if (status === 401 || status === 403) return `The ${vendor} API key was rejected. Check EXPO_PUBLIC_AI_API_KEY.`;
  if (status === 404) return `That ${vendor} model or URL was not found. Check EXPO_PUBLIC_AI_MODEL and EXPO_PUBLIC_AI_BASE_URL.`;
  if (status === 429) return `${vendor} is rate-limiting requests right now.`;
  // Keep vendor error text out of the UI; it only goes to the dev console.
  if (__DEV__ && detail) console.warn(`[ai] ${vendor} ${status}: ${detail.slice(0, 500)}`);
  return `${vendor} API error ${status}.`;
}

export type ProviderId = 'anthropic' | 'openai' | 'gemini';

/** One request to a model vendor, before it's sent. */
export interface VendorCall {
  provider: ProviderId;
  /** Display name for errors ("Claude"). */
  vendor: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** How a client reaches its vendor: straight there with the key, or through the F-AI proxy. */
export type Transport = (call: VendorCall) => Promise<unknown>;

export const directTransport: Transport = (call) => postJSON(call.url, call.headers, call.body, call.vendor, call.signal, call.timeoutMs);

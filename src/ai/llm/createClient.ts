/* eslint-disable @typescript-eslint/no-require-imports -- clients are loaded lazily on purpose (see below) */
import type { AIConfig } from '../config';
import type { LLMClient } from './types';
import type { Transport } from './http';

export interface CreatedClient {
  client: LLMClient | null;
  /** Why no client could be created, for Settings; null when it worked or the provider is `mock`. */
  problem: string | null;
}

/**
 * The model client for the configured provider, or null for `mock`.
 *
 * Only the selected provider's module is loaded, and any failure while
 * loading or constructing it is caught: a broken provider must fall back
 * to the offline copilot, never crash every screen that imports the AI
 * layer (Settings, the AI tab).
 */
export function createLLMClient(config: AIConfig): CreatedClient {
  if (config.provider === 'mock' || !config.model) return { client: null, problem: null };
  if (config.transport === 'direct' && !config.apiKey) return { client: null, problem: null };
  try {
    // Proxy mode: the key stays on the server (functions/), so the client sends none.
    const apiKey = config.apiKey ?? '';
    const transport: Transport | undefined =
      config.transport === 'proxy' ? (require('./proxyTransport') as typeof import('./proxyTransport')).proxyTransport : undefined;
    switch (config.provider) {
      case 'anthropic': {
        const { AnthropicClient } = require('./anthropicClient') as typeof import('./anthropicClient');
        return { client: new AnthropicClient(apiKey, config.model, config.baseUrl, transport), problem: null };
      }
      case 'openai': {
        const { OpenAIClient } = require('./openaiClient') as typeof import('./openaiClient');
        return { client: new OpenAIClient(apiKey, config.model, config.baseUrl, transport), problem: null };
      }
      case 'gemini': {
        const { GeminiClient } = require('./geminiClient') as typeof import('./geminiClient');
        return { client: new GeminiClient(apiKey, config.model, config.baseUrl, transport), problem: null };
      }
    }
  } catch (error) {
    if (__DEV__) console.warn(`[ai] could not start the ${config.provider} client`, error);
    return { client: null, problem: `The ${config.provider} client failed to start, so the offline copilot is answering.` };
  }
}

import type { AIConfig } from '../config';
import { AnthropicClient } from './anthropicClient';
import { GeminiClient } from './geminiClient';
import { OpenAIClient } from './openaiClient';
import type { LLMClient } from './types';

/** The model client for the configured provider, or null for `mock` (offline copilot). */
export function createLLMClient(config: AIConfig): LLMClient | null {
  if (config.provider === 'mock' || !config.apiKey || !config.model) return null;
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicClient(config.apiKey, config.model, config.baseUrl);
    case 'openai':
      return new OpenAIClient(config.apiKey, config.model, config.baseUrl);
    case 'gemini':
      return new GeminiClient(config.apiKey, config.model, config.baseUrl);
  }
}

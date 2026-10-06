/**
 * Which AI model answers the copilot, from `.env` (see .env.example).
 *
 * DEVELOPMENT ONLY: every `EXPO_PUBLIC_*` value is compiled into the app
 * bundle, so anyone holding the app file can read this key. Fine for
 * testing on your own phone; a shipped build must call the model through a
 * server that holds the key instead (docs/AI_ARCHITECTURE.md "Keys").
 *
 * No provider or no key means `mock`: the deterministic agents answer, so
 * the copilot works offline and with no account.
 */
export type AIProviderName = 'anthropic' | 'openai' | 'gemini' | 'mock';

export interface AIConfig {
  provider: AIProviderName;
  apiKey: string | null;
  model: string | null;
  baseUrl: string | null;
  /** Set when the .env values are present but unusable; shown in Settings and the AI screen. */
  problem: string | null;
}

/** Only Claude gets a default model; for other vendors we don't guess an ID that may not exist. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

const PROVIDERS: AIProviderName[] = ['anthropic', 'openai', 'gemini', 'mock'];

export function readAIConfig(env: Record<string, string | undefined> = process.env): AIConfig {
  // Expo inlines EXPO_PUBLIC_* only when accessed as `process.env.NAME`, so the
  // default argument reads each one explicitly.
  const values =
    env === process.env
      ? {
          provider: process.env.EXPO_PUBLIC_AI_PROVIDER,
          apiKey: process.env.EXPO_PUBLIC_AI_API_KEY,
          model: process.env.EXPO_PUBLIC_AI_MODEL,
          baseUrl: process.env.EXPO_PUBLIC_AI_BASE_URL,
        }
      : {
          provider: env.EXPO_PUBLIC_AI_PROVIDER,
          apiKey: env.EXPO_PUBLIC_AI_API_KEY,
          model: env.EXPO_PUBLIC_AI_MODEL,
          baseUrl: env.EXPO_PUBLIC_AI_BASE_URL,
        };

  const provider = (values.provider?.trim().toLowerCase() || 'mock') as AIProviderName;
  const apiKey = values.apiKey?.trim() || null;
  const model = values.model?.trim() || null;
  const baseUrl = values.baseUrl?.trim().replace(/\/+$/, '') || null;
  const mock = (problem: string | null): AIConfig => ({ provider: 'mock', apiKey: null, model: null, baseUrl: null, problem });

  if (!PROVIDERS.includes(provider)) return mock(`EXPO_PUBLIC_AI_PROVIDER "${values.provider}" isn't one of anthropic, openai, gemini, mock.`);
  if (provider === 'mock') return mock(null);
  if (!apiKey) return mock(`EXPO_PUBLIC_AI_API_KEY is empty, so the offline copilot is answering.`);
  if (provider === 'anthropic') return { provider, apiKey, model: model ?? DEFAULT_ANTHROPIC_MODEL, baseUrl, problem: null };
  if (!model) return mock(`Set EXPO_PUBLIC_AI_MODEL to a ${provider === 'openai' ? 'OpenAI' : 'Gemini'} model ID to use ${provider}.`);
  return { provider, apiKey, model, baseUrl, problem: null };
}

export const aiConfig = readAIConfig();

/**
 * Which AI model answers the copilot, from `.env` (see .env.example).
 *
 * Two transports. `direct` (default) is DEVELOPMENT ONLY: every `EXPO_PUBLIC_*` value is compiled into the app
 * bundle, so anyone holding the app file can read this key. Fine for
 * testing on your own phone; a shipped build must call the model through a
 * server that holds the key instead (docs/AI_ARCHITECTURE.md "Keys").
 * `proxy` (EXPO_PUBLIC_AI_TRANSPORT=proxy) is that server: requests go
 * through the aiProxy Cloud Function (functions/), which holds the key, so
 * no key is needed or allowed in the app.
 *
 * No provider or no key means `mock`: the deterministic agents answer, so
 * the copilot works offline and with no account.
 */
export type AIProviderName = 'anthropic' | 'openai' | 'gemini' | 'mock';
export type AITransport = 'direct' | 'proxy';

export interface AIConfig {
  provider: AIProviderName;
  apiKey: string | null;
  model: string | null;
  baseUrl: string | null;
  transport: AITransport;
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
          transport: process.env.EXPO_PUBLIC_AI_TRANSPORT,
        }
      : {
          provider: env.EXPO_PUBLIC_AI_PROVIDER,
          apiKey: env.EXPO_PUBLIC_AI_API_KEY,
          model: env.EXPO_PUBLIC_AI_MODEL,
          baseUrl: env.EXPO_PUBLIC_AI_BASE_URL,
          transport: env.EXPO_PUBLIC_AI_TRANSPORT,
        };

  const provider = (values.provider?.trim().toLowerCase() || 'mock') as AIProviderName;
  const apiKey = values.apiKey?.trim() || null;
  const model = values.model?.trim() || null;
  const baseUrl = values.baseUrl?.trim().replace(/\/+$/, '') || null;
  const transport = values.transport?.trim().toLowerCase() || 'direct';
  const mock = (problem: string | null): AIConfig => ({ provider: 'mock', apiKey: null, model: null, baseUrl: null, transport: 'direct', problem });

  if (!PROVIDERS.includes(provider)) return mock(`EXPO_PUBLIC_AI_PROVIDER "${values.provider}" isn't one of anthropic, openai, gemini, mock.`);
  if (provider === 'mock') return mock(null);
  if (transport !== 'direct' && transport !== 'proxy') return mock(`EXPO_PUBLIC_AI_TRANSPORT "${values.transport}" isn't direct or proxy.`);
  if (transport === 'proxy') {
    // The server picks the real model; this one only decides request options, so keep it the same as the server's AI_MODEL.
    if (provider !== 'anthropic' && !model) return mock(`Set EXPO_PUBLIC_AI_MODEL to the model the AI proxy uses.`);
    return { provider, apiKey: null, model: model ?? DEFAULT_ANTHROPIC_MODEL, baseUrl: null, transport, problem: null };
  }
  if (!apiKey) return mock(`EXPO_PUBLIC_AI_API_KEY is empty, so the offline copilot is answering.`);
  if (provider === 'anthropic') return { provider, apiKey, model: model ?? DEFAULT_ANTHROPIC_MODEL, baseUrl, transport: 'direct', problem: null };
  if (!model) return mock(`Set EXPO_PUBLIC_AI_MODEL to a ${provider === 'openai' ? 'OpenAI' : 'Gemini'} model ID to use ${provider}.`);
  return { provider, apiKey, model, baseUrl, transport: 'direct', problem: null };
}

export const aiConfig = readAIConfig();

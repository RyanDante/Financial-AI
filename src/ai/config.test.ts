import { DEFAULT_ANTHROPIC_MODEL, readAIConfig } from './config';

describe('readAIConfig', () => {
  it('uses the offline copilot when nothing is configured', () => {
    expect(readAIConfig({})).toEqual({ provider: 'mock', apiKey: null, model: null, baseUrl: null, problem: null });
  });

  it('defaults the Claude model', () => {
    expect(readAIConfig({ EXPO_PUBLIC_AI_PROVIDER: 'Anthropic', EXPO_PUBLIC_AI_API_KEY: ' sk-test ' })).toMatchObject({
      provider: 'anthropic',
      apiKey: 'sk-test',
      model: DEFAULT_ANTHROPIC_MODEL,
      problem: null,
    });
  });

  it('requires an explicit model for OpenAI and Gemini instead of guessing one', () => {
    const openai = readAIConfig({ EXPO_PUBLIC_AI_PROVIDER: 'openai', EXPO_PUBLIC_AI_API_KEY: 'k' });
    expect(openai.provider).toBe('mock');
    expect(openai.problem).toMatch(/EXPO_PUBLIC_AI_MODEL/);
    expect(readAIConfig({ EXPO_PUBLIC_AI_PROVIDER: 'gemini', EXPO_PUBLIC_AI_API_KEY: 'k', EXPO_PUBLIC_AI_MODEL: 'some-gemini-model' })).toMatchObject({ provider: 'gemini', model: 'some-gemini-model' });
  });

  it('explains a missing key or unknown provider', () => {
    expect(readAIConfig({ EXPO_PUBLIC_AI_PROVIDER: 'openai' }).problem).toMatch(/EXPO_PUBLIC_AI_API_KEY is empty/);
    expect(readAIConfig({ EXPO_PUBLIC_AI_PROVIDER: 'llama' }).problem).toMatch(/isn't one of/);
  });

  it('strips a trailing slash from the base URL', () => {
    expect(readAIConfig({ EXPO_PUBLIC_AI_PROVIDER: 'openai', EXPO_PUBLIC_AI_API_KEY: 'k', EXPO_PUBLIC_AI_MODEL: 'm', EXPO_PUBLIC_AI_BASE_URL: 'https://api.groq.com/openai/v1/' }).baseUrl).toBe(
      'https://api.groq.com/openai/v1',
    );
  });
});

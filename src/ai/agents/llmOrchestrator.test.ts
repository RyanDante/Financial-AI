import { Orchestrator } from './orchestrator';
import { AgentRegistry } from './registry';
import { buildAgentResponse } from './types';
import { MAX_TOOL_ITERATIONS, SUBMIT_ANSWER } from './llmRunner';
import type { AgentContext, AgentDefinition, AgentIntent } from './types';
import type { ToolExecutor } from './toolAccess';
import { LLMError, type LLMClient, type LLMRequest, type LLMResponse } from '@/ai/llm/types';

const context: AgentContext = { currency: 'XAF' };

/** A model that replays a script, one response per call, and records what it was sent. */
function scriptedClient(script: (LLMResponse | Error)[]): LLMClient & { requests: LLMRequest[] } {
  const requests: LLMRequest[] = [];
  let i = 0;
  return {
    provider: 'fake',
    model: 'fake-model',
    requests,
    async complete(request) {
      requests.push(structuredClone({ ...request, signal: undefined }));
      const next = script[Math.min(i++, script.length - 1)];
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

const call = (name: string, input: Record<string, unknown> = {}, id = `id-${name}`): LLMResponse => ({ text: '', toolCalls: [{ id, name, input }], stopReason: 'tool_use' });
const submit = (claims: { kind: string; text: string }[], followUps: string[] = []): LLMResponse => call(SUBMIT_ANSWER, { claims, followUps });

const SPENDING = { month: '2026-09', totalSpentMinor: 94_500 };

function spendingAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'spending',
    name: 'Spending Agent',
    description: 'Spending questions.',
    supportedIntents: ['spending'],
    allowedTools: ['getSpending'],
    execute: async () => buildAgentResponse({ claims: [{ kind: 'fact', text: 'deterministic answer' }] }),
    ...overrides,
  };
}

function tools(calls: string[] = []): ToolExecutor {
  return {
    execute: async (name) => {
      calls.push(name);
      if (name === 'getSpending') return SPENDING;
      if (name === 'getBalance') return { totalBalanceMinor: 1_000_000 };
      throw new Error('SQLITE_ERROR: no such table');
    },
  };
}

function orchestratorWith(client: LLMClient, agents: AgentDefinition[] = [spendingAgent()]) {
  const registry = new AgentRegistry();
  agents.forEach((a) => registry.register(a));
  return new Orchestrator(registry, {
    client,
    toolSpecs: (allowed) => allowed.map((name) => ({ name, description: name, parameters: { type: 'object', properties: {} } })),
  });
}

describe('Orchestrator with a model', () => {
  it('runs the tool loop and returns labelled, guarded claims', async () => {
    const client = scriptedClient([call('getSpending', { month: '2026-09' }), submit([{ kind: 'fact', text: 'You spent 94,500 FCFA in September.' }], ['By category?'])]);
    const response = await orchestratorWith(client).handle('How much did I spend this month?', context, tools());

    expect(response.message).toBe('FACT: You spent 94,500 FCFA in September.\nBy category?');
    expect(response.agentName).toBe('Spending Agent');
    expect(response.toolResults.map((r) => r.toolName)).toEqual(['getSpending']);
    expect(response.metadata).toMatchObject({ mode: 'llm', provider: 'fake', downgradedClaims: 0 });
    // The tool result went back to the model on the second call, and only allowed tools were offered.
    expect(client.requests[1].turns.at(-1)).toMatchObject({ role: 'tool', results: [{ name: 'getSpending', isError: false }] });
    expect(client.requests[0].tools.map((t) => t.name)).toEqual(['getSpending', SUBMIT_ANSWER]);
  });

  it('downgrades a "fact" whose amount no tool returned', async () => {
    const client = scriptedClient([call('getSpending'), submit([{ kind: 'fact', text: 'You spent 120,000 FCFA.' }])]);
    const response = await orchestratorWith(client).handle('How much did I spend?', context, tools());

    expect(response.claims).toEqual([{ kind: 'ai_interpretation', text: 'You spent 120,000 FCFA.' }]);
    expect(response.warnings[0]).toMatch(/couldn't be matched to your data/);
  });

  it('refuses tools outside the allowlist and lets the model recover', async () => {
    const calls: string[] = [];
    const client = scriptedClient([call('getBalance'), call('getSpending'), submit([{ kind: 'fact', text: 'You spent 94,500 FCFA.' }])]);
    const response = await orchestratorWith(client).handle('How much did I spend?', context, tools(calls));

    expect(calls).toEqual(['getSpending']); // getBalance never reached the data layer
    expect(client.requests[1].turns.at(-1)).toMatchObject({ role: 'tool', results: [{ name: 'getBalance', isError: true }] });
    expect(response.claims[0].kind).toBe('fact');
  });

  it('hides internal tool errors from the model', async () => {
    const client = scriptedClient([call('getSpending'), submit([{ kind: 'ai_interpretation', text: 'I could not read that.' }])]);
    const failing: ToolExecutor = { execute: async () => { throw new Error('SQLITE_ERROR: no such table'); } };
    await orchestratorWith(client).handle('How much did I spend?', context, failing);

    const toolTurn = client.requests[1].turns.at(-1);
    expect(JSON.stringify(toolTurn)).not.toContain('SQLITE');
  });

  it.each<[string, (LLMResponse | Error)[]]>([
    ['offline', [new LLMError('Could not reach Claude (offline or timed out).', true)]],
    ['refusal', [{ text: '', toolCalls: [], stopReason: 'refusal' }]],
    ['too many tool steps', [call('getSpending')]],
    ['an empty answer', [submit([])]],
  ])('falls back to the deterministic agent on %s', async (_label, script) => {
    const client = scriptedClient(script);
    const response = await orchestratorWith(client).handle('How much did I spend?', context, tools());

    expect(response.message).toContain('FACT: deterministic answer');
    expect(response.message).toMatch(/Answered offline/);
    if (_label === 'too many tool steps') expect(client.requests).toHaveLength(MAX_TOOL_ITERATIONS);
  });

  it('keeps a plain-text answer only as interpretation', async () => {
    const client = scriptedClient([{ text: 'Looks fine overall.', toolCalls: [], stopReason: 'end' }]);
    const response = await orchestratorWith(client).handle('How much did I spend?', context, tools());
    expect(response.claims).toEqual([{ kind: 'ai_interpretation', text: 'Looks fine overall.' }]);
  });

  it('asks the model to route questions the regex classifier cannot place', async () => {
    const goal: AgentDefinition = { ...spendingAgent(), id: 'goal', name: 'Goal Agent', supportedIntents: ['goal' as AgentIntent] };
    const client = scriptedClient([call('choose_agent', { intent: 'goal' }), call('getSpending'), submit([{ kind: 'fact', text: 'You spent 94,500 FCFA.' }])]);
    const response = await orchestratorWith(client, [spendingAgent(), goal]).handle('Am I on track for the motorbike?', context, tools());

    expect(response.agentName).toBe('Goal Agent');
    expect(client.requests[0].tools[0].parameters.properties?.intent.enum).toEqual(['spending', 'goal', 'unknown']);
  });

  it('answers "unknown" without a specialist when the router cannot place it', async () => {
    const client = scriptedClient([call('choose_agent', { intent: 'weather' })]);
    const response = await orchestratorWith(client).handle('Will it rain tomorrow?', context, tools());
    expect(response.agentName).toBeUndefined();
    expect(response.message).toMatch(/not sure what you're asking/);
  });
});

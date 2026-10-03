import { Orchestrator } from './orchestrator';
import { AgentRegistry } from './registry';
import { buildAgentResponse } from './types';
import type { AgentContext, AgentDefinition, AgentIntent } from './types';
import type { ToolExecutor } from './toolAccess';

const context: AgentContext = { currency: 'XAF' };

function fakeAgent(intent: AgentIntent, overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: `fake-${intent}`,
    name: `Fake ${intent} agent`,
    description: 'test fixture',
    supportedIntents: [intent],
    allowedTools: ['someTool'],
    execute: async () => buildAgentResponse({ claims: [{ kind: 'fact', text: `handled ${intent}` }] }),
    ...overrides,
  };
}

function noopTools(): ToolExecutor {
  return { execute: async () => undefined };
}

describe('Orchestrator routing', () => {
  it.each<[string, AgentIntent]>([
    ['How much did I spend this month?', 'spending'],
    ['How much of my food budget is left?', 'budget'],
    ['Will I reach my goal by March?', 'goal'],
    ['What will my balance look like in six months?', 'forecast'],
    ['Can I afford this?', 'purchase'],
    ['How much am I paying for subscriptions?', 'subscriptions'],
  ])('routes "%s" to the agent registered for intent "%s"', async (text, intent) => {
    const registry = new AgentRegistry();
    registry.register(fakeAgent(intent));
    const orchestrator = new Orchestrator(registry);

    const response = await orchestrator.handle(text, context, noopTools());

    expect(response.message).toContain(`handled ${intent}`);
  });

  it('never calls a tool itself — only ever delegates to the matched agent', async () => {
    const registry = new AgentRegistry();
    let agentReceivedTools = false;
    registry.register(
      fakeAgent('spending', {
        execute: async (_request, _ctx, tools) => {
          agentReceivedTools = typeof tools.execute === 'function';
          return buildAgentResponse({ claims: [] });
        },
      }),
    );
    const orchestrator = new Orchestrator(registry);

    await orchestrator.handle('How much did I spend?', context, noopTools());

    expect(agentReceivedTools).toBe(true);
  });

  it('passes the classified intent and extracted entities to the agent', async () => {
    const registry = new AgentRegistry();
    let receivedRequest: unknown;
    registry.register(
      fakeAgent('purchase', {
        execute: async (request) => {
          receivedRequest = request;
          return buildAgentResponse({ claims: [] });
        },
      }),
    );
    const orchestrator = new Orchestrator(registry);

    await orchestrator.handle('Can I spend 100,000 XAF on this?', context, noopTools());

    expect(receivedRequest).toMatchObject({ intent: 'purchase', entities: { amountMajor: 100000 } });
  });

  it('attaches the tools the agent actually called to the final response', async () => {
    const registry = new AgentRegistry();
    registry.register(
      fakeAgent('spending', {
        allowedTools: ['getSpending'],
        execute: async (_request, _ctx, tools) => {
          await tools.execute('getSpending', { month: '2026-01' });
          return buildAgentResponse({ claims: [{ kind: 'fact', text: 'spent 1000' }] });
        },
      }),
    );
    const orchestrator = new Orchestrator(registry);

    const response = await orchestrator.handle('How much did I spend?', context, {
      execute: async () => ({ totalSpentMinor: 1000 }),
    });

    expect(response.toolResults).toEqual([{ toolName: 'getSpending', input: { month: '2026-01' }, output: { totalSpentMinor: 1000 } }]);
  });

  it('returns a graceful fallback for an unknown intent, without invoking any agent', async () => {
    const registry = new AgentRegistry();
    const spendingAgent = fakeAgent('spending');
    const executeSpy = jest.spyOn(spendingAgent, 'execute');
    registry.register(spendingAgent);
    const orchestrator = new Orchestrator(registry);

    const response = await orchestrator.handle('asdkjasjkdasd', context, noopTools());

    expect(executeSpy).not.toHaveBeenCalled();
    expect(response.message.toLowerCase()).toContain("not sure what you're asking".toLowerCase());
  });

  it('handles a genuinely ambiguous request the same graceful way as unknown', async () => {
    const orchestrator = new Orchestrator(new AgentRegistry());
    const response = await orchestrator.handle('How much have I used?', context, noopTools());
    expect(response.warnings).toEqual([]);
    expect(response.message.length).toBeGreaterThan(0);
  });

  it('reports a clear, non-crashing response when no agent is registered for a recognized intent', async () => {
    const orchestrator = new Orchestrator(new AgentRegistry()); // nothing registered at all
    const response = await orchestrator.handle('How much did I spend this month?', context, noopTools());
    expect(response.warnings[0]).toMatch(/no agent is registered/i);
  });

  it('catches a malformed/throwing agent response instead of propagating the error', async () => {
    const registry = new AgentRegistry();
    registry.register(
      fakeAgent('goal', {
        execute: async () => {
          throw new Error('goal repository exploded');
        },
      }),
    );
    const orchestrator = new Orchestrator(registry);

    const response = await orchestrator.handle('Will I reach my goal by March?', context, noopTools());

    expect(response.warnings[0]).toContain('goal repository exploded');
    expect(response.message).not.toContain('undefined');
  });

  it('propagates a tool-access violation as a graceful failure rather than a crash', async () => {
    const registry = new AgentRegistry();
    registry.register(
      fakeAgent('spending', {
        allowedTools: ['getSpending'],
        execute: async (_request, _ctx, tools) => {
          await tools.execute('deleteEverything', {}); // not in allowedTools
          return buildAgentResponse({ claims: [] });
        },
      }),
    );
    const orchestrator = new Orchestrator(registry);

    const response = await orchestrator.handle('How much did I spend?', context, noopTools());

    expect(response.warnings[0]).toMatch(/not in this agent's allowlist/i);
  });
});

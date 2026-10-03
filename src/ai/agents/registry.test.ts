import { AgentRegistry } from './registry';
import type { AgentDefinition } from './types';

function fakeAgent(overrides: Partial<AgentDefinition>): AgentDefinition {
  return {
    id: 'fake',
    name: 'Fake Agent',
    description: 'A fake agent for registry tests.',
    supportedIntents: [],
    allowedTools: [],
    execute: async () => {
      throw new Error('not implemented in test fixture');
    },
    ...overrides,
  };
}

describe('AgentRegistry', () => {
  it('registers and retrieves an agent by id', () => {
    const registry = new AgentRegistry();
    const agent = fakeAgent({ id: 'spending' });
    registry.register(agent);
    expect(registry.get('spending')).toBe(agent);
  });

  it('returns undefined for an unregistered id', () => {
    expect(new AgentRegistry().get('nope')).toBeUndefined();
  });

  it('finds an agent by one of its supported intents', () => {
    const registry = new AgentRegistry();
    const spendingAgent = fakeAgent({ id: 'spending', supportedIntents: ['spending'] });
    const budgetAgent = fakeAgent({ id: 'budget', supportedIntents: ['budget'] });
    registry.register(spendingAgent);
    registry.register(budgetAgent);

    expect(registry.findByIntent('spending')).toBe(spendingAgent);
    expect(registry.findByIntent('budget')).toBe(budgetAgent);
  });

  it('returns undefined when no agent supports the intent', () => {
    const registry = new AgentRegistry();
    registry.register(fakeAgent({ id: 'spending', supportedIntents: ['spending'] }));
    expect(registry.findByIntent('goal')).toBeUndefined();
  });

  it('lists every registered agent', () => {
    const registry = new AgentRegistry();
    registry.register(fakeAgent({ id: 'a' }));
    registry.register(fakeAgent({ id: 'b' }));
    expect(registry.list().map((a) => a.id).sort()).toEqual(['a', 'b']);
  });
});

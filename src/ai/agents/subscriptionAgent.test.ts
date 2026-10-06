import { subscriptionAgent } from './subscriptionAgent';
import type { AgentContext, AgentRequest } from './types';
import type { ToolExecutor } from './toolAccess';

const context: AgentContext = { currency: 'XAF' };

function request(text: string): AgentRequest {
  return { text, intent: 'subscriptions', entities: {} };
}

function fakeTools(responses: Record<string, unknown>): ToolExecutor {
  return { execute: jest.fn(async (name: string) => responses[name]) };
}

describe('subscriptionAgent — list subscriptions', () => {
  it('lists active subscriptions ranked by monthly cost', async () => {
    const tools = fakeTools({
      getSubscriptions: {
        monthlyTotalMinor: 15000,
        items: [
          { name: 'Streaming', monthlyEquivalentMinor: 10000 },
          { name: 'Cloud storage', monthlyEquivalentMinor: 5000 },
        ],
      },
    });

    const response = await subscriptionAgent.execute(request('What subscriptions am I paying for?'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('getSubscriptions', {});
    expect(response.message).toContain('Streaming');
    expect(response.message).toContain('Cloud storage');
  });
});

describe('subscriptionAgent — total recurring cost', () => {
  it('states the monthly total', async () => {
    const tools = fakeTools({
      getSubscriptions: { monthlyTotalMinor: 15000, items: [{ name: 'Streaming', monthlyEquivalentMinor: 15000 }] },
    });

    const response = await subscriptionAgent.execute(request('How much do subscriptions cost me?'), context, tools);

    expect(response.message).toContain("You're spending 15,000 FCFA/month on subscriptions");
  });

  it('ranks the highest-cost subscription first', async () => {
    const tools = fakeTools({
      getSubscriptions: {
        monthlyTotalMinor: 15000,
        items: [
          { name: 'Streaming', monthlyEquivalentMinor: 10000 },
          { name: 'Cloud storage', monthlyEquivalentMinor: 5000 },
        ],
      },
    });

    const response = await subscriptionAgent.execute(request('Which subscriptions cost the most?'), context, tools);

    const streamingLine = response.message.split('\n').findIndex((l) => l.includes('Streaming'));
    const storageLine = response.message.split('\n').findIndex((l) => l.includes('Cloud storage'));
    expect(streamingLine).toBeLessThan(storageLine);
  });
});

describe('subscriptionAgent — empty subscriptions', () => {
  it('reports no active subscriptions rather than fabricating a total', async () => {
    const tools = fakeTools({ getSubscriptions: { monthlyTotalMinor: 0, items: [] } });

    const response = await subscriptionAgent.execute(request('What recurring expenses do I have?'), context, tools);

    expect(response.message).toBe('FACT: No active subscriptions are tracked yet.');
  });
});

describe('subscriptionAgent — tool failure', () => {
  it('propagates a tool failure rather than silently fabricating an answer', async () => {
    const tools: ToolExecutor = {
      execute: async () => {
        throw new Error('subscriptions repository unavailable');
      },
    };

    await expect(subscriptionAgent.execute(request('What subscriptions am I paying for?'), context, tools)).rejects.toThrow(
      'subscriptions repository unavailable',
    );
  });
});

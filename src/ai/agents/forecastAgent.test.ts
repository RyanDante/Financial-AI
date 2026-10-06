import { forecastAgent } from './forecastAgent';
import type { AgentContext, AgentRequest } from './types';
import type { ToolExecutor } from './toolAccess';

const context: AgentContext = { currency: 'XAF' };

function request(text: string, entities: Record<string, unknown> = {}): AgentRequest {
  return { text, intent: 'forecast', entities };
}

function fakeTools(responses: Record<string, unknown>): ToolExecutor {
  return { execute: jest.fn(async (name: string) => responses[name]) };
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-01-15T00:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('forecastAgent — valid period', () => {
  it('projects the explicitly requested number of months', async () => {
    const tools = fakeTools({
      forecastBalance: { points: [{ month: '2026-07', projectedBalanceMinor: 800000 }], basis: 'Assumes a constant net cash flow.' },
    });

    const response = await forecastAgent.execute(request('What will my finances look like in 6 months?', { monthsCount: 6 }), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('forecastBalance', { months: 6, currency: 'XAF' });
    expect(response.message).toContain('6 month(s)');
    expect(response.message).toContain('800,000 FCFA');
  });
});

describe('forecastAgent — missing period', () => {
  it('defaults to a 6-month horizon when none is mentioned', async () => {
    const tools = fakeTools({
      forecastBalance: { points: [{ month: '2026-07', projectedBalanceMinor: 800000 }], basis: 'Assumes a constant net cash flow.' },
    });

    await forecastAgent.execute(request('What will my balance look like?'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('forecastBalance', { months: 6, currency: 'XAF' });
  });

  it('resolves a named month ("by March") into a month count instead of defaulting', async () => {
    const tools = fakeTools({
      forecastBalance: { points: [{ month: '2026-03', projectedBalanceMinor: 700000 }], basis: 'Assumes a constant net cash flow.' },
    });

    await forecastAgent.execute(request('How much will I have by March?'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('forecastBalance', { months: 2, currency: 'XAF' });
  });
});

describe('forecastAgent — projection', () => {
  it('labels the balance as a PROJECTION and states its ASSUMPTION, never as fact', async () => {
    const tools = fakeTools({
      forecastBalance: { points: [{ month: '2026-07', projectedBalanceMinor: 800000 }], basis: 'Assumes a constant net cash flow of 50000 minor units per month continues unchanged.' },
    });

    const response = await forecastAgent.execute(request('What will my balance look like in six months?', { monthsCount: 6 }), context, tools);

    expect(response.message.split('\n')[0]).toContain('PROJECTION:');
    expect(response.message).toContain('ASSUMPTION: Assumes a constant net cash flow');
  });

  it('reports current cash flow as a FACT, not a projection, for a cash-flow-only request', async () => {
    const tools = fakeTools({
      calculateCashFlow: { month: '2026-01', currency: 'XAF', incomeMinor: 300000, expenseMinor: 200000, netMinor: 100000 },
    });

    const response = await forecastAgent.execute(request('Project my current cash flow.'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('calculateCashFlow', { currency: 'XAF' });
    expect(response.message.split('\n')[0]).toContain('FACT:');
    expect(response.message).toContain('100,000 FCFA');
  });
});

describe('forecastAgent — scenario', () => {
  it('adds a monthly adjustment for an increased-saving scenario and names it in the message', async () => {
    const tools = fakeTools({
      forecastBalance: { points: [{ month: '2026-07', projectedBalanceMinor: 950000 }], basis: 'Assumes a constant net cash flow.' },
    });

    const response = await forecastAgent.execute(
      request('What happens if I save 50,000 more each month?', { amountMajor: 50000 }),
      context,
      tools,
    );

    expect(tools.execute).toHaveBeenCalledWith('forecastBalance', { months: 6, currency: 'XAF', monthlyAdjustmentMinor: 50000 });
    expect(response.message).toContain('saved an extra 50,000 FCFA/month');
  });

  it('uses the baseline (no adjustment) for "spending stays the same"', async () => {
    const tools = fakeTools({
      forecastBalance: { points: [{ month: '2026-07', projectedBalanceMinor: 800000 }], basis: 'Assumes a constant net cash flow.' },
    });

    const response = await forecastAgent.execute(request('What happens if my spending stays the same?'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('forecastBalance', { months: 6, currency: 'XAF' });
    expect(response.message).toContain('your recent cash flow continues unchanged');
  });
});

describe('forecastAgent — tool failure', () => {
  it('propagates a tool failure rather than silently fabricating a projection', async () => {
    const tools: ToolExecutor = {
      execute: async () => {
        throw new Error('transaction repository unavailable');
      },
    };

    await expect(forecastAgent.execute(request('What will my balance look like in six months?', { monthsCount: 6 }), context, tools)).rejects.toThrow(
      'transaction repository unavailable',
    );
  });
});

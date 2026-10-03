import { spendingAgent } from './spendingAgent';
import type { AgentContext, AgentRequest } from './types';
import type { ToolExecutor } from './toolAccess';

const context: AgentContext = { currency: 'XAF' };

function request(text: string): AgentRequest {
  return { text, intent: 'spending', entities: {} };
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

const breakdown = {
  month: '2026-01',
  categories: [
    { categoryId: 'cat-food', categoryName: 'Food', totalMinor: 50000, percentage: 50, transactionCount: 4 },
    { categoryId: 'cat-transport', categoryName: 'Transport', totalMinor: 30000, percentage: 30, transactionCount: 2 },
    { categoryId: 'cat-other', categoryName: 'Other', totalMinor: 20000, percentage: 20, transactionCount: 1 },
  ],
};

describe('spendingAgent — total spending', () => {
  it('reports the total and the top category for "How much did I spend this month?"', async () => {
    const tools = fakeTools({ getSpendingByCategory: breakdown });
    const response = await spendingAgent.execute(request('How much did I spend this month?'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('getSpendingByCategory', { month: '2026-01' });
    expect(response.message).toContain('100,000 FCFA');
    expect(response.message).toContain('Food');
    expect(response.claims.every((c) => c.kind === 'fact')).toBe(true);
  });
});

describe('spendingAgent — category spending', () => {
  it('calls out a specifically-named category even when it is not the top one', async () => {
    const tools = fakeTools({ getSpendingByCategory: breakdown });
    const response = await spendingAgent.execute(request('How much did I spend on Transport?'), context, tools);

    expect(response.message).toContain('30,000 FCFA');
    expect(response.message).toContain('Transport');
  });

  it('does not duplicate the top category as a separately-named one', async () => {
    const tools = fakeTools({ getSpendingByCategory: breakdown });
    const response = await spendingAgent.execute(request('How much did I spend on food?'), context, tools);

    // "Of that, ... Food" should not appear since Food is already the top category line.
    expect(response.message).not.toContain('Of that');
  });
});

describe('spendingAgent — date range', () => {
  it('asks getSpendingByCategory for the named month, not the current one', async () => {
    const tools = fakeTools({ getSpendingByCategory: { month: '2026-03', categories: [] } });
    await spendingAgent.execute(request('How much did I spend in March?'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('getSpendingByCategory', { month: '2026-03' });
  });
});

describe('spendingAgent — empty data', () => {
  it('reports no expenses rather than fabricating a figure', async () => {
    const tools = fakeTools({ getSpendingByCategory: { month: '2026-01', categories: [] } });
    const response = await spendingAgent.execute(request('How much did I spend this month?'), context, tools);

    expect(response.message).toBe('FACT: No expenses recorded for 2026-01 yet.');
    expect(tools.execute).toHaveBeenCalledTimes(1); // no follow-up comparison call when there's nothing to report
  });
});

describe('spendingAgent — tool failure', () => {
  it('propagates a tool failure rather than silently fabricating an answer', async () => {
    const tools: ToolExecutor = { execute: async () => { throw new Error('database unavailable'); } };

    await expect(spendingAgent.execute(request('How much did I spend?'), context, tools)).rejects.toThrow('database unavailable');
  });
});

describe('spendingAgent — comparison', () => {
  it('fetches the previous month and reports the percentage change when asked', async () => {
    const tools = fakeTools({
      getSpendingByCategory: breakdown,
      getSpending: { month: '2025-12', totalSpentMinor: 50000 },
    });

    const response = await spendingAgent.execute(request('How has my spending changed?'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('getSpending', { month: '2025-12' });
    expect(response.message).toContain('up 100%');
  });
});

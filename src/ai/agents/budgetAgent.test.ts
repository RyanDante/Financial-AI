import { budgetAgent } from './budgetAgent';
import type { AgentContext, AgentRequest } from './types';
import type { ToolExecutor } from './toolAccess';

const context: AgentContext = { currency: 'XAF' };

function request(text: string): AgentRequest {
  return { text, intent: 'budget', entities: {} };
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

describe('budgetAgent — budget status', () => {
  it('reports overall spent/limit for a general budget question', async () => {
    const tools = fakeTools({
      getBudgetStatus: {
        month: '2026-01',
        budget: { id: 'b1', name: 'Monthly', currency: 'XAF' },
        categories: [
          { categoryId: 'cat-food', categoryName: 'Food', limitMinor: 50000, spentMinor: 30000, remainingMinor: 20000, percentUsed: 60, isOverBudget: false },
          { categoryId: 'cat-transport', categoryName: 'Transport', limitMinor: 20000, spentMinor: 10000, remainingMinor: 10000, percentUsed: 50, isOverBudget: false },
        ],
      },
    });

    const response = await budgetAgent.execute(request('How much budget do I have left?'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('getBudgetStatus', { month: '2026-01' });
    expect(response.message).toContain('40,000 FCFA'); // spent: 30000+10000
    expect(response.message).toContain('30,000 FCFA'); // remaining: 70000-40000
  });
});

describe('budgetAgent — remaining budget for a named category', () => {
  it('reports the specific category instead of the overall total', async () => {
    const tools = fakeTools({
      getBudgetStatus: {
        month: '2026-01',
        budget: { id: 'b1', name: 'Monthly', currency: 'XAF' },
        categories: [
          { categoryId: 'cat-food', categoryName: 'Food', limitMinor: 50000, spentMinor: 30000, remainingMinor: 20000, percentUsed: 60, isOverBudget: false },
        ],
      },
    });

    const response = await budgetAgent.execute(request('How much of my food budget is left?'), context, tools);

    expect(response.message).toContain('Food');
    expect(response.message).toContain('20,000 FCFA remaining');
  });
});

describe('budgetAgent — overspending', () => {
  it('flags an over-budget category and the overall shortfall', async () => {
    const tools = fakeTools({
      getBudgetStatus: {
        month: '2026-01',
        budget: { id: 'b1', name: 'Monthly', currency: 'XAF' },
        categories: [
          { categoryId: 'cat-food', categoryName: 'Food', limitMinor: 50000, spentMinor: 60000, remainingMinor: -10000, percentUsed: 120, isOverBudget: true },
        ],
      },
    });

    const response = await budgetAgent.execute(request('Am I overspending?'), context, tools);

    expect(response.message).toContain('over budget overall');
    expect(response.message).toContain('Over budget: Food');
  });

  it('flags categories close to their limit without being over', async () => {
    const tools = fakeTools({
      getBudgetStatus: {
        month: '2026-01',
        budget: { id: 'b1', name: 'Monthly', currency: 'XAF' },
        categories: [
          { categoryId: 'cat-food', categoryName: 'Food', limitMinor: 50000, spentMinor: 46000, remainingMinor: 4000, percentUsed: 92, isOverBudget: false },
        ],
      },
    });

    const response = await budgetAgent.execute(request('Which categories are close to their limits?'), context, tools);

    expect(response.message).toContain('Close to their limit: Food (92%)');
  });
});

describe('budgetAgent — missing budget', () => {
  it('reports no budget rather than fabricating numbers', async () => {
    const tools = fakeTools({ getBudgetStatus: { month: '2026-01', budget: null, categories: [] } });

    const response = await budgetAgent.execute(request('How much budget do I have left?'), context, tools);

    expect(response.message).toBe('FACT: No budget has been set for 2026-01 yet.\nWant to set up a budget for this month?');
  });
});

describe('budgetAgent — tool failure', () => {
  it('propagates a tool failure rather than silently fabricating an answer', async () => {
    const tools: ToolExecutor = { execute: async () => { throw new Error('budget repository unavailable'); } };

    await expect(budgetAgent.execute(request('Am I over budget?'), context, tools)).rejects.toThrow('budget repository unavailable');
  });
});

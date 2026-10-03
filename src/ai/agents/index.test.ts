import { defaultOrchestrator } from './index';
import type { AgentContext } from './types';
import type { ToolExecutor } from './toolAccess';

const context: AgentContext = { currency: 'XAF' };

/**
 * Unlike orchestrator.test.ts (which uses fake agents to test routing in
 * isolation) and each agent's own test file (which calls the agent
 * directly), this exercises the real, fully-wired default registry —
 * proving the Orchestrator actually reaches the real Spending/Budget/Goal
 * agents end to end, not just a test double shaped like one.
 */
function fakeToolResponses(responses: Record<string, unknown>): ToolExecutor {
  return { execute: async (name: string) => responses[name] };
}

describe('defaultOrchestrator — end to end through the real registry', () => {
  it('routes a spending question to the real Spending Agent', async () => {
    const tools = fakeToolResponses({
      getSpendingByCategory: {
        month: '2026-01',
        categories: [{ categoryId: 'c1', categoryName: 'Food', totalMinor: 10000, percentage: 100, transactionCount: 2 }],
      },
    });

    const response = await defaultOrchestrator.handle('How much did I spend this month?', context, tools);

    expect(response.message).toContain('FACT:');
    expect(response.toolResults.map((t) => t.toolName)).toContain('getSpendingByCategory');
  });

  it('routes a budget question to the real Budget Agent', async () => {
    const tools = fakeToolResponses({
      getBudgetStatus: { month: '2026-01', budget: null, categories: [] },
    });

    const response = await defaultOrchestrator.handle('How much of my food budget is left?', context, tools);

    expect(response.message).toContain('No budget has been set');
  });

  it('routes a goal question to the real Goal Agent', async () => {
    const tools = fakeToolResponses({ getGoals: [] });

    const response = await defaultOrchestrator.handle('How close am I to my goal?', context, tools);

    expect(response.message).toContain('no goals set up');
  });

  it('routes a purchase question to the real Purchase Agent, respecting its tool allowlist', async () => {
    const tools = fakeToolResponses({
      calculatePurchaseImpact: {
        currentBalanceMinor: 650000,
        purchaseAmountMinor: 100000,
        projectedBalanceMinor: 550000,
        reserveTargetMinor: 150000,
        isReserveIntactAfterPurchase: true,
        goalImpacts: [],
      },
    });

    const response = await defaultOrchestrator.handle('Can I spend 100,000 XAF on this?', context, tools);

    expect(response.message).toContain('550,000 FCFA');
    expect(response.toolResults.map((t) => t.toolName)).toEqual(['calculatePurchaseImpact']);
  });

  it('routes a forecast question to the real Forecast Agent', async () => {
    const tools = fakeToolResponses({
      forecastBalance: { points: [{ month: '2026-07', projectedBalanceMinor: 800000 }], basis: 'Assumes a constant net cash flow.' },
    });

    const response = await defaultOrchestrator.handle('What will my balance look like in six months?', context, tools);

    expect(response.message).toContain('800,000 FCFA');
    expect(response.message).toContain('ASSUMPTION:');
  });

  it('routes a subscriptions question to the real Subscription Agent', async () => {
    const tools = fakeToolResponses({ getSubscriptions: { monthlyTotalMinor: 5000, items: [{ name: 'Streaming', monthlyEquivalentMinor: 5000 }] } });

    const response = await defaultOrchestrator.handle('How much am I paying for subscriptions?', context, tools);

    expect(response.message).toContain('Streaming');
  });

  it('never lets a real agent call a tool outside its own allowlist, even against the live registry', async () => {
    // The Spending Agent's allowlist does not include calculatePurchaseImpact —
    // confirm the registry-level wiring still enforces that boundary.
    const tools = fakeToolResponses({ getSpendingByCategory: { month: '2026-01', categories: [] } });
    const response = await defaultOrchestrator.handle('How much did I spend this month?', context, tools);
    expect(response.toolResults.every((t) => ['getSpending', 'getSpendingByCategory', 'getAccounts', 'calculateCashFlow'].includes(t.toolName))).toBe(true);
  });
});

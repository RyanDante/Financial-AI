import { purchaseAgent } from './purchaseAgent';
import type { AgentContext, AgentRequest } from './types';
import type { ToolExecutor } from './toolAccess';

const context: AgentContext = { currency: 'XAF' };

function request(text: string, amountMajor?: number): AgentRequest {
  return { text, intent: 'purchase', entities: amountMajor === undefined ? {} : { amountMajor } };
}

const basePurchaseImpact = {
  currentBalanceMinor: 650000,
  purchaseAmountMinor: 100000,
  projectedBalanceMinor: 550000,
  upcomingObligationsMinor: 80000,
  reserveTargetMinor: 150000,
  canCoverObligationsAfterPurchase: true,
  isReserveIntactAfterPurchase: true,
  shortfallMinor: 0,
  goalImpacts: [] as { goalId: string; goalName: string; monthlyContributionMinor: number; delayMonths: number | null }[],
};

function fakeTools(responses: Record<string, unknown>): ToolExecutor {
  return {
    execute: jest.fn(async (name: string) => responses[name]),
  };
}

describe('purchaseAgent — valid purchase amount', () => {
  it('reports current balance, projected balance, and reserve status', async () => {
    const tools = fakeTools({
      calculatePurchaseImpact: basePurchaseImpact,
      getBudgetStatus: { month: '2026-01', budget: null, categories: [] },
      calculateCashFlow: { month: '2026-01', currency: 'XAF', incomeMinor: 300000, expenseMinor: 200000, netMinor: 100000 },
    });

    const response = await purchaseAgent.execute(request('Can I spend 100,000 XAF?', 100000), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('calculatePurchaseImpact', { purchaseAmountMinor: 100000, currency: 'XAF' });
    expect(response.message).toContain('FACT: Your current balance is 650,000 FCFA.');
    expect(response.message).toContain('550,000 FCFA');
    expect(response.message).toContain('would remain intact');
  });
});

describe('purchaseAgent — missing purchase amount', () => {
  it('asks for an amount instead of guessing', async () => {
    const tools = fakeTools({});

    const response = await purchaseAgent.execute(request('Can I afford this phone?'), context, tools);

    expect(tools.execute).not.toHaveBeenCalled();
    expect(response.message).toContain("didn't catch an amount");
  });
});

describe('purchaseAgent — current balance', () => {
  it('always states the current balance as a FACT, before any calculation', async () => {
    const tools = fakeTools({
      calculatePurchaseImpact: basePurchaseImpact,
      getBudgetStatus: { month: '2026-01', budget: null, categories: [] },
      calculateCashFlow: null,
    });

    const response = await purchaseAgent.execute(request('The PS5 costs 400k. Analyze it.', 400000), context, tools);

    const firstLine = response.message.split('\n')[0];
    expect(firstLine).toBe('FACT: Your current balance is 650,000 FCFA.');
  });
});

describe('purchaseAgent — upcoming obligations', () => {
  it('reports upcoming obligations and flags when they could no longer be covered', async () => {
    const tools = fakeTools({
      calculatePurchaseImpact: { ...basePurchaseImpact, canCoverObligationsAfterPurchase: false },
      getBudgetStatus: { month: '2026-01', budget: null, categories: [] },
      calculateCashFlow: null,
    });

    const response = await purchaseAgent.execute(request('I want to buy something for 250k.', 250000), context, tools);

    expect(response.message).toContain('80,000 FCFA in upcoming obligations');
    expect(response.message).toContain('unable to fully cover those upcoming obligations');
  });
});

describe('purchaseAgent — goal impact', () => {
  it('reports a goal delay as an assumption, never a fact', async () => {
    const tools = fakeTools({
      calculatePurchaseImpact: {
        ...basePurchaseImpact,
        goalImpacts: [{ goalId: 'g1', goalName: 'Laptop', monthlyContributionMinor: 50000, delayMonths: 2 }],
      },
      getBudgetStatus: { month: '2026-01', budget: null, categories: [] },
      calculateCashFlow: null,
    });

    const response = await purchaseAgent.execute(request('Would this affect my laptop goal?', 100000), context, tools);

    expect(response.message).toContain('ASSUMPTION: If this came out of your goal contributions instead, it could delay them by roughly 2.0 month(s).');
  });

  it('includes this month\'s budget impact when a budget exists', async () => {
    const tools = fakeTools({
      calculatePurchaseImpact: basePurchaseImpact,
      getBudgetStatus: {
        month: '2026-01',
        budget: { id: 'b1', name: 'Monthly', currency: 'XAF' },
        categories: [{ categoryId: 'c1', categoryName: 'Food', limitMinor: 50000, spentMinor: 30000 }],
      },
      calculateCashFlow: null,
    });

    const response = await purchaseAgent.execute(request('Can I spend 100,000 XAF?', 100000), context, tools);

    expect(response.message).toContain("this would put you 80,000 FCFA over");
  });
});

describe('purchaseAgent — tool failure', () => {
  it('propagates a tool failure rather than silently fabricating an answer', async () => {
    const tools: ToolExecutor = {
      execute: async () => {
        throw new Error('account repository unavailable');
      },
    };

    await expect(purchaseAgent.execute(request('Can I afford 100,000?', 100000), context, tools)).rejects.toThrow('account repository unavailable');
  });
});

describe('purchaseAgent — malformed request', () => {
  it('treats a non-numeric/invalid amount the same as a missing one, instead of crashing', async () => {
    const tools = fakeTools({});

    const response = await purchaseAgent.execute(request('Can I afford it?', Number.NaN), context, tools);

    expect(tools.execute).not.toHaveBeenCalled();
    expect(response.message).toContain("didn't catch an amount");
  });

  it('does not crash when a tool response is missing expected fields', async () => {
    const tools = fakeTools({
      calculatePurchaseImpact: { ...basePurchaseImpact, goalImpacts: undefined },
      getBudgetStatus: { month: '2026-01', budget: { id: 'b1', name: 'Monthly', currency: 'XAF' }, categories: undefined },
      calculateCashFlow: undefined,
    });

    const response = await purchaseAgent.execute(request('Can I afford 100,000?', 100000), context, tools);

    expect(response.message).toContain('Your current balance is 650,000 FCFA');
    expect(response.message).not.toContain('undefined');
  });
});

describe('purchaseAgent — unsupported request', () => {
  it('reports a graceful fallback when there is no account data to evaluate against', async () => {
    const tools = fakeTools({ calculatePurchaseImpact: null, getBudgetStatus: null, calculateCashFlow: null });

    const response = await purchaseAgent.execute(request('Can I afford 100,000?', 100000), context, tools);

    expect(response.message).toBe("INTERPRETATION: I don't have enough account data yet to evaluate this purchase.");
  });
});

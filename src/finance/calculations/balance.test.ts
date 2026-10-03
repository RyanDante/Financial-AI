import { calculateAvailableMoney, calculateBalance, calculateDiscretionaryMoney, calculateProjectedBalance } from './balance';
import type { Transaction } from '@/types/finance';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-' + Math.random(),
    accountId: 'acc-1',
    categoryId: null,
    transferAccountId: null,
    amountMinor: 0,
    currency: 'XAF',
    type: 'expense',
    merchant: null,
    description: null,
    notes: null,
    occurredAt: '2026-01-15T00:00:00.000Z',
    source: 'manual',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('calculateBalance', () => {
  const account = { id: 'acc-1', initialBalanceMinor: 100000 };

  it('adds income and subtracts expenses on the same account', () => {
    const transactions = [
      tx({ type: 'income', amountMinor: 50000 }),
      tx({ type: 'expense', amountMinor: 20000 }),
    ];
    expect(calculateBalance(account, transactions)).toBe(130000);
  });

  it('subtracts outgoing transfers and adds incoming transfers', () => {
    const transactions = [
      tx({ type: 'transfer', accountId: 'acc-1', transferAccountId: 'acc-2', amountMinor: 30000 }),
      tx({ type: 'transfer', accountId: 'acc-2', transferAccountId: 'acc-1', amountMinor: 10000 }),
    ];
    expect(calculateBalance(account, transactions)).toBe(100000 - 30000 + 10000);
  });

  it('ignores transactions belonging to other accounts', () => {
    const transactions = [tx({ type: 'expense', accountId: 'acc-9', amountMinor: 99999 })];
    expect(calculateBalance(account, transactions)).toBe(100000);
  });

  it('returns the opening balance for an account with no transactions', () => {
    expect(calculateBalance(account, [])).toBe(100000);
  });
});

describe('calculateAvailableMoney', () => {
  it('subtracts obligations and reserve target from the balance', () => {
    expect(
      calculateAvailableMoney({
        totalBalanceMinor: 650000,
        upcomingObligationsMinor: 265000,
        reserveTargetMinor: 150000,
      }),
    ).toBe(235000);
  });

  it('can go negative, indicating a shortfall', () => {
    expect(
      calculateAvailableMoney({
        totalBalanceMinor: 100000,
        upcomingObligationsMinor: 80000,
        reserveTargetMinor: 50000,
      }),
    ).toBe(-30000);
  });
});

describe('calculateDiscretionaryMoney', () => {
  it('falls back to available money when no budget cap is given', () => {
    expect(
      calculateDiscretionaryMoney({
        totalBalanceMinor: 650000,
        upcomingObligationsMinor: 265000,
        reserveTargetMinor: 150000,
      }),
    ).toBe(235000);
  });

  it('is capped by the remaining discretionary budget when lower', () => {
    expect(
      calculateDiscretionaryMoney({
        totalBalanceMinor: 650000,
        upcomingObligationsMinor: 265000,
        reserveTargetMinor: 150000,
        budgetRemainingMinor: 40000,
      }),
    ).toBe(40000);
  });

  it('is not capped when the budget remaining exceeds available money', () => {
    expect(
      calculateDiscretionaryMoney({
        totalBalanceMinor: 650000,
        upcomingObligationsMinor: 265000,
        reserveTargetMinor: 150000,
        budgetRemainingMinor: 999999,
      }),
    ).toBe(235000);
  });
});

describe('calculateProjectedBalance', () => {
  it('projects balance forward using a constant monthly cash flow', () => {
    expect(calculateProjectedBalance(500000, 50000, 3)).toBe(650000);
  });

  it('handles negative cash flow (net spending)', () => {
    expect(calculateProjectedBalance(500000, -20000, 4)).toBe(420000);
  });
});

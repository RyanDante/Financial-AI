import { buildAlerts, type AlertInput } from './alerts';
import { toBillItems } from '@/features/bills/bills';
import type { BudgetCategory, Category, Goal, Transaction } from '@/types/finance';

const STAMP = '2026-09-01T00:00:00.000Z';

const food: Category = { id: 'cat-food', name: 'Food', icon: 'restaurant', color: '#F2545B', type: 'expense', isDefault: true, parentId: null, createdAt: STAMP, updatedAt: STAMP };

function expense(id: string, amountMinor: number, occurredAt: string, categoryId = food.id): Transaction {
  return { id, accountId: 'acc-1', categoryId, transferAccountId: null, amountMinor, currency: 'XAF', type: 'expense', merchant: null, description: null, notes: null, occurredAt, source: 'manual', createdAt: STAMP, updatedAt: STAMP };
}

function goal(overrides: Partial<Goal>): Goal {
  return { id: 'goal-1', name: 'Laptop', targetAmountMinor: 1_200_000, currentAmountMinor: 450_000, currency: 'XAF', deadline: null, icon: null, color: null, status: 'active', createdAt: STAMP, updatedAt: STAMP, ...overrides };
}

const foodLimit: BudgetCategory = { id: 'bc-food', budgetId: 'b-1', categoryId: food.id, limitMinor: 25_000, createdAt: STAMP, updatedAt: STAMP };

function input(overrides: Partial<AlertInput> = {}): AlertInput {
  return {
    currency: 'XAF',
    month: '2026-09',
    categories: [food],
    transactions: [],
    goals: [],
    budgetCategories: [],
    totalBalanceMinor: 300_000,
    upcomingObligationsMinor: 50_000,
    reserveTargetMinor: 100_000,
    syncStatus: 'synced',
    syncErrorMessage: null,
    attachmentUploadError: null,
    asOf: new Date('2026-09-20T12:00:00.000Z'),
    ...overrides,
  };
}

describe('buildAlerts', () => {
  it('returns nothing when everything is on track', () => {
    expect(buildAlerts(input())).toEqual([]);
  });

  it('flags a negative safe-to-spend amount with the shortfall', () => {
    const [alert] = buildAlerts(input({ totalBalanceMinor: 120_000 }));
    expect(alert).toMatchObject({ id: 'available-negative', severity: 'danger', href: '/' });
    expect(alert.detail).toContain('30,000 FCFA');
  });

  it('flags a category over its limit this month only', () => {
    const alerts = buildAlerts(
      input({
        budgetCategories: [foodLimit],
        transactions: [expense('t1', 20_000, '2026-09-03T10:00:00.000Z'), expense('t2', 17_500, '2026-09-12T10:00:00.000Z'), expense('t3', 90_000, '2026-08-30T10:00:00.000Z')],
      }),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ id: 'budget-bc-food', title: 'Food is over budget', href: '/budgets' });
    expect(alerts[0].detail).toBe('12,500 FCFA over budget this month.');
  });

  it('does not flag a category that is exactly at its limit', () => {
    expect(buildAlerts(input({ budgetCategories: [foodLimit], transactions: [expense('t1', 25_000, '2026-09-03T10:00:00.000Z')] }))).toEqual([]);
  });

  it('flags active goals past their deadline, not completed or archived ones', () => {
    const alerts = buildAlerts(
      input({
        goals: [
          goal({ id: 'g-overdue', deadline: '2026-09-01T00:00:00.000Z' }),
          goal({ id: 'g-future', deadline: '2026-12-01T00:00:00.000Z' }),
          goal({ id: 'g-done', deadline: '2026-09-01T00:00:00.000Z', currentAmountMinor: 1_200_000 }),
          goal({ id: 'g-archived', deadline: '2026-09-01T00:00:00.000Z', status: 'archived' }),
        ],
      }),
    );
    expect(alerts.map((a) => a.id)).toEqual(['goal-g-overdue']);
    expect(alerts[0].detail).toBe('750,000 FCFA still to go.');
  });

  it('never shows a raw sync error, but shows the written blocked message', () => {
    const [error] = buildAlerts(input({ syncStatus: 'error', syncErrorMessage: 'FirebaseError: permission-denied' }));
    expect(error.detail).not.toContain('FirebaseError');

    const [blocked] = buildAlerts(input({ syncStatus: 'blocked', syncErrorMessage: 'Sign in with that account to sync it.' }));
    expect(blocked).toMatchObject({ id: 'sync-blocked', detail: 'Sign in with that account to sync it.' });
  });

  it('warns about bills due within 3 days only', () => {
    const asOf = new Date(2026, 8, 20, 12);
    const rent = { id: 'r', name: 'Rent', categoryId: null, amountMinor: 120_000, currency: 'XAF' as const, frequency: 'monthly' as const, nextDueAt: new Date(2026, 8, 22).toISOString(), isActive: true };
    const later = { ...rent, id: 'l', name: 'Insurance', nextDueAt: new Date(2026, 8, 28).toISOString() };
    const alerts = buildAlerts(input({ asOf, bills: toBillItems([], [rent, later], asOf) }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ id: 'bill-recurring-r', severity: 'warning', title: 'Rent: due in 2 days', detail: '120,000 FCFA to pay.', href: '/bills' });
  });

  it('ignores offline and syncing states', () => {
    expect(buildAlerts(input({ syncStatus: 'offline' }))).toEqual([]);
    expect(buildAlerts(input({ syncStatus: 'syncing' }))).toEqual([]);
  });

  it('lists danger alerts before warnings', () => {
    const alerts = buildAlerts(
      input({
        attachmentUploadError: '2 attachments failed to upload — will retry next sync.',
        goals: [goal({ deadline: '2026-09-01T00:00:00.000Z' })],
        totalBalanceMinor: 0,
      }),
    );
    expect(alerts.map((a) => a.severity)).toEqual(['danger', 'warning', 'warning']);
    expect(alerts.map((a) => a.id)).toEqual(['available-negative', 'goal-goal-1', 'attachment-upload']);
  });
});

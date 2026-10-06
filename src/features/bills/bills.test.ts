import { formatDue, nextOccurrence, toBillItems } from './bills';
import type { RecurringExpense, Subscription } from '@/types/finance';

const ASOF = new Date(2026, 8, 20, 12); // 20 Sep 2026

describe('nextOccurrence', () => {
  it('keeps a date that is today or later', () => {
    const d = new Date(2026, 8, 20, 8);
    expect(nextOccurrence(d, 'monthly', ASOF)).toBe(d);
  });

  it('rolls a past date forward by the frequency', () => {
    expect(nextOccurrence(new Date(2026, 7, 5), 'monthly', ASOF)?.getDate()).toBe(5);
    expect(nextOccurrence(new Date(2026, 7, 5), 'monthly', ASOF)?.getMonth()).toBe(9); // 5 Oct
    expect(nextOccurrence(new Date(2026, 8, 1), 'weekly', ASOF)?.getDate()).toBe(22);
    expect(nextOccurrence(new Date(2025, 2, 1), 'yearly', ASOF)?.getFullYear()).toBe(2027);
  });

  it('drops a one-time bill that has passed', () => {
    expect(nextOccurrence(new Date(2026, 8, 1), 'one_time', ASOF)).toBeNull();
  });
});

describe('toBillItems', () => {
  const sub: Subscription = { id: 's', name: 'Canal+', categoryId: null, amountMinor: 15_000, currency: 'XAF', billingCycle: 'monthly', nextBillingAt: new Date(2026, 8, 25).toISOString(), isActive: true };
  const yearly: Subscription = { ...sub, id: 'y', name: 'Domain', amountMinor: 12_000, billingCycle: 'yearly', nextBillingAt: null };
  const rent: RecurringExpense = { id: 'r', name: 'Rent', categoryId: null, amountMinor: 120_000, currency: 'XAF', frequency: 'monthly', nextDueAt: new Date(2026, 8, 21).toISOString(), isActive: true };
  const stopped: RecurringExpense = { ...rent, id: 'x', name: 'Old gym', isActive: false };

  it('merges both sources, active only, soonest first and undated last', () => {
    const items = toBillItems([sub, yearly], [rent, stopped], ASOF);
    expect(items.map((i) => i.name)).toEqual(['Rent', 'Canal+', 'Domain']);
    expect(items[0]).toMatchObject({ source: 'recurring', inDays: 1, monthlyEquivalentMinor: 120_000 });
    expect(items[2]).toMatchObject({ nextDue: null, inDays: null, monthlyEquivalentMinor: 1_000 });
  });

  it('labels due dates in words', () => {
    const [rentItem, canal] = toBillItems([sub], [rent], ASOF);
    expect(formatDue(rentItem)).toBe('Due tomorrow');
    expect(formatDue(canal)).toBe('Due in 5 days');
    expect(formatDue({ nextDue: null, inDays: null })).toBe('No due date set');
  });
});

import { currentMonthKey, daysBetween, isInMonth, monthKeyOf, monthRange, shiftMonth } from './months';

describe('months', () => {
  it('formats a local date as YYYY-MM', () => {
    expect(monthKeyOf(new Date(2026, 8, 30))).toBe('2026-09');
    expect(currentMonthKey(new Date(2026, 0, 1))).toBe('2026-01');
  });

  it('shifts across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-09', -6)).toBe('2026-03');
  });

  it('returns UTC month bounds matching how the engine buckets months', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01T00:00:00.000Z', to: '2026-03-01T00:00:00.000Z' });
    expect(monthRange('2025-12').to).toBe('2026-01-01T00:00:00.000Z');
    expect(isInMonth('2026-02-28T23:30:00.000Z', '2026-02')).toBe(true);
    expect(isInMonth('2026-03-01T00:00:00.000Z', '2026-02')).toBe(false);
  });

  it('counts whole days between dates', () => {
    expect(daysBetween(new Date(2026, 8, 1, 10), new Date(2026, 8, 10, 9))).toBe(8);
    expect(daysBetween(new Date(2026, 8, 10), new Date(2026, 8, 1))).toBe(-9);
  });
});

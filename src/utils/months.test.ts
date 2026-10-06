import { currentMonthKey, daysBetween, monthKeyOf, monthRange, shiftMonth } from './months';

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

  it('returns a half-open range covering the whole month', () => {
    const { from, to } = monthRange('2026-02');
    expect(new Date(from).getTime()).toBe(new Date(2026, 1, 1).getTime());
    expect(new Date(to).getTime()).toBe(new Date(2026, 2, 1).getTime());
  });

  it('counts whole days between dates', () => {
    expect(daysBetween(new Date(2026, 8, 1, 10), new Date(2026, 8, 10, 9))).toBe(8);
    expect(daysBetween(new Date(2026, 8, 10), new Date(2026, 8, 1))).toBe(-9);
  });
});

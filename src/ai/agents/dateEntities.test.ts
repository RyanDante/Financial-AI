import { currentMonthKey, extractNamedMonthKey, mentionsComparison, previousMonthKey } from './dateEntities';

describe('currentMonthKey / previousMonthKey', () => {
  it('formats as YYYY-MM', () => {
    expect(currentMonthKey(new Date('2026-03-15T00:00:00.000Z'))).toBe('2026-03');
  });

  it('rolls back a month, including across a year boundary', () => {
    expect(previousMonthKey(new Date('2026-03-15T00:00:00.000Z'))).toBe('2026-02');
    expect(previousMonthKey(new Date('2026-01-15T00:00:00.000Z'))).toBe('2025-12');
  });
});

describe('extractNamedMonthKey', () => {
  it('finds a named month and assumes the current year', () => {
    expect(extractNamedMonthKey('how much did I spend in March?', new Date('2026-06-01T00:00:00.000Z'))).toBe('2026-03');
  });

  it('returns null when no month is named', () => {
    expect(extractNamedMonthKey('how much did I spend this month?')).toBeNull();
  });
});

describe('mentionsComparison', () => {
  it('recognizes comparison phrasing', () => {
    expect(mentionsComparison('how has my spending changed?')).toBe(true);
    expect(mentionsComparison('compare this to last month')).toBe(true);
    expect(mentionsComparison('vs last month')).toBe(true);
  });

  it('is false for a plain spending question', () => {
    expect(mentionsComparison('how much did I spend this month?')).toBe(false);
  });
});

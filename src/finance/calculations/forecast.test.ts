import { calculateForecast } from './forecast';

describe('calculateForecast', () => {
  it('projects one point per month, compounding the constant net cash flow', () => {
    const result = calculateForecast({
      currentBalanceMinor: 500000,
      netMonthlyCashflowMinor: 50000,
      months: 3,
      startDate: new Date('2026-01-15T00:00:00.000Z'),
    });

    expect(result.points).toHaveLength(3);
    expect(result.points.map((p) => p.projectedBalanceMinor)).toEqual([550000, 600000, 650000]);
    expect(result.points.map((p) => p.month)).toEqual(['2026-02', '2026-03', '2026-04']);
  });

  it('states the assumption the forecast rests on', () => {
    const result = calculateForecast({ currentBalanceMinor: 0, netMonthlyCashflowMinor: 1000, months: 1 });
    expect(result.basis).toContain('constant net cash flow');
  });

  it('reflects negative cash flow as a declining balance', () => {
    const result = calculateForecast({
      currentBalanceMinor: 100000,
      netMonthlyCashflowMinor: -30000,
      months: 2,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(result.points.map((p) => p.projectedBalanceMinor)).toEqual([70000, 40000]);
  });
});

import { calculateEmergencyReserve, calculateEmergencyReserveStatus, calculateSavingsRate } from './savings';

describe('calculateSavingsRate', () => {
  it('computes the percentage of income retained', () => {
    expect(calculateSavingsRate(200000, 150000)).toBe(25);
  });

  it('returns 0 when income is zero (undefined rate)', () => {
    expect(calculateSavingsRate(0, 1000)).toBe(0);
  });

  it('can be negative when spending exceeds income', () => {
    expect(calculateSavingsRate(100000, 150000)).toBe(-50);
  });
});

describe('calculateEmergencyReserve', () => {
  it('multiplies monthly essential expenses by the coverage months (default 3)', () => {
    expect(calculateEmergencyReserve(50000)).toBe(150000);
  });

  it('respects a custom coverage window', () => {
    expect(calculateEmergencyReserve(50000, 6)).toBe(300000);
  });
});

describe('calculateEmergencyReserveStatus', () => {
  it('reports the shortfall when under target', () => {
    expect(calculateEmergencyReserveStatus(100000, 150000)).toEqual({
      targetMinor: 150000,
      currentMinor: 100000,
      shortfallMinor: 50000,
      isMet: false,
      percentFunded: (100000 / 150000) * 100,
    });
  });

  it('reports no shortfall when target is met or exceeded', () => {
    const status = calculateEmergencyReserveStatus(200000, 150000);
    expect(status.isMet).toBe(true);
    expect(status.shortfallMinor).toBe(0);
    expect(status.percentFunded).toBe(100);
  });
});

import { resolveCurrency } from './activeCurrency';

jest.mock('@/database/repositories', () => ({ settingsRepository: { getSetting: jest.fn() } }));

describe('resolveCurrency', () => {
  it('keeps a supported code', () => {
    expect(resolveCurrency('USD')).toBe('USD');
  });
  it('falls back to XAF for missing or unknown values', () => {
    expect(resolveCurrency(null)).toBe('XAF');
    expect(resolveCurrency(undefined)).toBe('XAF');
    expect(resolveCurrency('')).toBe('XAF');
    expect(resolveCurrency('NGN')).toBe('XAF');
  });
});

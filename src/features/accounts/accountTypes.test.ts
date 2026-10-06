import { ACCOUNT_TYPES, canArchiveAccount, getAccountTypeMeta } from './accountTypes';

describe('getAccountTypeMeta', () => {
  it('labels every account type', () => {
    expect(ACCOUNT_TYPES.map((t) => t.type).sort()).toEqual(['cash', 'checking', 'credit', 'mobile_money', 'other', 'savings']);
    expect(getAccountTypeMeta('mobile_money').label).toBe('Mobile money');
    expect(getAccountTypeMeta('checking').label).toBe('Bank account');
  });
});

describe('canArchiveAccount', () => {
  const cash = { id: 'cash', isArchived: false };
  const momo = { id: 'momo', isArchived: false };

  it('refuses to archive the last active account', () => {
    expect(canArchiveAccount(cash, [cash])).toBe(false);
    expect(canArchiveAccount(cash, [cash, { id: 'old', isArchived: true }])).toBe(false);
  });

  it('allows archiving when another active account remains', () => {
    expect(canArchiveAccount(cash, [cash, momo])).toBe(true);
  });

  it('does not re-archive an archived account', () => {
    expect(canArchiveAccount({ id: 'old', isArchived: true }, [cash, momo])).toBe(false);
  });
});

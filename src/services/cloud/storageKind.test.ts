import { getStorageKindForEntityType } from './storageKind';

describe('getStorageKindForEntityType', () => {
  it('routes profile attachments to the profile path', () => {
    expect(getStorageKindForEntityType('profile')).toBe('profile');
  });

  it('routes transaction attachments to receipts', () => {
    expect(getStorageKindForEntityType('transaction')).toBe('receipts');
  });

  it('falls back to documents for any other owner type', () => {
    expect(getStorageKindForEntityType('goal')).toBe('documents');
    expect(getStorageKindForEntityType('debt')).toBe('documents');
    expect(getStorageKindForEntityType('')).toBe('documents');
  });
});

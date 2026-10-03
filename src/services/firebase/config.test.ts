import { getMissingFirebaseEnvKeys } from './config';

describe('getMissingFirebaseEnvKeys', () => {
  it('returns no missing keys when every value is present', () => {
    expect(
      getMissingFirebaseEnvKeys({
        apiKey: 'key',
        authDomain: 'domain',
        projectId: 'project',
        storageBucket: 'bucket',
        messagingSenderId: 'sender',
        appId: 'app',
      }),
    ).toEqual([]);
  });

  it('lists each missing or empty key by name', () => {
    expect(
      getMissingFirebaseEnvKeys({
        apiKey: 'key',
        authDomain: undefined,
        projectId: '',
        storageBucket: 'bucket',
      }),
    ).toEqual(['authDomain', 'projectId']);
  });

  it('has nothing to report for an empty env object (no keys to check)', () => {
    expect(getMissingFirebaseEnvKeys({})).toEqual([]);
  });
});

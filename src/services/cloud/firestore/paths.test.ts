import { aiConversationMessagesPath, userCollectionPath, userDocInCollectionPath, userDocPath, userStoragePath } from './paths';

describe('Firestore/Storage path builders', () => {
  it('builds the user profile doc path', () => {
    expect(userDocPath('uid123')).toBe('users/uid123');
  });

  it('builds a flat per-user collection path', () => {
    expect(userCollectionPath('uid123', 'transactions')).toBe('users/uid123/transactions');
  });

  it('builds a document path inside a per-user collection', () => {
    expect(userDocInCollectionPath('uid123', 'transactions', 'txn_abc')).toBe('users/uid123/transactions/txn_abc');
  });

  it('builds the nested AI messages subcollection path', () => {
    expect(aiConversationMessagesPath('uid123', 'conv_1')).toBe('users/uid123/aiConversations/conv_1/messages');
  });

  it('builds a Storage path scoped to the user and file kind', () => {
    expect(userStoragePath('uid123', 'receipts', 'file_1')).toBe('users/uid123/receipts/file_1');
  });

  it('never produces a path usable without a uid', () => {
    expect(userCollectionPath('', 'transactions')).not.toBe('transactions');
  });
});

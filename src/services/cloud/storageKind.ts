/**
 * Picks which Storage subpath an attachment belongs under, based on what
 * it's attached to. Deliberately its own file with zero SQLite/Firebase
 * imports: everything else in this directory transitively needs
 * expo-sqlite (via the repositories) or firebase/auth's AsyncStorage
 * dependency, neither of which has a native module under Jest — see
 * storageKind.test.ts and the comments in storage.ts / collection.ts for
 * the two different ways that bit this file before the split.
 */
export function getStorageKindForEntityType(ownerEntityType: string): 'profile' | 'receipts' | 'documents' {
  if (ownerEntityType === 'profile') return 'profile';
  if (ownerEntityType === 'transaction') return 'receipts';
  return 'documents';
}

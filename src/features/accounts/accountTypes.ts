import type { Ionicons } from '@expo/vector-icons';
import type { Account, AccountType } from '@/types/finance';

/** Display order and wording for account types; `mobile_money` matters most for XAF users. */
export const ACCOUNT_TYPES: { type: AccountType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'cash', label: 'Cash', icon: 'wallet-outline' },
  { type: 'mobile_money', label: 'Mobile money', icon: 'phone-portrait-outline' },
  { type: 'checking', label: 'Bank account', icon: 'card-outline' },
  { type: 'savings', label: 'Savings', icon: 'trending-up-outline' },
  { type: 'credit', label: 'Credit card', icon: 'card-outline' },
  { type: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

export function getAccountTypeMeta(type: AccountType): (typeof ACCOUNT_TYPES)[number] {
  return ACCOUNT_TYPES.find((t) => t.type === type) ?? ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
}

/** An account can be archived only while another active account remains to record transactions in. */
export function canArchiveAccount(account: Pick<Account, 'id' | 'isArchived'>, accounts: Pick<Account, 'id' | 'isArchived'>[]): boolean {
  if (account.isArchived) return false;
  return accounts.some((a) => a.id !== account.id && !a.isArchived);
}

import type { Ionicons } from '@expo/vector-icons';
import type { Account, AccountType } from '@/types/finance';
import { t } from '@/i18n';

/** Display order and wording for account types; `mobile_money` matters most for XAF users. */
export const ACCOUNT_TYPES: { type: AccountType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  typeMeta('cash', 'wallet-outline'),
  typeMeta('mobile_money', 'phone-portrait-outline'),
  typeMeta('checking', 'card-outline'),
  typeMeta('savings', 'trending-up-outline'),
  typeMeta('credit', 'card-outline'),
  typeMeta('other', 'ellipsis-horizontal'),
];

/** `label` is read at access time, so it follows the app language. */
function typeMeta(type: AccountType, icon: keyof typeof Ionicons.glyphMap): { type: AccountType; label: string; icon: keyof typeof Ionicons.glyphMap } {
  return {
    type,
    icon,
    get label() {
      return t(`accountType.${type}`);
    },
  };
}

export function getAccountTypeMeta(type: AccountType): (typeof ACCOUNT_TYPES)[number] {
  return ACCOUNT_TYPES.find((t) => t.type === type) ?? ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
}

/** An account can be archived only while another active account remains to record transactions in. */
export function canArchiveAccount(account: Pick<Account, 'id' | 'isArchived'>, accounts: Pick<Account, 'id' | 'isArchived'>[]): boolean {
  if (account.isArchived) return false;
  return accounts.some((a) => a.id !== account.id && !a.isArchived);
}

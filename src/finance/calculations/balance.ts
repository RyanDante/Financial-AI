import type { MinorUnits } from '@/utils/currency';
import type { Account, Transaction } from '@/types/finance';

/**
 * Computes an account's current balance from its opening balance plus every
 * transaction that touches it (as the primary account or as the receiving
 * side of a transfer). Pure and deterministic — the only source of truth
 * for "what is the balance" anywhere in the app.
 */
export function calculateBalance(account: Pick<Account, 'id' | 'initialBalanceMinor'>, transactions: Transaction[]): MinorUnits {
  let balance = account.initialBalanceMinor;

  for (const tx of transactions) {
    if (tx.type === 'income' && tx.accountId === account.id) {
      balance += tx.amountMinor;
    } else if (tx.type === 'expense' && tx.accountId === account.id) {
      balance -= tx.amountMinor;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === account.id) {
        balance -= tx.amountMinor;
      } else if (tx.transferAccountId === account.id) {
        balance += tx.amountMinor;
      }
    }
  }

  return balance;
}

export interface AvailableMoneyParams {
  totalBalanceMinor: MinorUnits;
  upcomingObligationsMinor: MinorUnits;
  reserveTargetMinor: MinorUnits;
}

/**
 * "How much can I safely spend right now?" — balance minus what's already
 * committed (upcoming bills/obligations) minus the emergency reserve
 * target. Can be negative, meaning the user is already short.
 */
export function calculateAvailableMoney(params: AvailableMoneyParams): MinorUnits {
  return params.totalBalanceMinor - params.upcomingObligationsMinor - params.reserveTargetMinor;
}

export interface DiscretionaryMoneyParams extends AvailableMoneyParams {
  /** Remaining allowance in the active discretionary budget categories, if any. */
  budgetRemainingMinor?: MinorUnits;
}

/**
 * Like calculateAvailableMoney, but also capped by whatever is left in the
 * user's discretionary budget for the period, when one exists.
 */
export function calculateDiscretionaryMoney(params: DiscretionaryMoneyParams): MinorUnits {
  const available = calculateAvailableMoney(params);
  if (params.budgetRemainingMinor === undefined) {
    return available;
  }
  return Math.min(available, params.budgetRemainingMinor);
}

/**
 * Linear projection of balance after N months assuming a constant monthly
 * net cash flow. This is explicitly a PROJECTION built on an ASSUMPTION
 * (that the recent cash-flow pattern continues) — callers surfacing this to
 * the user should label it as such rather than as fact.
 */
export function calculateProjectedBalance(
  currentBalanceMinor: MinorUnits,
  netMonthlyCashflowMinor: MinorUnits,
  monthsAhead: number,
): MinorUnits {
  return currentBalanceMinor + netMonthlyCashflowMinor * monthsAhead;
}

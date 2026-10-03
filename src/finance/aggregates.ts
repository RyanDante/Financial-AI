import { accountsRepository, recurringExpensesRepository, settingsRepository, subscriptionsRepository, transactionsRepository } from '@/database/repositories';
import { calculateBalance, calculateEmergencyReserve, calculateMonthlySpending, calculateRecurringExpenses, calculateSubscriptionCost } from '@/finance/calculations';
import type { CurrencyCode } from '@/constants/currencies';
import type { MinorUnits } from '@/utils/currency';

/**
 * Composed reads that sit above the raw repositories — shared by the AI
 * tools and the dashboard so both read "current balance" / "upcoming
 * obligations" / "reserve target" the exact same way.
 */

export async function getTotalBalanceMinor(currency: CurrencyCode): Promise<MinorUnits> {
  const accounts = (await accountsRepository.listAccounts()).filter((a) => a.currency === currency);
  const transactions = await transactionsRepository.listTransactions({});
  return accounts.reduce((sum, account) => sum + calculateBalance(account, transactions), 0);
}

export async function getUpcomingObligationsMinor(currency: CurrencyCode): Promise<MinorUnits> {
  const [recurringExpenses, subscriptions] = await Promise.all([
    recurringExpensesRepository.listRecurringExpenses(true),
    subscriptionsRepository.listSubscriptions(true),
  ]);
  const recurringTotal = calculateRecurringExpenses(recurringExpenses.filter((e) => e.currency === currency)).monthlyTotalMinor;
  const subscriptionTotal = calculateSubscriptionCost(subscriptions.filter((s) => s.currency === currency)).monthlyTotalMinor;
  return recurringTotal + subscriptionTotal;
}

function previousMonthKey(from = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The reserve target is a user setting when they've set one explicitly;
 * otherwise it's estimated as 3 months of last month's spending, which is
 * itself an ASSUMPTION-tier estimate, not a fact.
 */
export async function getReserveTargetMinor(currency: CurrencyCode): Promise<MinorUnits> {
  const override = await settingsRepository.getSetting(`reserve_target_minor_${currency}`);
  if (override !== null) {
    return Number(override);
  }
  const transactions = await transactionsRepository.listTransactions({ type: 'expense' });
  const lastMonthSpending = calculateMonthlySpending(
    transactions.filter((tx) => tx.currency === currency),
    previousMonthKey(),
  );
  return calculateEmergencyReserve(lastMonthSpending, 3);
}

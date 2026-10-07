import {
  accountsRepository,
  budgetsRepository,
  categoriesRepository,
  debtsRepository,
  goalsRepository,
  incomeRepository,
  recurringExpensesRepository,
  subscriptionsRepository,
  transactionsRepository,
} from '@/database/repositories';
import {
  calculateAvailableMoney,
  calculateBalance,
  calculateBudgetRemaining,
  calculateCashFlow,
  calculateForecast,
  calculateGoalProgress,
  calculateMonthlySpending,
  calculateProjectedCompletionDate,
  calculatePurchaseImpact,
  calculateRecurringExpenses,
  calculateRequiredMonthlySavings,
  calculateSpendingByCategory,
  calculateSubscriptionCost,
} from '@/finance/calculations';
import { getReserveTargetMinor, getTotalBalanceMinor, getUpcomingObligationsMinor } from '@/finance/aggregates';
import type { CurrencyCode } from '@/constants/currencies';
import { getActiveCurrency } from '@/features/currency/activeCurrency';
import { toBillItems } from '@/features/bills/bills';
import { buildRecommendations } from '@/features/recommendations/recommendations';
import { buildAlerts } from '@/features/alerts/alerts';
import { MS_PER_DAY } from '@/utils/months';
import { dailyAllowance, nextDebtDueDate, nextPayday } from '@/features/allowance/allowance';
import type { ToolRegistry } from './types';

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Registers every tool the AI layer is allowed to call. Each tool reads
 * through a repository and/or the financial engine and returns structured
 * data, never prose — no tool ever returns a natural-language answer, so
 * the AI can explain these results but can't substitute its own numbers
 * for them.
 */
export function registerFinancialTools(registry: ToolRegistry): void {
  registry.register({
    name: 'getBalance',
    description: "Returns the user's account balances and total balance for a currency.",
    inputSchema: { type: 'object', properties: { currency: { type: 'string', enum: ['XAF', 'USD', 'EUR', 'GBP'], description: 'Currency code. Defaults to the app default currency.' } }, additionalProperties: false },
    execute: async (input: { currency?: CurrencyCode }) => {
      const currency = input?.currency ?? (await getActiveCurrency());
      const accounts = (await accountsRepository.listAccounts()).filter((a) => a.currency === currency);
      const transactions = await transactionsRepository.listTransactions({});
      const perAccount = accounts.map((account) => ({
        accountId: account.id,
        accountName: account.name,
        balanceMinor: calculateBalance(account, transactions),
      }));
      return {
        currency,
        accounts: perAccount,
        totalBalanceMinor: perAccount.reduce((s, a) => s + a.balanceMinor, 0),
      };
    },
  });

  registry.register({
    name: 'getAccounts',
    description: "Returns the user's accounts (name, type, currency) without balances — use getBalance for balances.",
    inputSchema: { type: 'object', properties: { includeArchived: { type: 'boolean', description: 'Include archived accounts. Defaults to false.' } }, additionalProperties: false },
    execute: async (input: { includeArchived?: boolean }) => accountsRepository.listAccounts(input?.includeArchived ?? false),
  });

  registry.register({
    name: 'getTransactions',
    description: 'Returns transactions matching an optional filter (account, category, type, date range).',
    inputSchema: { type: 'object', properties: { accountId: { type: 'string' }, categoryId: { type: 'string' }, type: { type: 'string', enum: ['income', 'expense', 'transfer'] }, from: { type: 'string', description: 'ISO date, inclusive.' }, to: { type: 'string', description: 'ISO date, inclusive.' }, limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Maximum rows, newest first. Defaults to 50.' } }, additionalProperties: false },
    execute: async (input: Parameters<typeof transactionsRepository.listTransactions>[0]) => transactionsRepository.listTransactions({ limit: 50, ...input }),
  });

  registry.register({
    name: 'getSpending',
    description: 'Returns the total amount spent in a given month ("YYYY-MM", defaults to the current month). Use getSpendingByCategory for a breakdown.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'Month as "YYYY-MM". Defaults to the current month.' } }, additionalProperties: false },
    execute: async (input: { month?: string }) => {
      const month = input?.month ?? currentMonthKey();
      const transactions = await transactionsRepository.listTransactions({ from: `${month}-01`, to: `${month}-31` });
      return { month, totalSpentMinor: calculateMonthlySpending(transactions, month) };
    },
  });

  registry.register({
    name: 'getSpendingByCategory',
    description: 'Returns spending broken down and ranked by category for a given month ("YYYY-MM", defaults to the current month).',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'Month as "YYYY-MM". Defaults to the current month.' } }, additionalProperties: false },
    execute: async (input: { month?: string }) => {
      const month = input?.month ?? currentMonthKey();
      const [transactions, categories] = await Promise.all([
        transactionsRepository.listTransactions({ from: `${month}-01`, to: `${month}-31` }),
        categoriesRepository.listCategories(),
      ]);
      return { month, categories: calculateSpendingByCategory(transactions, categories) };
    },
  });

  registry.register({
    name: 'getBudget',
    description: 'Returns the raw budget and its category limits for a given month ("YYYY-MM", defaults to the current month), or null if none exists yet.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'Month as "YYYY-MM". Defaults to the current month.' } }, additionalProperties: false },
    execute: async (input: { month?: string }) => {
      const month = input?.month ?? currentMonthKey();
      const budget = await budgetsRepository.getBudgetForMonth(month);
      if (!budget) return { month, budget: null, categories: [] };
      return { month, budget, categories: await budgetsRepository.listBudgetCategories(budget.id) };
    },
  });

  registry.register({
    name: 'getBudgetStatus',
    description: 'Returns the budget for a month combined with actual spending per category — remaining allowance, percent used, and over-budget flags.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'Month as "YYYY-MM". Defaults to the current month.' } }, additionalProperties: false },
    execute: async (input: { month?: string }) => {
      const month = input?.month ?? currentMonthKey();
      const budget = await budgetsRepository.getBudgetForMonth(month);
      if (!budget) return { month, budget: null, categories: [] };

      const [budgetCategories, categories, transactions] = await Promise.all([
        budgetsRepository.listBudgetCategories(budget.id),
        categoriesRepository.listCategories(),
        transactionsRepository.listTransactions({ from: `${month}-01`, to: `${month}-31` }),
      ]);
      const categoryById = new Map(categories.map((c) => [c.id, c]));

      return {
        month,
        budget,
        categories: budgetCategories.map((bc) => {
          const spentMinor = calculateMonthlySpending(transactions.filter((tx) => tx.categoryId === bc.categoryId), month);
          return {
            categoryId: bc.categoryId,
            categoryName: categoryById.get(bc.categoryId)?.name ?? 'Unknown',
            ...calculateBudgetRemaining(bc.limitMinor, spentMinor),
          };
        }),
      };
    },
  });

  registry.register({
    name: 'getGoals',
    description: "Returns the user's financial goals with progress toward each.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const goals = await goalsRepository.listGoals();
      return goals.map((goal) => ({
        goal,
        progress: calculateGoalProgress(goal),
        requiredMonthlySavingsMinor: calculateRequiredMonthlySavings(goal),
      }));
    },
  });

  registry.register({
    name: 'getGoalProgress',
    description: 'Returns progress and required savings pace for a single goal by id.',
    inputSchema: { type: 'object', properties: { goalId: { type: 'string', description: 'Goal id from getGoals.' } }, required: ['goalId'], additionalProperties: false },
    execute: async (input: { goalId: string }) => {
      const goal = await goalsRepository.getGoalById(input.goalId);
      if (!goal) return null;
      return {
        goal,
        progress: calculateGoalProgress(goal),
        requiredMonthlySavingsMinor: calculateRequiredMonthlySavings(goal),
      };
    },
  });

  registry.register({
    name: 'calculateGoalProjection',
    description: 'Given a hypothetical monthly contribution, returns the projected date a goal would be reached ("what if I saved X/month toward this goal?").',
    inputSchema: { type: 'object', properties: { goalId: { type: 'string', description: 'Goal id from getGoals.' }, monthlyContributionMinor: { type: 'integer', minimum: 0, description: 'Hypothetical monthly contribution in minor units (XAF: 1 = 1 FCFA).' } }, required: ['goalId', 'monthlyContributionMinor'], additionalProperties: false },
    execute: async (input: { goalId: string; monthlyContributionMinor: number }) => {
      const goal = await goalsRepository.getGoalById(input.goalId);
      if (!goal) return null;
      const projectedCompletionDate = calculateProjectedCompletionDate(goal, input.monthlyContributionMinor);
      return { goal, monthlyContributionMinor: input.monthlyContributionMinor, projectedCompletionDate };
    },
  });

  registry.register({
    name: 'calculateCashFlow',
    description: 'Returns income, expense, and net cash flow for a given month ("YYYY-MM", defaults to the current month).',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'Month as "YYYY-MM". Defaults to the current month.' }, currency: { type: 'string', enum: ['XAF', 'USD', 'EUR', 'GBP'], description: 'Currency code. Defaults to the app default currency.' } }, additionalProperties: false },
    execute: async (input: { month?: string; currency?: CurrencyCode }) => {
      const month = input?.month ?? currentMonthKey();
      const currency = input?.currency ?? (await getActiveCurrency());
      const transactions = await transactionsRepository.listTransactions({ from: `${month}-01`, to: `${month}-31` });
      return { month, currency, ...calculateCashFlow(transactions.filter((tx) => tx.currency === currency), month) };
    },
  });

  registry.register({
    name: 'getSubscriptions',
    description: 'Returns active subscriptions ranked by monthly cost, with monthly/yearly totals.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => calculateSubscriptionCost(await subscriptionsRepository.listSubscriptions(true)),
  });

  registry.register({
    name: 'getUpcomingObligations',
    description: 'Returns the estimated monthly total of recurring expenses and subscriptions for a currency.',
    inputSchema: { type: 'object', properties: { currency: { type: 'string', enum: ['XAF', 'USD', 'EUR', 'GBP'], description: 'Currency code. Defaults to the app default currency.' } }, additionalProperties: false },
    execute: async (input: { currency?: CurrencyCode }) => {
      const currency = input?.currency ?? (await getActiveCurrency());
      const recurringExpenses = await recurringExpensesRepository.listRecurringExpenses(true);
      return {
        currency,
        monthlyTotalMinor: calculateRecurringExpenses(recurringExpenses.filter((e) => e.currency === currency)).monthlyTotalMinor,
      };
    },
  });

  registry.register({
    name: 'calculatePurchaseImpact',
    description: 'Given a prospective purchase amount, returns the structured facts of its impact on balance, obligations, reserve, and goals. Never a recommendation.',
    inputSchema: { type: 'object', properties: { purchaseAmountMinor: { type: 'integer', minimum: 1, description: 'Purchase price in minor units (XAF: 1 = 1 FCFA; USD: cents).' }, currency: { type: 'string', enum: ['XAF', 'USD', 'EUR', 'GBP'], description: 'Currency code. Defaults to the app default currency.' } }, required: ['purchaseAmountMinor'], additionalProperties: false },
    execute: async (input: { purchaseAmountMinor: number; currency?: CurrencyCode }) => {
      const currency = input.currency ?? (await getActiveCurrency());
      const [currentBalanceMinor, upcomingObligationsMinor, reserveTargetMinor, goals] = await Promise.all([
        getTotalBalanceMinor(currency),
        getUpcomingObligationsMinor(currency),
        getReserveTargetMinor(currency),
        goalsRepository.listGoals('active'),
      ]);

      const goalInputs = goals
        .filter((g) => g.currency === currency)
        .map((goal) => ({
          goalId: goal.id,
          goalName: goal.name,
          monthlyContributionMinor: calculateRequiredMonthlySavings(goal) ?? 0,
        }));

      return calculatePurchaseImpact({
        currentBalanceMinor,
        purchaseAmountMinor: input.purchaseAmountMinor,
        upcomingObligationsMinor,
        reserveTargetMinor,
        goals: goalInputs,
      });
    },
  });

  registry.register({
    name: 'forecastBalance',
    description:
      'Projects balance forward N months assuming last month\'s net cash flow continues, optionally adjusted by a hypothetical monthly delta ("what if I saved/spent X more per month") — still an ASSUMPTION-tier projection.',
    inputSchema: { type: 'object', properties: { months: { type: 'integer', minimum: 1, maximum: 60, description: 'How many months ahead to project.' }, currency: { type: 'string', enum: ['XAF', 'USD', 'EUR', 'GBP'], description: 'Currency code. Defaults to the app default currency.' }, monthlyAdjustmentMinor: { type: 'integer', description: 'Added to the observed monthly net cash flow: +X models saving more, -X spending more. Minor units.' } }, required: ['months'], additionalProperties: false },
    execute: async (input: { months: number; currency?: CurrencyCode; monthlyAdjustmentMinor?: number }) => {
      const currency = input.currency ?? (await getActiveCurrency());
      const [currentBalanceMinor, transactions] = await Promise.all([
        getTotalBalanceMinor(currency),
        transactionsRepository.listTransactions({}),
      ]);
      const lastMonth = currentMonthKey();
      const cashFlow = calculateCashFlow(transactions.filter((tx) => tx.currency === currency), lastMonth);
      const netMonthlyCashflowMinor = cashFlow.netMinor + (input.monthlyAdjustmentMinor ?? 0);
      return calculateForecast({ currentBalanceMinor, netMonthlyCashflowMinor, months: input.months });
    },
  });

  registry.register({
    name: 'getBills',
    description: 'Returns active bills and subscriptions, soonest due first, with amount, frequency, monthly equivalent and days until the next due date.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const [subscriptions, recurringExpenses] = await Promise.all([
        subscriptionsRepository.listSubscriptions(true),
        recurringExpensesRepository.listRecurringExpenses(true),
      ]);
      return toBillItems(subscriptions, recurringExpenses).map((bill) => ({
        name: bill.name,
        kind: bill.source,
        amountMinor: bill.amountMinor,
        currency: bill.currency,
        frequency: bill.frequency,
        monthlyEquivalentMinor: bill.monthlyEquivalentMinor,
        nextDue: bill.nextDue?.toISOString() ?? null,
        daysUntilDue: bill.inDays,
      }));
    },
  });

  registry.register({
    name: 'getAccountsWithBalances',
    description: "Returns every active account (cash, mobile money, bank, savings, credit) with its type, currency and current balance.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const [accounts, transactions] = await Promise.all([accountsRepository.listAccounts(), transactionsRepository.listTransactions({})]);
      return accounts.map((account) => ({
        accountId: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        balanceMinor: calculateBalance(account, transactions),
      }));
    },
  });

  registry.register({
    name: 'getRecommendations',
    description: "Returns the app's current suggestions: purchases the user makes regularly that look due (with typical amounts), bills due within a week, and everyday essentials with the remaining category budget.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const currency = await getActiveCurrency();
      const month = currentMonthKey();
      const since = new Date(Date.now() - 90 * MS_PER_DAY).toISOString();
      const budget = await budgetsRepository.getBudgetForMonth(month);
      const [categories, transactions, budgetCategories, subscriptions, recurringExpenses] = await Promise.all([
        categoriesRepository.listCategories(),
        transactionsRepository.listTransactions({ from: since }),
        budget ? budgetsRepository.listBudgetCategories(budget.id) : Promise.resolve([]),
        subscriptionsRepository.listSubscriptions(true),
        recurringExpensesRepository.listRecurringExpenses(true),
      ]);
      return buildRecommendations({ currency, month, categories, transactions, budgetCategories, subscriptions, recurringExpenses }).map(
        ({ kind, reason, title, detail }) => ({ kind, reason, title, detail }),
      );
    },
  });

  registry.register({
    name: 'getAlerts',
    description: 'Returns what currently needs attention: negative safe-to-spend, over-budget categories, goals past their deadline, and bills due within 3 days.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const currency = await getActiveCurrency();
      const month = currentMonthKey();
      const budget = await budgetsRepository.getBudgetForMonth(month);
      const [categories, transactions, goals, budgetCategories, subscriptions, recurringExpenses, totalBalanceMinor, upcomingObligationsMinor, reserveTargetMinor] = await Promise.all([
        categoriesRepository.listCategories(),
        transactionsRepository.listTransactions({ from: `${month}-01` }),
        goalsRepository.listGoals(),
        budget ? budgetsRepository.listBudgetCategories(budget.id) : Promise.resolve([]),
        subscriptionsRepository.listSubscriptions(true),
        recurringExpensesRepository.listRecurringExpenses(true),
        getTotalBalanceMinor(currency),
        getUpcomingObligationsMinor(currency),
        getReserveTargetMinor(currency),
      ]);
      return buildAlerts({
        currency,
        month,
        categories,
        transactions,
        goals,
        budgetCategories,
        totalBalanceMinor,
        upcomingObligationsMinor,
        reserveTargetMinor,
        syncStatus: 'synced',
        syncErrorMessage: null,
        attachmentUploadError: null,
        bills: toBillItems(subscriptions, recurringExpenses),
      }).map(({ severity, title, detail }) => ({ severity, title, detail }));
    },
  });

  registry.register({
    name: 'getDebts',
    description: 'Returns debts in both directions: money the user owes (i_owe) and money owed to them (owed_to_me), with amount left, original amount, monthly payment and next due date.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () =>
      (await debtsRepository.listDebts()).map((debt) => ({
        name: debt.name,
        direction: debt.direction,
        counterparty: debt.counterparty,
        currency: debt.currency,
        principalMinor: debt.principalMinor,
        remainingMinor: debt.remainingMinor,
        minimumPaymentMinor: debt.minimumPaymentMinor,
        nextDue: nextDebtDueDate(debt)?.toISOString() ?? null,
      })),
  });

  registry.register({
    name: 'getIncomeAndAllowance',
    description: "Returns the user's income sources, the next payday, and the daily allowance: safe-to-spend divided by the days until payday.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const currency = await getActiveCurrency();
      const [sources, totalBalanceMinor, upcomingObligationsMinor, reserveTargetMinor] = await Promise.all([
        incomeRepository.listIncomeSources(true),
        getTotalBalanceMinor(currency),
        getUpcomingObligationsMinor(currency),
        getReserveTargetMinor(currency),
      ]);
      const availableMinor = calculateAvailableMoney({ totalBalanceMinor, upcomingObligationsMinor, reserveTargetMinor });
      const payday = nextPayday(sources);
      const allowance = dailyAllowance(availableMinor, sources);
      return {
        currency,
        incomeSources: sources.map((s) => ({ source: s.source, amountMinor: s.amountMinor, frequency: s.frequency })),
        nextPayday: payday ? { source: payday.source, date: payday.date.toISOString(), inDays: payday.inDays } : null,
        availableToSpendSafelyMinor: availableMinor,
        dailyAllowanceMinor: allowance?.perDayMinor ?? null,
      };
    },
  });
}

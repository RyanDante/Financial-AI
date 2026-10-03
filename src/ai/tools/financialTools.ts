import {
  accountsRepository,
  budgetsRepository,
  categoriesRepository,
  goalsRepository,
  recurringExpensesRepository,
  subscriptionsRepository,
  transactionsRepository,
} from '@/database/repositories';
import {
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
import { DEFAULT_CURRENCY, type CurrencyCode } from '@/constants/currencies';
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
    inputSchema: { currency: 'string (optional, defaults to the app default currency)' },
    execute: async (input: { currency?: CurrencyCode }) => {
      const currency = input?.currency ?? DEFAULT_CURRENCY;
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
    inputSchema: { includeArchived: 'boolean?' },
    execute: async (input: { includeArchived?: boolean }) => accountsRepository.listAccounts(input?.includeArchived ?? false),
  });

  registry.register({
    name: 'getTransactions',
    description: 'Returns transactions matching an optional filter (account, category, type, date range).',
    inputSchema: { accountId: 'string?', categoryId: 'string?', type: 'income|expense|transfer?', from: 'ISO date?', to: 'ISO date?', limit: 'number?' },
    execute: async (input: Parameters<typeof transactionsRepository.listTransactions>[0]) => transactionsRepository.listTransactions(input ?? {}),
  });

  registry.register({
    name: 'getSpending',
    description: 'Returns the total amount spent in a given month ("YYYY-MM", defaults to the current month). Use getSpendingByCategory for a breakdown.',
    inputSchema: { month: 'string? ("YYYY-MM")' },
    execute: async (input: { month?: string }) => {
      const month = input?.month ?? currentMonthKey();
      const transactions = await transactionsRepository.listTransactions({ from: `${month}-01`, to: `${month}-31` });
      return { month, totalSpentMinor: calculateMonthlySpending(transactions, month) };
    },
  });

  registry.register({
    name: 'getSpendingByCategory',
    description: 'Returns spending broken down and ranked by category for a given month ("YYYY-MM", defaults to the current month).',
    inputSchema: { month: 'string? ("YYYY-MM")' },
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
    inputSchema: { month: 'string? ("YYYY-MM")' },
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
    inputSchema: { month: 'string? ("YYYY-MM")' },
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
    inputSchema: {},
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
    inputSchema: { goalId: 'string' },
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
    inputSchema: { goalId: 'string', monthlyContributionMinor: 'number' },
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
    inputSchema: { month: 'string? ("YYYY-MM")', currency: 'string?' },
    execute: async (input: { month?: string; currency?: CurrencyCode }) => {
      const month = input?.month ?? currentMonthKey();
      const currency = input?.currency ?? DEFAULT_CURRENCY;
      const transactions = await transactionsRepository.listTransactions({ from: `${month}-01`, to: `${month}-31` });
      return { month, currency, ...calculateCashFlow(transactions.filter((tx) => tx.currency === currency), month) };
    },
  });

  registry.register({
    name: 'getSubscriptions',
    description: 'Returns active subscriptions ranked by monthly cost, with monthly/yearly totals.',
    inputSchema: {},
    execute: async () => calculateSubscriptionCost(await subscriptionsRepository.listSubscriptions(true)),
  });

  registry.register({
    name: 'getUpcomingObligations',
    description: 'Returns the estimated monthly total of recurring expenses and subscriptions for a currency.',
    inputSchema: { currency: 'string?' },
    execute: async (input: { currency?: CurrencyCode }) => {
      const currency = input?.currency ?? DEFAULT_CURRENCY;
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
    inputSchema: { purchaseAmountMinor: 'number', currency: 'string?' },
    execute: async (input: { purchaseAmountMinor: number; currency?: CurrencyCode }) => {
      const currency = input.currency ?? DEFAULT_CURRENCY;
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
    description: 'Projects balance forward N months assuming last month\'s net cash flow continues (an ASSUMPTION-tier projection).',
    inputSchema: { months: 'number', currency: 'string?' },
    execute: async (input: { months: number; currency?: CurrencyCode }) => {
      const currency = input.currency ?? DEFAULT_CURRENCY;
      const [currentBalanceMinor, transactions] = await Promise.all([
        getTotalBalanceMinor(currency),
        transactionsRepository.listTransactions({}),
      ]);
      const lastMonth = currentMonthKey();
      const cashFlow = calculateCashFlow(transactions.filter((tx) => tx.currency === currency), lastMonth);
      return calculateForecast({ currentBalanceMinor, netMonthlyCashflowMinor: cashFlow.netMinor, months: input.months });
    },
  });
}

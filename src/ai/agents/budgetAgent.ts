import { formatMoney } from '@/utils/currency';
import { currentMonthKey, extractNamedMonthKey } from './dateEntities';
import { buildAgentResponse, type AgentClaim, type AgentDefinition } from './types';

export const BUDGET_AGENT_TOOLS = ['getBudget', 'getBudgetStatus', 'getSpending', 'getSpendingByCategory'];

const NEAR_LIMIT_THRESHOLD_PERCENT = 85;

interface BudgetCategoryStatus {
  categoryId: string;
  categoryName: string;
  limitMinor: number;
  spentMinor: number;
  remainingMinor: number;
  percentUsed: number;
  isOverBudget: boolean;
}

interface BudgetStatusResult {
  month: string;
  budget: { id: string; name: string; currency: string } | null;
  categories: BudgetCategoryStatus[];
}

/**
 * Read-only. Answers "how much budget / am I over / which categories are
 * close to their limit" using getBudgetStatus — which already combines
 * the budget's limits with actual spending via calculateBudgetRemaining
 * (the financial engine). This agent only picks which numbers to surface
 * for the question asked; it never recomputes a limit, a spent total, or
 * a percentage itself.
 */
export const budgetAgent: AgentDefinition = {
  id: 'budget',
  name: 'Budget Agent',
  description: 'Reports budget status — remaining allowance, overspending, and categories close to their limit.',
  supportedIntents: ['budget'],
  allowedTools: BUDGET_AGENT_TOOLS,

  async execute(request, context, tools) {
    const month = extractNamedMonthKey(request.text) ?? currentMonthKey();
    const status = (await tools.execute('getBudgetStatus', { month })) as BudgetStatusResult;

    if (!status.budget) {
      return buildAgentResponse({
        claims: [{ kind: 'fact', text: `No budget has been set for ${month} yet.` }],
        followUpSuggestions: ['Want to set up a budget for this month?'],
      });
    }

    if (status.categories.length === 0) {
      return buildAgentResponse({
        claims: [{ kind: 'fact', text: `Your ${month} budget doesn't have any category limits set yet.` }],
      });
    }

    const claims: AgentClaim[] = [];

    const namedCategory = status.categories.find((c) => new RegExp(`\\b${escapeRegExp(c.categoryName)}\\b`, 'i').test(request.text));

    if (namedCategory) {
      claims.push({
        kind: 'fact',
        text: `You've spent ${formatMoney(namedCategory.spentMinor, context.currency)} of your ${formatMoney(namedCategory.limitMinor, context.currency)} ${namedCategory.categoryName} budget.`,
      });
      claims.push({
        kind: 'calculation',
        text: namedCategory.isOverBudget
          ? `That's ${formatMoney(Math.abs(namedCategory.remainingMinor), context.currency)} over the limit.`
          : `${formatMoney(namedCategory.remainingMinor, context.currency)} remaining (${namedCategory.percentUsed.toFixed(0)}% used).`,
      });
    } else {
      const totalLimitMinor = status.categories.reduce((sum, c) => sum + c.limitMinor, 0);
      const totalSpentMinor = status.categories.reduce((sum, c) => sum + c.spentMinor, 0);
      const totalRemainingMinor = totalLimitMinor - totalSpentMinor;

      claims.push({
        kind: 'fact',
        text: `You've spent ${formatMoney(totalSpentMinor, context.currency)} of your ${formatMoney(totalLimitMinor, context.currency)} budget for ${month}.`,
      });
      claims.push({
        kind: 'calculation',
        text:
          totalRemainingMinor >= 0
            ? `${formatMoney(totalRemainingMinor, context.currency)} remaining (${((totalSpentMinor / totalLimitMinor) * 100).toFixed(0)}% used).`
            : `You're ${formatMoney(Math.abs(totalRemainingMinor), context.currency)} over budget overall.`,
      });
    }

    const overBudget = status.categories.filter((c) => c.isOverBudget);
    if (overBudget.length > 0) {
      claims.push({ kind: 'fact', text: `Over budget: ${overBudget.map((c) => c.categoryName).join(', ')}.` });
    }

    const nearLimit = status.categories.filter((c) => !c.isOverBudget && c.percentUsed >= NEAR_LIMIT_THRESHOLD_PERCENT);
    if (nearLimit.length > 0) {
      claims.push({
        kind: 'fact',
        text: `Close to their limit: ${nearLimit.map((c) => `${c.categoryName} (${c.percentUsed.toFixed(0)}%)`).join(', ')}.`,
      });
    }

    return buildAgentResponse({ claims, metadata: { month } });
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

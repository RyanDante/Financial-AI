import { formatMoney } from '@/utils/currency';
import { currentMonthKey, extractNamedMonthKey } from './dateEntities';
import { buildAgentResponse, type AgentClaim, type AgentDefinition } from './types';
import { categoryLabel, t } from '@/i18n';

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
        claims: [{ kind: 'fact', text: t('ag.budget.none', { month }) }],
        followUpSuggestions: [t('ag.budget.setUp')],
      });
    }

    if (status.categories.length === 0) {
      return buildAgentResponse({
        claims: [{ kind: 'fact', text: t('ag.budget.noLimits', { month }) }],
      });
    }

    const claims: AgentClaim[] = [];

    const namedCategory = status.categories.find((c) => new RegExp(`\\b${escapeRegExp(c.categoryName)}\\b`, 'i').test(request.text));

    if (namedCategory) {
      claims.push({
        kind: 'fact',
        text: t('ag.budget.namedSpent', { spent: formatMoney(namedCategory.spentMinor, context.currency), limit: formatMoney(namedCategory.limitMinor, context.currency), category: categoryLabel(namedCategory.categoryName) }),
      });
      claims.push({
        kind: 'calculation',
        text: namedCategory.isOverBudget
          ? t('ag.budget.namedOver', { amount: formatMoney(Math.abs(namedCategory.remainingMinor), context.currency) })
          : t('ag.budget.remaining', { amount: formatMoney(namedCategory.remainingMinor, context.currency), percent: namedCategory.percentUsed.toFixed(0) }),
      });
    } else {
      const totalLimitMinor = status.categories.reduce((sum, c) => sum + c.limitMinor, 0);
      const totalSpentMinor = status.categories.reduce((sum, c) => sum + c.spentMinor, 0);
      const totalRemainingMinor = totalLimitMinor - totalSpentMinor;

      claims.push({
        kind: 'fact',
        text: t('ag.budget.totalSpent', { spent: formatMoney(totalSpentMinor, context.currency), limit: formatMoney(totalLimitMinor, context.currency), month }),
      });
      claims.push({
        kind: 'calculation',
        text:
          totalRemainingMinor >= 0
            ? t('ag.budget.remaining', { amount: formatMoney(totalRemainingMinor, context.currency), percent: ((totalSpentMinor / totalLimitMinor) * 100).toFixed(0) })
            : t('ag.budget.totalOver', { amount: formatMoney(Math.abs(totalRemainingMinor), context.currency) }),
      });
    }

    const overBudget = status.categories.filter((c) => c.isOverBudget);
    if (overBudget.length > 0) {
      claims.push({ kind: 'fact', text: t('ag.budget.overList', { list: overBudget.map((c) => categoryLabel(c.categoryName)).join(', ') }) });
    }

    const nearLimit = status.categories.filter((c) => !c.isOverBudget && c.percentUsed >= NEAR_LIMIT_THRESHOLD_PERCENT);
    if (nearLimit.length > 0) {
      claims.push({
        kind: 'fact',
        text: t('ag.budget.nearList', { list: nearLimit.map((c) => `${categoryLabel(c.categoryName)} (${c.percentUsed.toFixed(0)}%)`).join(', ') }),
      });
    }

    return buildAgentResponse({ claims, metadata: { month } });
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

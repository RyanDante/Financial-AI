import { formatMoney } from '@/utils/currency';
import { currentMonthKey, extractNamedMonthKey, mentionsComparison, previousMonthKey } from './dateEntities';
import { buildAgentResponse, type AgentClaim, type AgentDefinition } from './types';
import { categoryLabel, t } from '@/i18n';

export const SPENDING_AGENT_TOOLS = ['getSpending', 'getSpendingByCategory', 'getAccounts', 'calculateCashFlow'];

interface CategorySpendingShape {
  categoryId: string | null;
  categoryName: string;
  totalMinor: number;
  percentage: number;
  transactionCount: number;
}

interface SpendingByCategoryResult {
  month: string;
  categories: CategorySpendingShape[];
}

interface SpendingTotalResult {
  month: string;
  totalSpentMinor: number;
}

/**
 * Read-only. Answers "how much / where / what changed" spending
 * questions using getSpendingByCategory (and getSpending for a
 * month-over-month comparison) — see docs/AI_ARCHITECTURE.md's tool
 * contract table for the exact shapes consumed here. Never computes a
 * total or a percentage itself; both come straight from the tool's
 * output (calculateSpendingByCategory in the financial engine already did
 * that math).
 */
export const spendingAgent: AgentDefinition = {
  id: 'spending',
  name: 'Spending Agent',
  description: 'Analyzes spending totals, category breakdowns, and month-over-month changes.',
  supportedIntents: ['spending'],
  allowedTools: SPENDING_AGENT_TOOLS,

  async execute(request, context, tools) {
    const month = extractNamedMonthKey(request.text) ?? currentMonthKey();

    const breakdown = (await tools.execute('getSpendingByCategory', { month })) as SpendingByCategoryResult;

    if (breakdown.categories.length === 0) {
      return buildAgentResponse({
        claims: [{ kind: 'fact', text: t('ag.spending.none', { month }) }],
      });
    }

    const totalMinor = breakdown.categories.reduce((sum, c) => sum + c.totalMinor, 0);
    const top = breakdown.categories[0]; // calculateSpendingByCategory already sorts descending

    const claims: AgentClaim[] = [{ kind: 'fact', text: t('ag.spending.total', { amount: formatMoney(totalMinor, context.currency), month }) }];

    // If the user named one of the actual categories we got back, call it
    // out specifically rather than only giving the overall top category.
    const namedCategory = breakdown.categories.find((c) => new RegExp(`\\b${escapeRegExp(c.categoryName)}\\b`, 'i').test(request.text));
    if (namedCategory && namedCategory.categoryId !== top.categoryId) {
      claims.push({
        kind: 'fact',
        text: t('ag.spending.named', { amount: formatMoney(namedCategory.totalMinor, context.currency), percent: namedCategory.percentage.toFixed(0), category: categoryLabel(namedCategory.categoryName) }),
      });
    }

    claims.push({
      kind: 'fact',
      text: t('ag.spending.top', { category: categoryLabel(top.categoryName), amount: formatMoney(top.totalMinor, context.currency), percent: top.percentage.toFixed(0) }),
    });

    const secondAndThird = breakdown.categories.slice(1, 3);
    if (secondAndThird.length > 0) {
      const list = secondAndThird.map((c) => `${categoryLabel(c.categoryName)} (${formatMoney(c.totalMinor, context.currency)})`).join(t('ag.spending.then'));
      claims.push({ kind: 'fact', text: t('ag.spending.next', { list }) });
    }

    if (mentionsComparison(request.text)) {
      const prevMonth = previousMonthKey();
      const previous = (await tools.execute('getSpending', { month: prevMonth })) as SpendingTotalResult;
      if (previous.totalSpentMinor > 0) {
        const changePercent = ((totalMinor - previous.totalSpentMinor) / previous.totalSpentMinor) * 100;
        const direction = changePercent >= 0 ? t('ag.spending.up') : t('ag.spending.down');
        claims.push({
          kind: 'calculation',
          text: t('ag.spending.change', { direction, percent: Math.abs(changePercent).toFixed(0), month: prevMonth, amount: formatMoney(previous.totalSpentMinor, context.currency) }),
        });
      } else {
        claims.push({ kind: 'fact', text: t('ag.spending.noPrevious', { month: prevMonth }) });
      }
    }

    return buildAgentResponse({
      claims,
      followUpSuggestions: mentionsComparison(request.text) ? [] : [t('ag.spending.followUp')],
      metadata: { month, totalMinor },
    });
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

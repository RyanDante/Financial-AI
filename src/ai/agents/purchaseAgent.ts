import { formatMoney, majorToMinor } from '@/utils/currency';
import type { PurchaseImpactResult } from '@/finance/calculations';
import { currentMonthKey } from './dateEntities';
import { buildAgentResponse, type AgentClaim, type AgentDefinition } from './types';
import { t } from '@/i18n';

export const PURCHASE_AGENT_TOOLS = ['calculatePurchaseImpact', 'getBudgetStatus', 'calculateCashFlow'];

interface BudgetCategoryStatus {
  categoryId: string;
  categoryName: string;
  limitMinor: number;
  spentMinor: number;
}

interface BudgetStatusResult {
  month: string;
  budget: { id: string; name: string; currency: string } | null;
  categories: BudgetCategoryStatus[];
}

interface CashFlowResult {
  month: string;
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

/**
 * Read-only. Reports the structured facts of a prospective purchase —
 * balance, upcoming obligations, this month's budget, cash flow, and goal
 * impact — and never tells the user whether they "should" buy it
 * (calculatePurchaseImpact itself is deliberately verdict-free; see
 * docs/AI_ARCHITECTURE.md "AI safety / financial design principle"). Only
 * calculatePurchaseImpact's numbers are treated as authoritative for
 * balance/reserve/goal math; getBudgetStatus/calculateCashFlow add
 * context the purchase-impact calculation doesn't cover, combined here
 * with plain arithmetic (not new financial logic).
 */
export const purchaseAgent: AgentDefinition = {
  id: 'purchase',
  name: 'Purchase Agent',
  description: 'Reports the balance/budget/cash-flow/goal impact of a prospective purchase — facts only, never a recommendation.',
  supportedIntents: ['purchase'],
  allowedTools: PURCHASE_AGENT_TOOLS,

  async execute(request, context, tools) {
    const amountMajor = request.entities.amountMajor as number | undefined;
    if (amountMajor === undefined || Number.isNaN(amountMajor) || amountMajor <= 0) {
      return buildAgentResponse({
        claims: [{ kind: 'ai_interpretation', text: t('ag.purchase.noAmount') }],
      });
    }

    const purchaseAmountMinor = majorToMinor(amountMajor, context.currency);
    const [result, budgetStatus, cashFlow] = await Promise.all([
      tools.execute('calculatePurchaseImpact', { purchaseAmountMinor, currency: context.currency }) as Promise<PurchaseImpactResult | null | undefined>,
      tools.execute('getBudgetStatus', { month: currentMonthKey() }) as Promise<BudgetStatusResult | null | undefined>,
      tools.execute('calculateCashFlow', { currency: context.currency }) as Promise<CashFlowResult | null | undefined>,
    ]);

    if (!result) {
      return buildAgentResponse({
        claims: [{ kind: 'ai_interpretation', text: t('ag.purchase.noData') }],
      });
    }

    const claims: AgentClaim[] = [
      { kind: 'fact', text: t('ag.purchase.balance', { amount: formatMoney(result.currentBalanceMinor, context.currency) }) },
      {
        kind: 'calculation',
        text: t('ag.purchase.after', { amount: formatMoney(result.purchaseAmountMinor, context.currency), balance: formatMoney(result.projectedBalanceMinor, context.currency) }),
      },
      { kind: 'fact', text: t('ag.purchase.obligations', { amount: formatMoney(result.upcomingObligationsMinor, context.currency) }) },
    ];

    if (!result.canCoverObligationsAfterPurchase) {
      claims.push({ kind: 'projection', text: t('ag.purchase.cantCover') });
    }

    if (result.isReserveIntactAfterPurchase) {
      claims.push({
        kind: 'fact',
        text: t('ag.purchase.reserveIntact', { amount: formatMoney(result.reserveTargetMinor, context.currency) }),
      });
    } else {
      claims.push({
        kind: 'projection',
        text: t('ag.purchase.short', { amount: formatMoney(result.shortfallMinor, context.currency) }),
      });
    }

    if (cashFlow) {
      claims.push({
        kind: 'fact',
        text: t('ag.purchase.cashFlow', { income: formatMoney(cashFlow.incomeMinor, context.currency), spent: formatMoney(cashFlow.expenseMinor, context.currency), net: formatMoney(cashFlow.netMinor, context.currency) }),
      });
    }

    const budgetCategories = budgetStatus?.categories ?? [];
    if (budgetStatus?.budget && budgetCategories.length > 0) {
      const totalLimitMinor = budgetCategories.reduce((sum, c) => sum + c.limitMinor, 0);
      const totalSpentMinor = budgetCategories.reduce((sum, c) => sum + c.spentMinor, 0);
      const remainingAfterPurchaseMinor = totalLimitMinor - totalSpentMinor - purchaseAmountMinor;
      claims.push({
        kind: 'calculation',
        text:
          remainingAfterPurchaseMinor >= 0
            ? t('ag.purchase.budgetLeft', { amount: formatMoney(remainingAfterPurchaseMinor, context.currency) })
            : t('ag.purchase.budgetOver', { amount: formatMoney(Math.abs(remainingAfterPurchaseMinor), context.currency) }),
      });
    }

    const goalImpacts = result.goalImpacts ?? [];
    const maxDelay = goalImpacts.length > 0 ? Math.max(...goalImpacts.map((g) => g.delayMonths ?? 0)) : 0;
    if (maxDelay > 0) {
      claims.push({
        kind: 'assumption',
        text: t('ag.purchase.goalDelay', { months: maxDelay.toFixed(1) }),
      });
    }

    return buildAgentResponse({ claims, metadata: { purchaseAmountMinor } });
  },
};

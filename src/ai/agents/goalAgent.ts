import { formatMoney, majorToMinor } from '@/utils/currency';
import { buildAgentResponse, type AgentClaim, type AgentDefinition } from './types';
import { getLanguage, getLocale, t } from '@/i18n';

export const GOAL_AGENT_TOOLS = ['getGoals', 'getGoalProgress', 'calculateGoalProjection', 'calculateCashFlow'];

interface GoalShape {
  id: string;
  name: string;
  targetAmountMinor: number;
  currentAmountMinor: number;
  currency: string;
  deadline: string | null;
}

interface GoalProgressShape {
  percent: number;
  remainingMinor: number;
  daysRemaining: number | null;
  isOverdue: boolean;
  isComplete: boolean;
}

interface GoalsListItem {
  goal: GoalShape;
  progress: GoalProgressShape;
  requiredMonthlySavingsMinor: number | null;
}

interface GoalProjectionResult {
  goal: GoalShape;
  monthlyContributionMinor: number;
  projectedCompletionDate: Date | string | null;
}

/**
 * Read-only. Answers "how close / how much / will I reach it" questions
 * using getGoals (which already carries progress and the required
 * monthly pace from the financial engine's calculateGoalProgress /
 * calculateRequiredMonthlySavings) and, for an explicit "what if I saved
 * X/month" hypothetical, calculateGoalProjection. Never recomputes a
 * percentage, a remaining amount, or a projected date itself.
 */
export const goalAgent: AgentDefinition = {
  id: 'goal',
  name: 'Goal Agent',
  description: 'Reports progress toward savings goals and projects hypothetical contribution scenarios.',
  supportedIntents: ['goal'],
  allowedTools: GOAL_AGENT_TOOLS,

  async execute(request, context, tools) {
    const goals = (await tools.execute('getGoals', {})) as GoalsListItem[];

    if (goals.length === 0) {
      return buildAgentResponse({
        claims: [{ kind: 'fact', text: t('ag.goal.none') }],
        followUpSuggestions: [t('ag.goal.create')],
      });
    }

    const named = goals.find((g) => new RegExp(`\\b${escapeRegExp(g.goal.name)}\\b`, 'i').test(request.text));
    const target = named ?? (goals.length === 1 ? goals[0] : null);

    if (!target) {
      // Multiple goals and none named — summarize all of them, same as the pre-agent behavior.
      const lines = goals.map((g) => t('ag.goal.line', { goal: g.goal.name, percent: g.progress.percent.toFixed(0) }));
      return buildAgentResponse({
        claims: [{ kind: 'fact', text: t('ag.goal.progress', { lines: lines.map((l) => `  - ${l}`).join('\n') }) }],
        followUpSuggestions: [t('ag.goal.askSpecific')],
      });
    }

    const claims: AgentClaim[] = [
      {
        kind: 'fact',
        text: t('ag.goal.status', { goal: target.goal.name, current: formatMoney(target.goal.currentAmountMinor, context.currency), target: formatMoney(target.goal.targetAmountMinor, context.currency), percent: target.progress.percent.toFixed(0) }),
      },
    ];

    if (target.progress.isComplete) {
      claims.push({ kind: 'fact', text: t('ag.goal.complete') });
    } else if (target.progress.isOverdue) {
      claims.push({ kind: 'fact', text: t('ag.goal.overdue') });
    } else if (target.requiredMonthlySavingsMinor !== null) {
      claims.push({ kind: 'calculation', text: t('ag.goal.needed', { amount: formatMoney(target.requiredMonthlySavingsMinor, context.currency) }) });
      claims.push({ kind: 'assumption', text: t('ag.goal.neededAssumption') });
    } else {
      claims.push({ kind: 'fact', text: t('ag.goal.noDeadline', { amount: formatMoney(target.progress.remainingMinor, context.currency) }) });
    }

    const hypotheticalAmount = request.entities.amountMajor as number | undefined;
    if (hypotheticalAmount !== undefined && !target.progress.isComplete) {
      const monthlyContributionMinor = majorToMinor(hypotheticalAmount, context.currency);
      const projection = (await tools.execute('calculateGoalProjection', {
        goalId: target.goal.id,
        monthlyContributionMinor,
      })) as GoalProjectionResult;

      if (projection.projectedCompletionDate) {
        const date = new Date(projection.projectedCompletionDate);
        claims.push({
          kind: 'projection',
          text: t('ag.goal.projection', { amount: formatMoney(monthlyContributionMinor, context.currency), date: date.toLocaleDateString(getLanguage() === 'fr' ? getLocale() : undefined) }),
        });
        claims.push({ kind: 'assumption', text: t('ag.goal.projectionAssumption') });
      } else {
        claims.push({ kind: 'fact', text: t('ag.goal.never', { amount: formatMoney(monthlyContributionMinor, context.currency) }) });
      }
    }

    return buildAgentResponse({ claims, metadata: { goalId: target.goal.id } });
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

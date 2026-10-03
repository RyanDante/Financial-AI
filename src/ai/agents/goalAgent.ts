import { formatMoney, majorToMinor } from '@/utils/currency';
import { buildAgentResponse, type AgentClaim, type AgentDefinition } from './types';

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
        claims: [{ kind: 'fact', text: 'You have no goals set up yet.' }],
        followUpSuggestions: ['Want to create one?'],
      });
    }

    const named = goals.find((g) => new RegExp(`\\b${escapeRegExp(g.goal.name)}\\b`, 'i').test(request.text));
    const target = named ?? (goals.length === 1 ? goals[0] : null);

    if (!target) {
      // Multiple goals and none named — summarize all of them, same as the pre-agent behavior.
      const lines = goals.map((g) => `${g.goal.name}: ${g.progress.percent.toFixed(0)}% complete`);
      return buildAgentResponse({
        claims: [{ kind: 'fact', text: `Your goal progress:\n${lines.map((l) => `  - ${l}`).join('\n')}` }],
        followUpSuggestions: ['Ask about a specific goal by name for more detail.'],
      });
    }

    const claims: AgentClaim[] = [
      {
        kind: 'fact',
        text: `${target.goal.name}: ${formatMoney(target.goal.currentAmountMinor, context.currency)} of ${formatMoney(target.goal.targetAmountMinor, context.currency)} (${target.progress.percent.toFixed(0)}%).`,
      },
    ];

    if (target.progress.isComplete) {
      claims.push({ kind: 'fact', text: 'This goal is already complete.' });
    } else if (target.progress.isOverdue) {
      claims.push({ kind: 'fact', text: "This goal's deadline has already passed without being reached." });
    } else if (target.requiredMonthlySavingsMinor !== null) {
      claims.push({ kind: 'calculation', text: `Reaching it by the deadline needs about ${formatMoney(target.requiredMonthlySavingsMinor, context.currency)}/month.` });
      claims.push({ kind: 'assumption', text: `This assumes no further withdrawals and steady monthly contributions from now on.` });
    } else {
      claims.push({ kind: 'fact', text: `${formatMoney(target.progress.remainingMinor, context.currency)} left, with no deadline set.` });
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
          text: `At ${formatMoney(monthlyContributionMinor, context.currency)}/month, you'd reach this goal around ${date.toLocaleDateString()}.`,
        });
        claims.push({ kind: 'assumption', text: 'This assumes that exact contribution every month with no interruptions.' });
      } else {
        claims.push({ kind: 'fact', text: `${formatMoney(monthlyContributionMinor, context.currency)}/month would never reach this goal on its own.` });
      }
    }

    return buildAgentResponse({ claims, metadata: { goalId: target.goal.id } });
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

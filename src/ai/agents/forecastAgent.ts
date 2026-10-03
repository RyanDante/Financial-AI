import { formatMoney } from '@/utils/currency';
import { buildAgentResponse, type AgentDefinition } from './types';

export const FORECAST_AGENT_TOOLS = ['forecastBalance'];

interface ForecastResult {
  points: { month: string; projectedBalanceMinor: number }[];
  basis: string;
}

/**
 * Read-only. Projects balance N months out via forecastBalance (which
 * itself assumes last month's net cash flow continues — an
 * ASSUMPTION-tier figure, never stated as fact). Defaults to 6 months
 * when no explicit count was extracted. Ported from the pre-agent
 * MockAIProvider forecast branch.
 */
export const forecastAgent: AgentDefinition = {
  id: 'forecast',
  name: 'Forecast Agent',
  description: "Projects the user's balance forward N months, labeled as a projection, not a fact.",
  supportedIntents: ['forecast'],
  allowedTools: FORECAST_AGENT_TOOLS,

  async execute(request, context, tools) {
    const months = (request.entities.monthsCount as number | undefined) ?? 6;

    const result = (await tools.execute('forecastBalance', { months, currency: context.currency })) as ForecastResult;
    const last = result.points[result.points.length - 1];

    return buildAgentResponse({
      claims: [
        {
          kind: 'projection',
          text: `If your recent cash flow continues, your balance in ${months} month(s) (${last.month}) would be approximately ${formatMoney(last.projectedBalanceMinor, context.currency)}.`,
        },
        { kind: 'assumption', text: result.basis },
      ],
      metadata: { months },
    });
  },
};

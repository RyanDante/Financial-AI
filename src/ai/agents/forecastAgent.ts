import { formatMoney, majorToMinor } from '@/utils/currency';
import type { CurrencyCode } from '@/constants/currencies';
import { monthsUntilNamedMonth } from './dateEntities';
import { buildAgentResponse, type AgentClaim, type AgentDefinition } from './types';
import { getLanguage, t } from '@/i18n';

export const FORECAST_AGENT_TOOLS = ['forecastBalance', 'calculateCashFlow'];

interface ForecastResult {
  points: { month: string; projectedBalanceMinor: number }[];
  basis: string;
}

interface CashFlowResult {
  month: string;
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

type ForecastScenario = 'BASELINE' | 'INCREASED_SAVING' | 'INCREASED_SPENDING';

/**
 * Detects a hypothetical "what if I saved/spent X more a month" scenario
 * from the text. This never duplicates forecast math itself — it only
 * decides the sign and size of a monthly adjustment, which the
 * forecastBalance tool (see src/ai/tools/financialTools.ts) adds to the
 * observed net cash flow before calling the financial engine's
 * calculateForecast. "Baseline" (e.g. "what happens if my spending stays
 * the same?") is the existing no-adjustment projection.
 */
function detectScenario(text: string, amountMajor: number | undefined, currency: CurrencyCode): { scenario: ForecastScenario; monthlyAdjustmentMinor: number } {
  const lower = text.toLowerCase();
  if (amountMajor !== undefined && /\bsave\b.*\bmore\b/.test(lower)) {
    return { scenario: 'INCREASED_SAVING', monthlyAdjustmentMinor: majorToMinor(amountMajor, currency) };
  }
  if (amountMajor !== undefined && /\bspend\b.*\bmore\b/.test(lower)) {
    return { scenario: 'INCREASED_SPENDING', monthlyAdjustmentMinor: -majorToMinor(amountMajor, currency) };
  }
  return { scenario: 'BASELINE', monthlyAdjustmentMinor: 0 };
}

function scenarioPhrase(scenario: ForecastScenario, monthlyAdjustmentMinor: number, currency: CurrencyCode): string {
  if (scenario === 'INCREASED_SAVING') return t('ag.forecast.saved', { amount: formatMoney(monthlyAdjustmentMinor, currency) });
  if (scenario === 'INCREASED_SPENDING') return t('ag.forecast.spent', { amount: formatMoney(-monthlyAdjustmentMinor, currency) });
  return t('ag.forecast.unchanged');
}

/**
 * Read-only. Projects balance forward via forecastBalance — an
 * ASSUMPTION-tier figure, never stated as fact — or, for "project my
 * current cash flow", reports this month's actual income/expense/net via
 * calculateCashFlow instead (a FACT, not a projection; see CURRENT FACTS
 * vs PROJECTED OUTCOMES in docs/AI_ARCHITECTURE.md). Defaults to a
 * 6-month horizon when neither an explicit month count nor a named month
 * ("by March") was found in the text.
 */
export const forecastAgent: AgentDefinition = {
  id: 'forecast',
  name: 'Forecast Agent',
  description: "Projects the user's balance or cash flow forward, clearly labeled as a projection/assumption, never a guarantee.",
  supportedIntents: ['forecast'],
  allowedTools: FORECAST_AGENT_TOOLS,

  async execute(request, context, tools) {
    if (/cash\s*flow/i.test(request.text)) {
      const cashFlow = (await tools.execute('calculateCashFlow', { currency: context.currency })) as CashFlowResult;
      return buildAgentResponse({
        claims: [
          {
            kind: 'fact',
            text: t('ag.forecast.cashFlow', { month: cashFlow.month, income: formatMoney(cashFlow.incomeMinor, context.currency), spent: formatMoney(cashFlow.expenseMinor, context.currency) }),
          },
          { kind: 'calculation', text: t('ag.forecast.net', { net: formatMoney(cashFlow.netMinor, context.currency), month: cashFlow.month }) },
        ],
        metadata: { month: cashFlow.month, netMinor: cashFlow.netMinor },
      });
    }

    const months = Math.max(1, (request.entities.monthsCount as number | undefined) ?? monthsUntilNamedMonth(request.text) ?? 6);
    const amountMajor = request.entities.amountMajor as number | undefined;
    const { scenario, monthlyAdjustmentMinor } = detectScenario(request.text, amountMajor, context.currency);

    const result = (await tools.execute('forecastBalance', {
      months,
      currency: context.currency,
      ...(monthlyAdjustmentMinor !== 0 ? { monthlyAdjustmentMinor } : {}),
    })) as ForecastResult;
    const last = result.points[result.points.length - 1];

    const claims: AgentClaim[] = [
      {
        kind: 'projection',
        text: t('ag.forecast.projection', { scenario: scenarioPhrase(scenario, monthlyAdjustmentMinor, context.currency), months, month: last.month, amount: formatMoney(last.projectedBalanceMinor, context.currency) }),
      },
      { kind: 'assumption', text: getLanguage() === 'en' ? result.basis : t('ag.forecast.basis') },
    ];

    return buildAgentResponse({ claims, metadata: { months, scenario } });
  },
};

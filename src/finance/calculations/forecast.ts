import type { MinorUnits } from '@/utils/currency';

export interface ForecastPoint {
  /** "YYYY-MM" */
  month: string;
  projectedBalanceMinor: MinorUnits;
}

export interface ForecastParams {
  currentBalanceMinor: MinorUnits;
  /** Constant net cash flow (income minus expenses) assumed for every future month. */
  netMonthlyCashflowMinor: MinorUnits;
  months: number;
  startDate?: Date;
}

export interface ForecastResult {
  points: ForecastPoint[];
  /** Explicit statement of the assumption this forecast rests on, for surfacing to the user as an ASSUMPTION rather than a FACT. */
  basis: string;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Projects balance forward month-by-month assuming the given constant net
 * cash flow repeats every month. This is a scenario/forecast, not a fact —
 * callers should present it with the assumption attached (see `basis`).
 */
export function calculateForecast(params: ForecastParams): ForecastResult {
  const startDate = params.startDate ?? new Date();
  const points: ForecastPoint[] = [];

  for (let i = 1; i <= params.months; i += 1) {
    const monthDate = addMonths(startDate, i);
    points.push({
      month: toMonthKey(monthDate),
      projectedBalanceMinor: params.currentBalanceMinor + params.netMonthlyCashflowMinor * i,
    });
  }

  return {
    points,
    basis: `Assumes a constant net cash flow of ${params.netMonthlyCashflowMinor} minor units per month continues unchanged.`,
  };
}

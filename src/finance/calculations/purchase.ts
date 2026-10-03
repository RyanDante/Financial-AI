import type { MinorUnits } from '@/utils/currency';
import { calculateAvailableMoney } from './balance';

export interface PurchaseImpactGoalInput {
  goalId: string;
  goalName: string;
  /** How much the user currently puts toward this goal per month, in minor units. */
  monthlyContributionMinor: MinorUnits;
}

export interface PurchaseImpactGoalResult extends PurchaseImpactGoalInput {
  /** Extra months this purchase would add to the goal's timeline, if it came out of that goal's monthly contribution. Null if the goal has no active monthly contribution to measure against. */
  delayMonths: number | null;
}

export interface PurchaseImpactParams {
  currentBalanceMinor: MinorUnits;
  purchaseAmountMinor: MinorUnits;
  upcomingObligationsMinor: MinorUnits;
  reserveTargetMinor: MinorUnits;
  goals?: PurchaseImpactGoalInput[];
}

export interface PurchaseImpactResult {
  currentBalanceMinor: MinorUnits;
  purchaseAmountMinor: MinorUnits;
  projectedBalanceMinor: MinorUnits;
  upcomingObligationsMinor: MinorUnits;
  reserveTargetMinor: MinorUnits;
  availableBeforePurchaseMinor: MinorUnits;
  availableAfterPurchaseMinor: MinorUnits;
  canCoverObligationsAfterPurchase: boolean;
  isReserveIntactAfterPurchase: boolean;
  shortfallMinor: MinorUnits;
  goalImpacts: PurchaseImpactGoalResult[];
}

/**
 * Returns the structured FACTS and CALCULATIONS of making a purchase —
 * never a recommendation. The caller (AI explanation layer or UI) decides
 * how to phrase this for the user; this function only computes numbers.
 */
export function calculatePurchaseImpact(params: PurchaseImpactParams): PurchaseImpactResult {
  const projectedBalanceMinor = params.currentBalanceMinor - params.purchaseAmountMinor;

  const availableBeforePurchaseMinor = calculateAvailableMoney({
    totalBalanceMinor: params.currentBalanceMinor,
    upcomingObligationsMinor: params.upcomingObligationsMinor,
    reserveTargetMinor: params.reserveTargetMinor,
  });

  const availableAfterPurchaseMinor = calculateAvailableMoney({
    totalBalanceMinor: projectedBalanceMinor,
    upcomingObligationsMinor: params.upcomingObligationsMinor,
    reserveTargetMinor: params.reserveTargetMinor,
  });

  const goalImpacts: PurchaseImpactGoalResult[] = (params.goals ?? []).map((goal) => ({
    ...goal,
    delayMonths: goal.monthlyContributionMinor > 0 ? params.purchaseAmountMinor / goal.monthlyContributionMinor : null,
  }));

  return {
    currentBalanceMinor: params.currentBalanceMinor,
    purchaseAmountMinor: params.purchaseAmountMinor,
    projectedBalanceMinor,
    upcomingObligationsMinor: params.upcomingObligationsMinor,
    reserveTargetMinor: params.reserveTargetMinor,
    availableBeforePurchaseMinor,
    availableAfterPurchaseMinor,
    canCoverObligationsAfterPurchase: projectedBalanceMinor >= params.upcomingObligationsMinor,
    isReserveIntactAfterPurchase: availableAfterPurchaseMinor >= 0,
    shortfallMinor: Math.max(0, -availableAfterPurchaseMinor),
    goalImpacts,
  };
}

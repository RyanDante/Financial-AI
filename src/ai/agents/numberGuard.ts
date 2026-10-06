import type { ClaimKind, ToolCallRecord } from '@/types/ai';
import type { AgentClaim } from './types';

/**
 * The number guard: a model may explain figures but never invent them.
 *
 * Every amount in a FACT or PROJECTION claim must equal a number that a
 * tool returned this turn; a CALCULATION may also be the sum or difference
 * of two such numbers. A claim that fails is downgraded to INTERPRETATION
 * (the label for "the model's own framing") and a warning is added, so the
 * UI never presents an unverified figure as data.
 *
 * Tool outputs are in minor units (XAF has none; USD/EUR/GBP have cents),
 * so each tool number is also accepted divided by 100. Percentages and
 * small counts (days, months, "3 categories") are not checked: they're
 * below the threshold and rarely the risky part.
 */
const CHECKED_KINDS: ClaimKind[] = ['fact', 'calculation', 'projection'];
const MIN_CHECKED_VALUE = 100;
const MAX_PAIR_CHECK = 150;

export interface GuardResult {
  claims: AgentClaim[];
  downgraded: number;
}

export function guardClaims(claims: AgentClaim[], toolResults: ToolCallRecord[]): GuardResult {
  const known = collectNumbers(toolResults.map((r) => r.output));
  const knownList = [...known].slice(0, MAX_PAIR_CHECK);
  let downgraded = 0;

  const guarded = claims.map((claim) => {
    if (!CHECKED_KINDS.includes(claim.kind)) return claim;
    const amounts = extractAmounts(claim.text);
    const ok = amounts.every((amount) => known.has(amount) || (claim.kind === 'calculation' && isPairResult(amount, knownList)));
    if (ok) return claim;
    downgraded += 1;
    return { kind: 'ai_interpretation' as const, text: claim.text };
  });

  return { claims: guarded, downgraded };
}

/** Amounts written in a sentence: "94,500", "1 200 000", "1,500.50", "-12,500". Percent values are skipped. */
export function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  // Digits with optional thousands separators (comma, space, NBSP) and an optional decimal part.
  const pattern = /-?\d{1,3}(?:[,\u00a0\u202f ]\d{3})+(?:\.\d{1,2})?|-?\d+(?:\.\d{1,2})?/g;
  for (const match of text.matchAll(pattern)) {
    const end = (match.index ?? 0) + match[0].length;
    if (text.slice(end).trimStart().startsWith('%')) continue;
    // Skip parts of dates and month keys like 2026-09 or 12/09/2026.
    const before = text[(match.index ?? 0) - 1];
    const after = text[end];
    if (before === '-' || after === '-' || before === '/' || after === '/') continue;
    const value = Math.abs(Number(match[0].replace(/[,\u00a0\u202f ]/g, '')));
    // A bare 4-digit year ("in 2026") is a date, not an amount.
    if (/^\d{4}$/.test(match[0]) && value >= 1990 && value <= 2100) continue;
    if (Number.isFinite(value) && value >= MIN_CHECKED_VALUE) amounts.push(round2(value));
  }
  return amounts;
}

/** Every number anywhere in the tool outputs, plus its /100 (minor→major) form. */
export function collectNumbers(values: unknown[]): Set<number> {
  const found = new Set<number>();
  const visit = (value: unknown, depth: number) => {
    if (depth > 8 || value === null || value === undefined) return;
    if (typeof value === 'number' && Number.isFinite(value)) {
      found.add(round2(Math.abs(value)));
      found.add(round2(Math.abs(value) / 100));
      found.add(Math.round(Math.abs(value)));
    } else if (Array.isArray(value)) {
      value.forEach((v) => visit(v, depth + 1));
    } else if (typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach((v) => visit(v, depth + 1));
    }
  };
  values.forEach((v) => visit(v, 0));
  return found;
}

function isPairResult(amount: number, known: number[]): boolean {
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      if (round2(known[i] + known[j]) === amount || round2(Math.abs(known[i] - known[j])) === amount) return true;
    }
  }
  return false;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

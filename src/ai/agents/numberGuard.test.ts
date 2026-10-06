import { extractAmounts, guardClaims } from './numberGuard';
import type { ToolCallRecord } from '@/types/ai';

const results: ToolCallRecord[] = [
  { toolName: 'getSpending', input: {}, output: { totalSpentMinor: 94_500 } },
  { toolName: 'getBudgetStatus', input: {}, output: { categories: [{ limitMinor: 120_000, spentMinor: 94_500, remainingMinor: 25_500 }] } },
  { toolName: 'getBalance', input: { currency: 'USD' }, output: { totalBalanceMinor: 150_050 } },
];

describe('extractAmounts', () => {
  it('reads formatted amounts and ignores percentages, small counts, years and dates', () => {
    expect(extractAmounts('You spent 94,500 FCFA (78% of 120 000 FCFA) in 3 categories during September 2026, see 2026-09.')).toEqual([94_500, 120_000]);
    expect(extractAmounts('Balance: $1,500.50')).toEqual([1500.5]);
  });
});

describe('guardClaims', () => {
  it('keeps facts whose amounts a tool returned, including minor-to-major conversion', () => {
    const { claims, downgraded } = guardClaims(
      [
        { kind: 'fact', text: 'You spent 94,500 FCFA of your 120,000 FCFA food limit.' },
        { kind: 'fact', text: 'Your USD balance is $1,500.50.' },
      ],
      results,
    );
    expect(downgraded).toBe(0);
    expect(claims.every((c) => c.kind === 'fact')).toBe(true);
  });

  it('accepts a calculation that is a sum or difference of tool numbers', () => {
    const { downgraded } = guardClaims([{ kind: 'calculation', text: 'That leaves 25,500 FCFA, and together that is 214,500 FCFA.' }], results);
    expect(downgraded).toBe(0);
  });

  it('downgrades invented amounts but leaves interpretation and assumptions alone', () => {
    const { claims, downgraded } = guardClaims(
      [
        { kind: 'fact', text: 'You spent 99,000 FCFA.' },
        { kind: 'projection', text: 'You will have 2,000,000 FCFA by June.' },
        { kind: 'ai_interpretation', text: 'Try to keep food under 80,000 FCFA.' },
        { kind: 'assumption', text: 'Assuming income stays at 425,000 FCFA.' },
      ],
      results,
    );
    expect(downgraded).toBe(2);
    expect(claims.map((c) => c.kind)).toEqual(['ai_interpretation', 'ai_interpretation', 'ai_interpretation', 'assumption']);
  });
});

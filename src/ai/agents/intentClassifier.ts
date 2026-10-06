import type { AgentIntent } from './types';

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/** Picks the largest amount-looking number in the text (handles "100k", "100,000", plain digits). Returns null if nothing looks like a real amount. */
export function extractAmountMajor(text: string): number | null {
  // The (?![a-z]) rejects a k/m suffix that's immediately followed by more
  // letters — without it, "6 months" parses the leading "m" of "months" as
  // a million suffix, turning "in 6 months" into 6,000,000 (a real bug in
  // the original MockAIProvider version of this function, caught by this
  // module's tests). "100k"/"1.5m" still match: nothing follows the suffix
  // there, so the lookahead passes. A \b alone can't do this — digits and
  // letters are both "word characters", so there's no boundary between the
  // "0" and "k" in "100k" either.
  const matches = Array.from(text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(?:(k|m)(?![a-z]))?/gi));
  let best: number | null = null;
  for (const match of matches) {
    const raw = Number(match[1].replace(/,/g, ''));
    if (Number.isNaN(raw)) continue;
    const suffix = match[2]?.toLowerCase();
    const value = suffix === 'k' ? raw * 1_000 : suffix === 'm' ? raw * 1_000_000 : raw;
    if (value >= 100 && (best === null || value > best)) {
      best = value;
    }
  }
  return best;
}

/** Handles both "6 months" and "six months". Returns null if no month count is mentioned. */
export function extractMonthsCount(text: string): number | null {
  const digitMatch = text.match(/(\d+)\s*months?\b/i);
  if (digitMatch) return Number(digitMatch[1]);

  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*months?\b/i);
  if (wordMatch) return WORD_NUMBERS[wordMatch[1].toLowerCase()];

  return null;
}

/**
 * Deterministic, regex-based intent classification. This is intentionally
 * simple and a little brittle at the edges — a genuinely ambiguous phrase
 * (e.g. "How much have I used?" with no other context) classifies as
 * 'unknown' rather than being force-fit into a guess, per the "do not
 * invent intent" rule. A real LLM provider can do better here using actual
 * language understanding and conversation context; this classifier is
 * what MockAIProvider (and therefore every test) uses, and it only needs
 * to be good enough to prove the routing architecture, not to understand
 * natural language.
 */
export function classifyIntent(text: string): AgentIntent {
  const t = text.toLowerCase();
  const hasAmount = extractAmountMajor(t) !== null;

  // "buy"/"afford"/"purchase" are purchase intent regardless of whether an
  // amount was found (e.g. "What happens to my finances if I buy this?" has
  // no number at all) — only "spend"/"costs" need an amount alongside them,
  // since those words alone are too generic (see the spending branch below).
  // "affect ... goal" is a one-off pattern for "Would this affect my laptop
  // goal?" — a purchase-impact-on-goal question, which is exactly what the
  // Purchase Agent (not the Goal Agent) answers.
  if (
    /\b(afford|purchase|buy)\b/.test(t) ||
    /\baffect\b.*\bgoal\b/.test(t) ||
    (/\b(spend|costs?)\b/.test(t) && hasAmount)
  ) {
    return 'purchase';
  }
  if (
    /\bforecast\b/.test(t) ||
    /(balance|finances?).*look like/.test(t) ||
    /\d+\s*months?\s*from now/.test(t) ||
    /what happens if .*\bmonth/.test(t) ||
    /spending stays the same/.test(t) ||
    /how much will i have/.test(t) ||
    /project.*cash\s*flow/.test(t)
  ) {
    return 'forecast';
  }
  if (/\bbudget\b|overspend|over\s*budget|\blimits?\b/.test(t)) {
    return 'budget';
  }
  if (/\bgoal\b|saving for|save for|reach my goal|when will i reach|need to save|save more/.test(t)) {
    return 'goal';
  }
  if (/\bsubscription|recurring expense/.test(t)) {
    return 'subscriptions';
  }
  // Checked before the generic spending branch so "What did I spend this
  // money on?" (asking to see the transactions themselves) doesn't get
  // swallowed by the bare \bspend\b match below.
  if (/\btransactions?\b|analyze this|what did i spend.*\bon\b/.test(t)) {
    return 'transactions';
  }
  if (/\bspend\b|\bspending\b|\bspent\b|where.*money/.test(t)) {
    return 'spending';
  }
  if (/\boverview\b|how am i doing financially|financial (summary|health|snapshot)/.test(t)) {
    return 'general_finance';
  }
  return 'unknown';
}

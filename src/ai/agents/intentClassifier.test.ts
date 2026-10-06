import { classifyIntent, extractAmountMajor, extractMonthsCount } from './intentClassifier';

describe('classifyIntent', () => {
  it.each([
    ['How much did I spend this month?', 'spending'],
    ['How much did I spend on food?', 'spending'],
    ['What category did I spend the most on?', 'spending'],
    ['Where is most of my money going?', 'spending'],
    ['How has my spending changed?', 'spending'],
    ['Show me my spending breakdown.', 'spending'],
    ['How much of my food budget is left?', 'budget'],
    ['Am I overspending?', 'budget'],
    ['Which categories are close to their limits?', 'budget'],
    ['How much do I need to save for my laptop?', 'goal'],
    ['Will I reach my goal by March?', 'goal'],
    ['What happens if I save more?', 'goal'],
    ['What will my balance look like in six months?', 'forecast'],
    ['Can I spend 100,000 XAF on this?', 'purchase'],
    ['Can I afford this?', 'purchase'],
    ['How much am I paying for subscriptions?', 'subscriptions'],
    ['Analyze this transaction.', 'transactions'],
    ['How am I doing financially?', 'general_finance'],
    ['asdkjasjkdasd', 'unknown'],
    // Purchase Agent phrasings (Intelligence Expansion phase)
    ['Can I afford this phone?', 'purchase'],
    ['I want to buy something for 250k.', 'purchase'],
    ['What happens if I spend 50,000?', 'purchase'],
    ['Would this affect my laptop goal?', 'purchase'],
    ['What happens to my finances if I buy this?', 'purchase'],
    ['The PS5 costs 400k. Analyze it.', 'purchase'],
    // Forecast Agent phrasings
    ['What will my finances look like in 6 months?', 'forecast'],
    ['What happens if I save 50,000 more each month?', 'forecast'],
    ['What happens if my spending stays the same?', 'forecast'],
    ['How much will I have by March?', 'forecast'],
    ['Project my current cash flow.', 'forecast'],
    // Subscription Agent phrasings
    ['What subscriptions am I paying for?', 'subscriptions'],
    ['How much do subscriptions cost me?', 'subscriptions'],
    ['What recurring expenses do I have?', 'subscriptions'],
    ['How much am I spending every month on subscriptions?', 'subscriptions'],
    ['Which subscriptions cost the most?', 'subscriptions'],
    // Transaction Agent phrasings
    ['Explain this transaction.', 'transactions'],
    ['What did I spend this money on?', 'transactions'],
    ['Show me transactions from last week.', 'transactions'],
    ['Find my largest transactions.', 'transactions'],
  ] as const)('classifies "%s" as %s', (text, expected) => {
    expect(classifyIntent(text)).toBe(expected);
  });

  it('treats a fully ambiguous phrase as unknown rather than guessing', () => {
    expect(classifyIntent('How much have I used?')).toBe('unknown');
  });

  it('prioritizes purchase intent over spending when an amount is present', () => {
    expect(classifyIntent('Can I spend 50000 on a new phone?')).toBe('purchase');
  });

  it('does not misclassify "overspending" as the generic spending intent', () => {
    // Budget check must win because it runs first in the chain, not because
    // "spending" fails to match "overspending" (it wouldn't, as a bare substring).
    expect(classifyIntent('I think I am overspending this month')).toBe('budget');
  });

  it('still prioritizes the recurring "save more" goal phrasing over forecast when no amount is present', () => {
    expect(classifyIntent('What happens if I save more?')).toBe('goal');
  });

  it('does not let a generic spending question get pulled into transactions', () => {
    expect(classifyIntent('How much did I spend on food?')).toBe('spending');
  });
});

describe('extractAmountMajor', () => {
  it('parses plain digits, comma-grouped numbers, and k/m suffixes', () => {
    expect(extractAmountMajor('100000')).toBe(100000);
    expect(extractAmountMajor('100,000')).toBe(100000);
    expect(extractAmountMajor('100k')).toBe(100000);
    expect(extractAmountMajor('1.5m')).toBe(1_500_000);
  });

  it('ignores small numbers that are not plausible amounts', () => {
    expect(extractAmountMajor('in 6 months')).toBeNull();
  });

  it('returns null when there is no number at all', () => {
    expect(extractAmountMajor('how much did I spend')).toBeNull();
  });

  it('picks the largest plausible amount when several numbers are present', () => {
    expect(extractAmountMajor('I have 500 but want to spend 100000')).toBe(100000);
  });
});

describe('extractMonthsCount', () => {
  it('parses a digit month count', () => {
    expect(extractMonthsCount('in 6 months')).toBe(6);
  });

  it('parses a word month count', () => {
    expect(extractMonthsCount('what will my balance look like in six months?')).toBe(6);
  });

  it('returns null when no month count is mentioned', () => {
    expect(extractMonthsCount('will I reach my goal by March?')).toBeNull();
  });
});

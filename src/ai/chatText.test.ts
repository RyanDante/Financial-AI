import { conversationTitle, describeToolStep } from './chatText';

describe('conversationTitle', () => {
  it('keeps a short question as is', () => {
    expect(conversationTitle("  What's my   balance? ")).toBe("What's my balance?");
  });
  it('cuts a long question at a word', () => {
    const title = conversationTitle('Can I afford a new phone for 150,000 FCFA this month without touching my savings?');
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(41);
    expect(title).toBe('Can I afford a new phone for 150,000…');
  });
});

describe('describeToolStep', () => {
  it('names known tools and falls back for others', () => {
    expect(describeToolStep('getDebts')).toBe('Reading your debts…');
    expect(describeToolStep('somethingNew')).toBe('Checking your data…');
  });
});

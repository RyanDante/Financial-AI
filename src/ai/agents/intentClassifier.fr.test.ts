import { classifyIntent, extractAmountMajor, extractMonthsCount } from './intentClassifier';

describe('classifyIntent (French)', () => {
  it.each([
    ['Puis-je dépenser 100 000 pour un nouveau téléphone ?', 'purchase'],
    ['Je veux acheter une moto', 'purchase'],
    ['Prévois mon solde dans 6 mois', 'forecast'],
    ['Est-ce que mon budget est dépassé ?', 'budget'],
    ['Où en sont mes objectifs ?', 'goal'],
    ['Quels abonnements me coûtent le plus ?', 'subscriptions'],
    ['Où va mon argent ?', 'spending'],
    ['Montre mes transactions', 'transactions'],
  ])('%s → %s', (question, intent) => {
    expect(classifyIntent(question)).toBe(intent);
  });
});

describe('French numbers', () => {
  it('reads space-separated thousands', () => {
    expect(extractAmountMajor('dépenser 100 000 FCFA')).toBe(100000);
    expect(extractAmountMajor('1 250 000')).toBe(1250000);
  });
  it('reads months in French', () => {
    expect(extractMonthsCount('dans 6 mois')).toBe(6);
    expect(extractMonthsCount('dans trois mois')).toBe(3);
  });
});

import { ALL_MESSAGES } from './index';
import { categoryLabel, t, tn } from '../index';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('message dictionaries', () => {
  it('French has every English key, non-empty, with the same placeholders', () => {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const area of ALL_MESSAGES) {
      const en = area.en as Record<string, string>;
      const fr = area.fr as Record<string, string>;
      for (const key of Object.keys(en)) {
        if (seen.has(key)) problems.push(`${key}: defined in two areas`);
        seen.add(key);
        if (!fr[key]?.trim()) problems.push(`${key}: missing French`);
        else if (placeholders(en[key]).join() !== placeholders(fr[key]).join()) problems.push(`${key}: placeholders differ`);
      }
      for (const key of Object.keys(fr)) if (!(key in en)) problems.push(`${key}: French only`);
    }
    expect(problems).toEqual([]);
  });

  it('fills params and picks plural forms per language', () => {
    expect(t('common.alerts.one', { count: 1 }, 'en')).toBe('Alerts, 1 needs attention');
    expect(tn('common.days', 2, undefined, 'en')).toBe('2 days');
    expect(tn('common.days', 0, undefined, 'en')).toBe('0 days');
    expect(tn('common.days', 0, undefined, 'fr')).toBe('0 jour');
    expect(tn('common.days', 3, undefined, 'fr')).toBe('3 jours');
  });

  it('translates built-in category names and keeps the user’s own', () => {
    expect(categoryLabel('Food', 'fr')).toBe('Alimentation');
    expect(categoryLabel('Food', 'en')).toBe('Food');
    expect(categoryLabel('Moto repairs', 'fr')).toBe('Moto repairs');
  });
});

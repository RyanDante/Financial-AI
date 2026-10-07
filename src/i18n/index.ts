import { useCallback } from 'react';
import { ALL_MESSAGES, type MessageKey } from './messages';
import { getLanguage, useLanguageStore, type Language } from './language';

export { getLanguage, getLocale, useLanguageStore, type Language, type LanguageSetting } from './language';
export type { MessageKey } from './messages';

type Params = Record<string, string | number>;

const DICTIONARIES: Record<Language, Record<string, string>> = {
  en: Object.assign({}, ...ALL_MESSAGES.map((m) => m.en)),
  fr: Object.assign({}, ...ALL_MESSAGES.map((m) => m.fr)),
};

function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** The string for `key` in `language` (the current one by default), with `{param}`s filled in. */
export function t(key: MessageKey, params?: Params, language: Language = getLanguage()): string {
  return format(DICTIONARIES[language][key] ?? DICTIONARIES.en[key] ?? key, params);
}

/** Keys that have `.one` / `.other` plural forms, named without the suffix. */
export type PluralKey = { [K in MessageKey]: K extends `${infer Base}.one` ? Base : never }[MessageKey];

/**
 * Plural-aware `t`: `{count}` is filled in automatically. French treats 0
 * and 1 as singular ("0 transaction"); English only 1.
 */
export function tn(key: PluralKey, count: number, params?: Params, language: Language = getLanguage()): string {
  const singular = language === 'fr' ? Math.abs(count) < 2 : count === 1;
  return t(`${key}.${singular ? 'one' : 'other'}` as MessageKey, { count, ...params }, language);
}

/** `t` and `tn` for components; re-renders them when the language changes. */
export function useT() {
  const language = useLanguageStore((s) => s.language);
  const translate = useCallback((key: MessageKey, params?: Params) => t(key, params, language), [language]);
  const translatePlural = useCallback((key: PluralKey, count: number, params?: Params) => tn(key, count, params, language), [language]);
  return { t: translate, tn: translatePlural, language };
}

/** A category's display name: the built-in categories are translated, the user's own are shown as typed. */
export function categoryLabel(name: string, language: Language = getLanguage()): string {
  return DICTIONARIES[language][`cat.${name}`] ?? name;
}

/** A copilot specialist's display name ("Spending Agent" → "Agent Dépenses"). */
export function agentLabel(name: string, language: Language = getLanguage()): string {
  return DICTIONARIES[language][`agent.${name}`] ?? name;
}

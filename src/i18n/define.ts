/**
 * One area's strings: English, and French with exactly the same keys
 * (TypeScript rejects a missing or extra key). `{name}` is replaced by
 * the `name` param; plural forms are `key.one` / `key.other`.
 */
export function defineMessages<const T extends Record<string, string>>(en: T, fr: { [K in keyof T]: string }): { en: T; fr: { [K in keyof T]: string } } {
  return { en, fr };
}

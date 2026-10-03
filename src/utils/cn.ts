/** Joins conditional className fragments, skipping falsy values. Small enough not to need a dependency. */
export function cn(...classNames: (string | false | null | undefined)[]): string {
  return classNames.filter(Boolean).join(' ');
}

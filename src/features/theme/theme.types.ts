/** 'system' follows the OS appearance; 'light'/'dark' is an explicit user override. */
export type ThemeMode = 'light' | 'dark' | 'system';

export function isThemeMode(value: string): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

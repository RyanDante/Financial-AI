import rawColors from './colors';

export type ColorScheme = 'light' | 'dark';

export type ColorKey =
  | 'background'
  | 'background-raised'
  | 'surface'
  | 'surface-elevated'
  | 'surface-sunken'
  | 'surface-glass'
  | 'border'
  | 'border-strong'
  | 'border-heavy'
  | 'text-primary'
  | 'text-secondary'
  | 'text-muted'
  | 'accent'
  | 'accent-secondary'
  | 'accent-muted'
  | 'success'
  | 'success-muted'
  | 'warning'
  | 'warning-muted'
  | 'danger'
  | 'danger-muted'
  | 'info'
  | 'info-muted'
  | 'shadow-hard'
  | 'shadow-hard-soft';

const palettes = rawColors as Record<ColorScheme, Record<ColorKey, string>>;

/**
 * Literal hex values for the rare native-style prop that can't read a
 * Tailwind className (e.g. Ionicons `color`, React Navigation's tabBarStyle,
 * shadow `shadowColor`, TextInput `placeholderTextColor`). Everything else
 * should use a className — those already repaint on theme change via the
 * CSS variables in src/styles/global.css; this does not, so callers must
 * re-read it on every render via useColorScheme() (see
 * src/features/theme/theme.store.ts), not cache it.
 *
 * Token roles are documented in ui.md §3.
 */
export function getColors(scheme: ColorScheme): Record<ColorKey, string> {
  return palettes[scheme];
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const radii = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/**
 * Semantic type scale. "display" sizes are for financial figures (balances,
 * goal progress) and should always use the display font family; "body"
 * sizes are for everything else. The component wrappers in
 * src/components/ui/Typography.tsx and AmountText.tsx are the intended way to
 * use these — prefer them over raw text-[Npx] classes (ui.md §4).
 */
export const typeScale = {
  displayLg: 44,
  displayMd: 30,
  displaySm: 22,
  bodyLg: 15,
  bodyMd: 13,
  bodySm: 11,
  caption: 11,
} as const;

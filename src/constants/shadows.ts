import { useColorScheme } from 'nativewind';
import { getColors, type ColorScheme } from './theme';

/**
 * The shadow system (ui.md §7).
 *
 * These are deliberately NOT Tailwind `boxShadow` classes: Android needs
 * `elevation`, the color has to react to the active theme, and a true
 * neo-brutalist hard edge needs `shadowRadius: 0` — none of which a static
 * shadow class can express. Consume them with `useShadow(name)`.
 *
 * `brutal` / `brutal-lg` use the theme's `shadow-hard` color: true ink in
 * light mode, the accent violet in dark mode (a black hard shadow on a
 * near-black card is invisible — see ui.md §12).
 */
export type ShadowName = 'subtle' | 'card' | 'brutal' | 'brutal-lg' | 'floating' | 'dramatic' | 'sunken';

export type ShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

type ShadowSpec = Omit<ShadowStyle, 'shadowColor'> & { color: ColorKey };

type ColorKey = 'shadow-hard' | 'shadow-hard-soft' | 'text-primary';

const SPECS: Record<ShadowName, ShadowSpec> = {
  // Resting lift on chips and badges — present, but barely.
  subtle: { color: 'text-primary', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  // The default raised card. Soft, downward, never a hard edge.
  card: { color: 'text-primary', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 4 },
  // The neo-brutalist signature: zero blur, full-strength offset.
  brutal: { color: 'shadow-hard', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  brutal-lg: { color: 'shadow-hard-soft', shadowOffset: { width: 5, height: 5 }, shadowOpacity: 0.9, shadowRadius: 0, elevation: 8 },
  // Glass surfaces: tab bar, sheets, floating headers.
  floating: { color: 'text-primary', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 28, elevation: 12 },
  dramatic: { color: 'text-primary', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 48, elevation: 20 },
  // Recessed wells. RN has no inset shadow, so this is a negative-offset
  // shadow plus a darkened top rim (see Input.tsx) — it reads as carved.
  sunken: { color: 'text-primary', shadowOffset: { width: 0, height: -1 }, shadowOpacity: 0.35, shadowRadius: 0, elevation: 0 },
};

export function getShadowTokens(scheme: ColorScheme): Record<ShadowName, ShadowStyle> {
  const colors = getColors(scheme);
  return Object.fromEntries(
    Object.entries(SPECS).map(([name, { color, ...rest }]) => [name, { ...rest, shadowColor: colors[color] }]),
  ) as Record<ShadowName, ShadowStyle>;
}

/**
 * Reads the live theme and returns one shadow style. Must be called during
 * render (it subscribes to nativewind's color scheme) — never cache the
 * result, or a theme switch will leave stale shadow colors behind.
 */
export function useShadow(name: ShadowName): ShadowStyle {
  const { colorScheme } = useColorScheme();
  return getShadowTokens(colorScheme === 'light' ? 'light' : 'dark')[name];
}

/** All tokens at once, for the rare caller that needs to compose (e.g. a pressed state collapsing brutal -> subtle). */
export function useShadows(): Record<ShadowName, ShadowStyle> {
  const { colorScheme } = useColorScheme();
  return getShadowTokens(colorScheme === 'light' ? 'light' : 'dark');
}

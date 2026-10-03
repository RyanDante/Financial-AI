const spacing = require('./src/constants/spacing');
const radii = require('./src/constants/radii');

// Each entry reads a CSS variable defined for both themes in
// src/styles/global.css (`:root` = light, `.dark` = dark), so every existing
// className using these names (bg-background, text-text-primary, ...) is
// theme-aware automatically. `<alpha-value>` lets Tailwind opacity utilities
// (e.g. bg-background/50) keep working. surface-glass already bakes in its
// own alpha (it's a translucent fill), so it's a plain var() instead.
function themedColor(name) {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

// Token roles and the dark/light values behind each of these are documented in
// ui.md §3. Roles are added here in lockstep with global.css — a color that
// exists in one and not the other is a bug.
const colors = {
  background: themedColor('background'),
  'background-raised': themedColor('background-raised'),
  surface: themedColor('surface'),
  'surface-elevated': themedColor('surface-elevated'),
  // Recessed wells — darker than the page, so a field reads as carved rather
  // than raised (ui.md §11).
  'surface-sunken': themedColor('surface-sunken'),
  // Glass is a plain var() because it already carries its own alpha.
  'surface-glass': 'var(--color-surface-glass)',
  border: themedColor('border'),
  'border-strong': themedColor('border-strong'),
  // The neo-brutalist ink. True near-black in light mode, light ink in dark
  // mode, because a black border on a near-black card is invisible (ui.md §12).
  'border-heavy': themedColor('border-heavy'),
  'text-primary': themedColor('text-primary'),
  'text-secondary': themedColor('text-secondary'),
  'text-muted': themedColor('text-muted'),
  accent: themedColor('accent'),
  'accent-secondary': themedColor('accent-secondary'),
  'accent-muted': themedColor('accent-muted'),
  success: themedColor('success'),
  'success-muted': themedColor('success-muted'),
  warning: themedColor('warning'),
  'warning-muted': themedColor('warning-muted'),
  danger: themedColor('danger'),
  'danger-muted': themedColor('danger-muted'),
  info: themedColor('info'),
  'info-muted': themedColor('info-muted'),
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      spacing,
      borderRadius: radii,
      // The border system (ui.md §6). `medium` (2px) is the neo-brutalist ink
      // weight; `heavy` (3px) is reserved for full-screen emphasis and must
      // not appear on a card.
      borderWidth: {
        hairline: '1px',
        thin: '1px',
        medium: '2px',
        heavy: '3px',
      },
      fontFamily: {
        display: ['SpaceGrotesk_700Bold'],
        'display-medium': ['SpaceGrotesk_500Medium'],
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
      },
    },
  },
  plugins: [],
};

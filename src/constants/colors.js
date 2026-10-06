// Plain JS (not TS) so theme.ts can import it with zero build step, and so
// a human editing colors only has to edit hex values here — never raw RGB
// triplets. The actual Tailwind/NativeWind color tokens read CSS variables
// defined in src/styles/global.css instead (see tailwind.config.js), because
// NativeWind resolves classNames at build time and can't read this file at
// runtime. If you change a value here, update the matching `--color-*` line
// in global.css (dark values under `.dark`, light values under `:root`) —
// there is currently no step that does this for you.
//
// Used directly (not via Tailwind) only by code that needs a literal color
// value in a native style prop rather than a className — Ionicons `color`,
// native shadow `shadowColor`, React Navigation's tabBarStyle, and a few
// native style props (RefreshControl tintColor, TextInput
// placeholderTextColor) — all via src/constants/theme.ts's `getColors(scheme)`.
//
// The role of every token is documented in ui.md §3. Do not add a color here
// without adding it there first.
module.exports = {
  dark: {
    background: '#0A0A0F',
    'background-raised': '#101017',
    surface: '#16161E',
    'surface-elevated': '#1F1F2A',
    'surface-sunken': '#0C0C12',
    'surface-glass': 'rgba(30, 30, 44, 0.72)',
    border: '#2C2C3A',
    'border-strong': '#43435A',
    'border-heavy': '#5A5A78',
    'text-primary': '#F5F5F7',
    'text-secondary': '#A0A0B2',
    'text-muted': '#8585A0',
    accent: '#7C5CFC',
    'accent-secondary': '#3DDCFF',
    'accent-muted': '#241C4A',
    'on-accent': '#0A0A0F',
    success: '#3FC98B',
    'success-muted': '#122C24',
    warning: '#F5A524',
    'warning-muted': '#33260F',
    danger: '#F2545B',
    'danger-muted': '#331A1D',
    info: '#8A8AF0',
    'info-muted': '#1E1D3D',
    'shadow-hard': '#7C5CFC',
    'shadow-hard-soft': '#5B41D6',
  },
  light: {
    background: '#F2F1EE',
    'background-raised': '#FBFAF8',
    surface: '#FFFFFF',
    'surface-elevated': '#EDEBE6',
    'surface-sunken': '#E7E5DF',
    'surface-glass': 'rgba(255, 255, 255, 0.78)',
    border: '#DEDBD3',
    'border-strong': '#B9B5AA',
    'border-heavy': '#14141A',
    'text-primary': '#14141A',
    'text-secondary': '#4E4E58',
    'text-muted': '#6A6A74',
    accent: '#5B3FD6',
    'accent-secondary': '#0E7C93',
    'accent-muted': '#EAE4FF',
    'on-accent': '#F5F5F7',
    success: '#12855A',
    'success-muted': '#E2F5EC',
    warning: '#9A6206',
    'warning-muted': '#FBF0DA',
    danger: '#C42C36',
    'danger-muted': '#FBE3E4',
    info: '#4B45C4',
    'info-muted': '#E7E6FB',
    'shadow-hard': '#14141A',
    'shadow-hard-soft': '#14141A',
  },
};

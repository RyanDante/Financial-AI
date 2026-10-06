# F-AI — UI Design System

**Status:** source of truth for the application's visual design.
**Scope:** visual and interaction only. Financial calculations, SQLite, repositories, AI
tools/agents, sync, and auth are out of scope for this document and must not be changed to
serve a UI goal — see [§34 Non-negotiables](#34-non-negotiables).

Read this before adding or changing any visual code. If a change needs a value that isn't
documented here, add the token here first, then use it.

---

## Table of contents

1. [Design philosophy](#1-design-philosophy)
2. [Visual identity](#2-visual-identity)
3. [Color tokens](#3-color-tokens)
4. [Typography](#4-typography)
5. [Spacing](#5-spacing)
6. [Border system](#6-border-system)
7. [Shadow system](#7-shadow-system)
8. [Radius system](#8-radius-system)
9. [Glass system](#9-glass-system)
10. [Neo-brutalist rules](#10-neo-brutalist-rules)
11. [Geomorphic rules](#11-geomorphic-rules)
12. [Dark mode](#12-dark-mode)
13. [Light mode](#13-light-mode)
14. [Buttons](#14-buttons)
15. [Cards](#15-cards)
16. [Inputs](#16-inputs)
17. [Navigation](#17-navigation)
18. [Financial metrics](#18-financial-metrics)
19. [Charts and data visualization](#19-charts-and-data-visualization)
20. [AI UI](#20-ai-ui)
21. [Transactions](#21-transactions)
22. [Budgets](#22-budgets)
23. [Goals](#23-goals)
24. [Modals](#24-modals)
25. [Bottom sheets](#25-bottom-sheets)
26. [Animation](#26-animation)
27. [Haptics](#27-haptics)
28. [Accessibility](#28-accessibility)
29. [Responsive behavior](#29-responsive-behavior)
30. [Component naming conventions](#30-component-naming-conventions)
31. [NativeWind / Tailwind conventions](#31-nativewind--tailwind-conventions)
32. [Examples](#32-examples)
33. [Do / Don't rules](#33-do--dont-rules)
34. [Non-negotiables](#34-non-negotiables)
35. [Token reference — where things live](#35-token-reference--where-things-live)

---

## 1. Design philosophy

F-AI is a **financial instrument**, not a lifestyle app. The interface has one job: make the
user's financial situation legible in under two seconds, and make every AI statement
traceable to a number the app actually computed.

The visual language is a deliberate combination, applied **asymmetrically**:

| Layer | Aesthetic | Where it is allowed | Budget |
|---|---|---|---|
| **Structure** | Neo-Brutalism | Hero, primary CTA, active/selected states, section dividers | Hard shadows + 2px borders on **at most 2 elements per screen** |
| **Intelligence** | Glassmorphism | Tab bar, AI surfaces, modal sheets, insight cards, floating headers | Translucency only on surfaces that **float over scrolling content** |
| **Depth** | Geomorphism | Inputs (recessed), buttons (raised), hero (layered), metric cards | Soft outer shadows + 1px inner highlight |
| **Data** | Neo-Realism | Every number, label, and axis | Flat, aligned, high-contrast, zero decoration |

The rule that resolves all conflicts:

> **Numbers are never decorated. Chrome is allowed to be expressive.**

If a visual treatment makes a figure harder to scan, it is wrong — regardless of how good it
looks. A screen can be memorable because of its *composition* (asymmetric hero, geometric
progress, hard-shadow CTA) rather than because its numbers are dressed up.

Priority order when two treatments compete (highest first):

1. **Financial numbers** — size, weight, tabular alignment, contrast
2. **Important actions** — one primary CTA per view, unmistakable
3. **Financial status** — over/near/under, safe/at-risk
4. **Context** — where the number came from, what period it covers
5. **Secondary information** — metadata, timestamps, IDs
6. **Decorative elements** — shadows, glows, patterns

---

## 2. Visual identity

**The product in one line:** *a precision instrument that happens to have an AI in it.*

Three signature moves, reused consistently, are what make F-AI recognizable:

1. **The slab.** Large financial figures sit on a raised slab with a hard offset shadow and a
   2px border — the neo-brutalist anchor. On the dashboard it's the hero; inside modals it's
   the amount field. It always means *"this is the number that matters"*.
2. **The notch.** Active/selected states use an asymmetric geometric indicator (a filled
   square notch on the leading edge, a stepped bar segment, a dot-plus-rule) rather than a
   pill or a glow. It reads as instrumentation, not decoration.
3. **The trace.** Anything the AI produced is rendered as a labelled, tiered trace — the
   claim kind (`FACT` / `CALCULATION` / `PROJECTION` / `ASSUMPTION` / `INTERPRETATION`) is
   visible as a colored rule and an overline, and the tools used are shown as a checklist.
   Trust is a visual feature.

**Voice:** terse, factual, uppercase micro-labels. Financial labels are `OVERLINE` style
(`TOTAL SPENDING`, not "Total spending"). No exclamation marks, no emoji, no cheerleading.
The AI's tone is regulated in code (`src/ai/agents/`), not in CSS — this document governs
how it is *presented*.

**Accent discipline:** exactly one accent (Electric Violet) carries brand meaning. Cyan is the
*data secondary* — used for projections, tool activity, and the second data series in charts,
never as a CTA fill. Semantic colors (success/warning/danger/info) are reserved exclusively
for state and may never be used decoratively. Lime, hot pink and electric yellow are **not in
the palette**; they are recorded here as explicitly rejected so nobody adds them later.

---

## 3. Color tokens

All colors are CSS variables so a single `colorScheme.set()` from NativeWind repaints the
entire app. **Never hardcode a hex in a component.** The only sanctioned literal-color escape
hatch is `getColors(scheme)` from `@/constants/theme`, for props that cannot read a className
(Ionicons `color`, `tabBarStyle`, shadow `shadowColor`, `placeholderTextColor`). Inside a
component, call `useThemeColors()`, which reads the live scheme so a theme switch repaints.

### Semantic roles

| Token | Class | Role | Never use for |
|---|---|---|---|
| `background` | `bg-background` | App canvas, the page | Cards |
| `background-raised` | `bg-background-raised` | Full-bleed raised band (modals, sheets) | — |
| `surface` | `bg-surface` | Default card / row fill | — |
| `surface-elevated` | `bg-surface-elevated` | Raised surface, progress track, chip | — |
| `surface-sunken` | `bg-surface-sunken` | **Recessed** inputs, wells, code blocks | Cards |
| `surface-glass` | `bg-surface-glass` | Translucent floating surfaces only | Full-screen fills |
| `border` | `border-border` | Default 1px divider | Emphasis |
| `border-strong` | `border-border-strong` | 1px on inputs, secondary emphasis | — |
| `border-heavy` | `border-border-heavy` | 2px neo-brutalist ink border | — |
| `text-primary` | `text-text-primary` | Headings, figures | — |
| `text-secondary` | `text-text-secondary` | Body, labels | — |
| `text-muted` | `text-text-muted` | Captions, metadata, disabled | Anything load-bearing |
| `accent` | `text-accent` / `bg-accent` | **Brand primary.** Primary CTA, active tab, brand marks | Semantic state |
| `accent-secondary` | `text-accent-secondary` | **Data secondary.** Projections, tool activity, second chart series | Fills of primary CTAs |
| `accent-muted` | `bg-accent-muted` | Selected chip fill, soft accent background | — |
| `on-accent` | `text-on-accent` | Text and icons on an `accent` fill: primary button label, user chat bubble, accent icon buttons | Text on any other surface |
| `success` | `text-success` | Income, under budget, goal complete, upload OK | Decoration |
| `warning` | `text-warning` | Near limit, pending upload, assumption tier | Decoration |
| `danger` | `text-danger` | Over budget, overspend, negative balance, failure | Decoration |
| `info` | `text-info` | Neutral informational state | Success/failure |
| `success-muted` / `warning-muted` / `danger-muted` / `info-muted` | `bg-*-muted` | Tinted backgrounds behind those states | Text |

### Palette — dark (default)

| Token | Value | Note |
|---|---|---|
| `background` | `#0A0A0F` | Near-black, slightly blue — depth for glass to sit on |
| `background-raised` | `#101017` | Modal/sheet band |
| `surface` | `#16161E` | Cards |
| `surface-elevated` | `#1F1F2A` | Chips, tracks |
| `surface-sunken` | `#0C0C12` | Recessed wells — **darker** than `background` so inputs read as carved |
| `surface-glass` | `rgba(30, 30, 44, 0.72)` | Deliberately more opaque than a naive 0.5 — see [§9](#9-glass-system) |
| `border` | `#2C2C3A` | Visible on `surface`, not on `background` |
| `border-strong` | `#43435A` | |
| `border-heavy` | `#5A5A78` | **Not black.** A black 2px border on a near-black card is invisible; dark-mode neo-brutalism uses a *light* ink. See [§12](#12-dark-mode) |
| `text-primary` | `#F5F5F7` | |
| `text-secondary` | `#A0A0B2` | Raised from the old `#9D9DAB` for contrast on `surface` |
| `text-muted` | `#8585A0` | Raised from `#71718A` (3.8:1) to reach 4.5:1 on `surface` |
| `accent` | `#7C5CFC` | Electric Violet |
| `accent-secondary` | `#3DDCFF` | Vibrant Cyan |
| `accent-muted` | `#241C4A` | |
| `on-accent` | `#0A0A0F` | Near-black: light text on this violet only reaches 4.0:1; this is 4.5:1 |
| `success` | `#3FC98B` | |
| `warning` | `#F5A524` | |
| `danger` | `#F2545B` | |
| `info` | `#8A8AF0` | Periwinkle — reads as "neutral AI", distinct from `accent` |
| `success-muted` | `#122C24` | |
| `warning-muted` | `#33260F` | |
| `danger-muted` | `#331A1D` | |
| `info-muted` | `#1E1D3D` | |
| `shadow-hard` | `#7C5CFC` | **Hard-shadow color = the accent.** A violet extrusion on near-black is the dark-mode signature; a black shadow would vanish |
| `shadow-hard-soft` | `#5B41D6` | Large-slab hard shadow |

### Palette — light

| Token | Value | Note |
|---|---|---|
| `background` | `#F2F1EE` | Warm white — not `#FFF`, which glares under dark text |
| `background-raised` | `#FBFAF8` | |
| `surface` | `#FFFFFF` | |
| `surface-elevated` | `#EDEBE6` | |
| `surface-sunken` | `#E7E5DF` | Recessed |
| `surface-glass` | `rgba(255, 255, 255, 0.78)` | More opaque than dark-mode glass — legibility over scroll wins |
| `border` | `#DEDBD3` | |
| `border-strong` | `#B9B5AA` | |
| `border-heavy` | `#14141A` | **True ink.** Light mode gets the classic black 2px border |
| `text-primary` | `#14141A` | |
| `text-secondary` | `#4E4E58` | |
| `text-muted` | `#6A6A74` | Darkened from `#82828C` (3.8:1) to 5.4:1 on `surface` |
| `accent` | `#5B3FD6` | Darker violet — `#7C5CFC` fails AA on white |
| `accent-secondary` | `#0E7C93` | Cyan darkened for contrast |
| `accent-muted` | `#EAE4FF` | |
| `on-accent` | `#F5F5F7` | Ink fails on this violet (2.7:1); light text is 6.2:1 |
| `success` | `#12855A` | |
| `warning` | `#9A6206` | |
| `danger` | `#C42C36` | |
| `info` | `#4B45C4` | |
| `success-muted` | `#E2F5EC` | |
| `warning-muted` | `#FBF0DA` | |
| `danger-muted` | `#FBE3E4` | |
| `info-muted` | `#E7E6FB` | |
| `shadow-hard` | `#14141A` | |
| `shadow-hard-soft` | `#14141A` | |

### Contrast floor

- Body text and all figures: **≥ 4.5:1** against their actual background.
- `text-muted`: **≥ 4.5:1** on `surface` and `background`, and never the sole carrier of meaning.
- Text on an `accent` fill uses `on-accent`, never `text-primary`.
- Semantic state is always **color + icon + text**. See [§28](#28-accessibility).
- Hairline dividers are decorative; if a divider carries meaning, use `border-strong`.

### Rejected colors

Hot pink, lime, electric yellow, and any pure `#000`/`#FFF` used as a surface. They are not in
the token set. Adding one requires editing this section first.

---

## 4. Typography

Two families, loaded once in `src/app/_layout.tsx`:

- **Space Grotesk** (`font-display`, `font-display-medium`) — **financial figures only.**
- **Inter** (`font-sans`, `font-sans-medium`, `font-sans-semibold`, `font-sans-bold`) — everything else.

This split is a hard rule. A balance in Inter reads as body copy; a paragraph in Space Grotesk
reads as a headline. Never mix within one component.

### Scale

| Component | Class | Size / line | Family | Use |
|---|---|---|---|---|
| `Display` | `font-display` | 44 / 46 | Space Grotesk 700 | Hero figure only — one per screen |
| `AmountText xl` | `font-display` | 40 / 44 | Space Grotesk 700 | Sheet/modal amount field |
| `AmountText lg` | `font-display` | 30 / 34 | Space Grotesk 700 | Hero in compact layouts, metric cards |
| `AmountText md` | `font-display` | 22 / 26 | Space Grotesk 700 | Default card figure |
| `AmountText sm` | `font-display` | 16 / 20 | Space Grotesk 700 | List rows, dense tables |
| `AmountText xs` | `font-display` | 13 / 16 | Space Grotesk 700 | Inline stats inside a sentence |
| `Heading` | `font-sans-bold` | 22 / 28 | Inter 700 | Screen titles, modal titles |
| `Title` | `font-sans-semibold` | 17 / 22 | Inter 600 | Card titles, list row primary text |
| `Body` | `font-sans` | 15 / 21 | Inter 400 | Default copy, AI narration |
| `BodySmall` | `font-sans` | 13 / 18 | Inter 400 | Secondary copy, dense lists |
| `Label` | `font-sans-medium` | 13 / 16 | Inter 500 | Field labels, inline labels |
| `Overline` | `font-sans-bold` | 10 / 12 | Inter 700 | **Uppercase, `tracking-widest`** — financial labels (`TOTAL SPENDING`) |
| `Caption` | `font-sans` | 11 / 14 | Inter 400 | Timestamps, metadata, units |

### Rules

- **All monetary figures use `fontVariant: ['tabular-nums']`.** Balances must not jitter in
  width as digits change, and columns must align. `AmountText` sets this for you.
- Overline labels are the app's default for anything describing a figure. Sentence case in a
  label reads as unpolished.
- Body copy is never below 13px. Caption is never load-bearing.
- Bold is reserved for figures, overlines, and active states. If everything is bold, nothing is.
- Units (`FCFA`, `$`) are **not** part of the figure. `AmountText` renders the formatted number
  only; the currency symbol sits in its own muted run so the digits stay scannable.
- Long merchant names truncate with `numberOfLines={1}` and `ellipsizeMode="tail"`. Never
  wrap a row's primary text to two lines — it breaks row rhythm. Secondary text may wrap to 2.

---

## 5. Spacing

Tokens live in `src/constants/spacing.js` and are exposed as Tailwind spacing utilities.

| Token | Value | Use |
|---|---|---|
| `xs` | 4 | Icon↔label, badge padding, chip gaps |
| `sm` | 8 | Within a component: label→field, row inner gaps |
| `md` | 12 | Between related components, list row vertical padding |
| `lg` | 16 | **Screen gutter.** Horizontal page padding and card padding |
| `xl` | 24 | Between major blocks, raised-card padding |
| `2xl` | 32 | Hero internal padding, section separation |
| `3xl` | 48 | Empty-state vertical breathing room, sheet top padding |
| `4xl` | 64 | Hero top/bottom padding on tall layouts |

**Screen gutter is always `lg` (16).** Not 20, not 24. A screen whose horizontal padding
differs from its siblings' is a bug.

Vertical rhythm between sections: `xl`. Within a section: `md`. Within a component: `sm`.
Three levels, no more.

---

## 6. Border system

| Token | Width | Class | Use |
|---|---|---|---|
| `hairline` | 1 | `border` / `border-border` | Row dividers, list separators |
| `thin` | 1 | `border-border-strong` | Inputs at rest, secondary cards |
| `medium` | 2 | `border-2 border-border-heavy` | **Neo-brutalist ink** — hero, primary CTA, active chips |
| `heavy` | 3 | `border-[3px]` | Reserved: full-screen emphasis only. Never on a card |

Rules:

- Neo-brutalist ink borders are **`border-2`** (medium). 3px is a special case, not a default.
- List rows use **no border at all** on the row itself — separation comes from spacing. Borders
  on every row produce a "table" feel that fights the brutalist language.
- The ink border color is `border-heavy`, never `text-primary` and never a literal `#000`
  (light) / `#FFF` (dark).
- Cards that sit on `background` need a visible border. Cards on `surface-raised` need one too.
  A borderless card on a flat background reads as an accident.

---

## 7. Shadow system

Shadows are **not** Tailwind `boxShadow` classes. They are theme-aware native RN shadow props
(`shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` + Android `elevation`), resolved
per scheme by `getShadowTokens(scheme)` in `@/constants/shadows`, consumed via the
`useShadow(name)` hook. Reason: Android needs `elevation`, the color must react to the active
theme, and `shadowRadius: 0` is what produces a true hard edge — none of which a static
Tailwind shadow class can express.

| Token | Offset | Blur | Opacity | Use |
|---|---|---|---|---|
| `subtle` | 0, 1 | 2 | 0.10 | Resting lift on chips, badges |
| `card` | 0, 4 | 16 | 0.22 | Default raised card |
| `brutal` | **3, 3** | **0** | 1.0 | **Hard offset shadow** — hero slab, primary CTA |
| `brutal-lg` | **5, 5** | **0** | 0.9 | Large hero slab only |
| `floating` | 0, 12 | 28 | 0.30 | Glass surfaces: tab bar, sheets, floating headers |
| `dramatic` | 0, 20 | 48 | 0.40 | Modals, sheets, full-screen overlays |

- `brutal` / `brutal-lg` use `shadow-hard` (violet in dark, ink in light) at full opacity with
  `shadowRadius: 0`. This is the neo-brutalist signature.
- **Density budget: at most two hard shadows visible at once.** A screen with a hard-shadowed
  hero *and* a hard-shadowed primary CTA *and* hard-shadowed cards has lost the effect.
- Soft shadows (`card`, `floating`) never use `shadowRadius: 0`, and hard shadows never use a
  blur radius. Mixing the two in one token is the fastest way to make a UI look accidental.

---

## 8. Radius system

Tokens in `src/constants/radii.js`.

| Token | Value | Use |
|---|---|---|
| `xs` | 4 | Segmented bar cells, tiny chips, meter segments |
| `sm` | 8 | Buttons (`secondary`/`ghost`), badges, small inputs |
| `md` | 14 | **Default.** Inputs, cards, list rows, chips |
| `lg` | 20 | Hero slab, large cards, sheets |
| `xl` | 28 | Modal sheets (top corners only) |
| `pill` | 999 | Tab bar, floating pills, avatar circles, badges (optional) |

- The default surface radius is `md`. Deviating requires a reason you can state.
- Neo-brutalist slabs use `lg`, not `xs`. Sharp corners on a hero read as "unfinished", not
  "brutalist" — brutalism is about weight and contrast, not about zero radius.
- Pill radius is reserved for genuinely floating or circular things. A card at `pill` looks
  like a mistake.
- Sheets round only their **top** two corners (`rounded-t-xl`).

---

## 9. Glass system

**Glass is for surfaces that float over scrolling content.** If content does not pass beneath
it, it is not glass — use `surface`.

Approved glass surfaces:

1. Floating tab bar
2. AI assistant composer + AI screen header
3. Modal / sheet surfaces
4. Insight cards (AI output)
5. The dashboard's "ask the copilot" bar

### Anatomy

A glass surface is **four** stacked things, never just a translucent fill:

```
1. Translucent fill     bg-surface-glass        (72–78% alpha, never lower)
2. Top highlight        border-t border-white/10 (light source from above)
3. Edge definition      border border-border    (a visible boundary is mandatory)
4. Float               shadow-floating
```

### Deliberate choices

- **No native blur module.** `expo-blur` is not used. Reasons, in order: (a) it is a native
  module, which means Expo Go can't render the app's primary navigation correctly on Android
  and every contributor needs a dev build for one visual effect; (b) blur is *expensive and
  inconsistent* on Android, and a financial app must not drop frames while scrolling money;
  (c) layered translucency + a highlight edge + a float shadow reads as frosted glass at
  these alphas. Adding a real blur later means wrapping `BlurView` **behind** the existing
  fill inside `GlassSurface` — the token contract does not change.
- **Alpha is 0.72 (dark) / 0.78 (light), not 0.5.** Financial text must stay readable over an
  unknown amount of scrolling content. Legibility beats the effect.
- **Never glass a data-dense surface.** Glass is chrome. If it contains a table, a list of
  figures, or the primary number, it is `surface` with a border.
- Glass is never used for a full-screen background — the page canvas is always opaque.

---

## 10. Neo-brutalist rules

Neo-brutalism here means **weight, contrast, and hard geometry** — not decoration, not
shadows everywhere, not a novelty font.

**What it means here:**
- 2px `border-heavy` ink border
- `brutal` hard offset shadow (3px, zero blur)
- High-contrast fills, often inverted (dark fill + light text on a selected chip)
- Flat color blocks — no gradients on neo-brutalist surfaces
- Visible geometry: notches, rules, segmented meters

**Where it is allowed:**

| Surface | Treatment |
|---|---|
| Hero slab | 2px ink border + `brutal-lg` shadow + `rounded-lg` |
| Primary CTA | 2px ink border + `brutal` shadow, press-translates onto its own shadow |
| Selected chip / active filter | 2px ink border + inverted fill |
| Section header | 2px rule under the overline, or a leading notch block |
| Segmented progress meter | Hard-edged cells with 2px gaps — no rounded caps |
| AI claim rows | 2px leading color rule |

**Where it is forbidden:**

- List rows (they get rhythm from spacing)
- Text inputs (they get the recessed/geomorphic treatment instead — a hard-shadowed input
  reads as broken)
- Every card in a list (budget rows, goal cards, transaction cards)
- Badges, captions, metadata
- Anything inside a scrolling list more than once

**The inversion rule:** on a selected state, the fill and the text swap (`bg-text-primary` +
`text-background`). It is the strongest selection signal available and costs no extra space.
Use it for chips and active tabs, not for cards.

---

## 11. Geomorphic rules

Depth comes from **light logic**, not from blur everywhere. Every raised surface has exactly
one light source: **above**. Every recessed surface is carved from above.

**Raised (a physical object sitting on the page):**
```
bg-surface
border border-border          → defines the silhouette
border-t border-white/[0.06]  → 1px inner highlight: the top edge catches light
shadow-card                   → soft, downward, low opacity
```

**Recessed (a well carved into the page):**
```
bg-surface-sunken             → darker than background, not just different
border border-border-strong   → the rim
style={{ borderTopColor: 'rgb(0 0 0 / 0.35)' }}  → inner shadow at the top edge
```
Inputs, the AI composer well, and code/trace blocks are recessed. Nothing else is.

**Layered (floating above the page):** glass — [§9](#9-glass-system).

**Tactile (pressable):** hard shadow + press-translate. See [§14](#14-buttons).

Gradient tokens (`gradientHero`, `gradientGlass`, `gradientSheet`) are **specified but not
implemented** — they require `expo-linear-gradient`, a native module this app does not
depend on. Depth is currently achieved with layered translucency, which is more consistent
with the flat-fill neo-brutalist language. When a gradient is added, these are the values:

| Token | Stops (dark) | Stops (light) | Use |
|---|---|---|---|
| `gradientHero` | `#1A1440` → `#16161E` (135°) | `#F6F2FF` → `#FFFFFF` (135°) | Hero slab fill |
| `gradientGlass` | `rgba(124,92,252,0.16)` → `rgba(61,220,255,0.08)` (160°) | `rgba(91,63,214,0.10)` → `rgba(14,124,147,0.05)` | AI/insight surfaces |
| `gradientSheet` | `#1A1A24` → `#101017` (180°) | `#FFFFFF` → `#F6F5F1` (180°) | Modal sheets |

---

## 12. Dark mode

Dark is the **primary** theme (the product was designed for it; `app.json` sets
`userInterfaceStyle: "dark"`). It is not "light mode with black backgrounds".

**How dark mode preserves depth:**

1. **Hard shadows change color, not just visibility.** A pure-black hard shadow on `#0A0A0F`
   is invisible, so the neo-brutalist shadow is `--color-shadow-hard` = **Electric Violet** at
   full strength. A violet extrusion reads as a lit edge and is the single most recognizable
   thing about the app in dark mode. Light mode keeps the classic ink shadow.
2. **Ink borders go light, not black.** `--color-border-heavy` is `#5A5A78` in dark. A 2px
   black border on a near-black card is an invisible border — worse than no border, because
   the layout implies one exists.
3. **Recessed surfaces get darker, not lighter.** `surface-sunken` (`#0C0C12`) is darker than
   `background` (`#0A0A0F`) plus a darkened top rim. A sunken well that is *lighter* than the
   page reads as raised.
4. **Glass is more opaque than you'd guess** (0.72) and carries a white top highlight, because
   on dark the "frost" is a lighter film, not a darker one.
5. **Semantic colors are lightened** for dark backgrounds; every `-muted` companion is a dark
   tint of the same hue, so a `danger` chip's background and text are the same family.

---

## 13. Light mode

Light mode is **not an inversion**. It uses warm neutrals (`#F2F1EE`, `#FBFAF8`) rather than
pure white, so that `#14141A` text and the ink border don't vibrate against the page.

- The accent darkens to `#5B3FD6` — the dark-mode violet fails contrast on white.
- Accent-secondary cyan darkens to `#0E7C93` for the same reason.
- Glass alpha *increases* (0.78): light-mode translucency over a light page loses contrast
  faster.
- Neo-brutalism gets *more* literal here (true `#14141A` ink borders, black hard shadows),
  which is correct — light mode is where the brutalist language is most legible.
- Both themes ship together. Neither is a degraded mode of the other.

**Theme switching** is user-owned (`settingsStore` pattern → `theme.store.ts`, persisted to
`settings` as `theme_mode`), defaults to `dark`, and applies app-wide via
`colorScheme.set()`. Any component that needs a literal color must call `getColors(scheme)`
with a live `useColorScheme()` read — never cache it.

---

## 14. Buttons

`Button` from `@/components/ui`. Touch targets: **min 44×44**, `md` and `lg` sizes are 48 and
56. No interactive element in the app may be smaller than 44×44.

| Variant | Fill | Border | Shadow | Label | Use |
|---|---|---|---|---|---|
| `primary` | `bg-accent` | `border-2 border-border-heavy` | `brutal` | `text-on-accent` | **One per view.** The action the screen exists for |
| `secondary` | `bg-surface` | `border border-border-strong` | `subtle` | `text-text-primary` | Alternative actions, cancel |
| `ghost` | transparent | `border border-border` | none | `text-text-secondary` | Tertiary, inline, dismiss |
| `danger` | `bg-danger-muted` | `border-2 border-danger` | `brutal` | `text-danger` | Destructive / destructive-adjacent |

| Size | Height | Padding | Label | Use |
|---|---|---|---|---|
| `sm` | 36 | `px-md` | `BodySmall` semibold | Chips, inline actions — **not** a primary CTA |
| `md` | 48 | `px-lg` | `Body` semibold | Default, all forms |
| `lg` | 56 | `px-xl` | `Title` semibold | Dashboard hero CTA, sheets |

### States

- **Rest** — as tabled.
- **Pressed** — `primary`/`danger` translate **+2px down/right onto their own shadow** and the
  shadow collapses to `subtle`. This is the tactile neo-brutalist press: the button appears
  to be pushed into its own extrusion. `secondary`/`ghost` scale to 0.98.
- **Disabled** — 45% opacity, `accessibilityState={{ disabled: true }}`, no shadow. A disabled
  button must still be readable; never drop its contrast below 3:1.
- **Loading** — label is replaced by an activity indicator, control keeps its exact width so
  the layout doesn't jump, `accessibilityState={{ busy: true }}`.
- **Focus (web/tvOS)** — 2px `accent` ring, 2px offset.

All buttons: `accessibilityRole="button"`, `accessibilityLabel` defaults to `label`, and a
haptic `selection` on press ([§27](#27-haptics)).

---

## 15. Cards

`Card` from `@/components/ui`. **One component, five variants** — there is no `GlassCard.tsx`
or `BrutalistCard.tsx`; those are `variant="glass"` / `variant="brutal"`.

| Variant | Fill | Border | Radius | Shadow | Padding | Use |
|---|---|---|---|---|---|---|
| `flat` | `surface` | 1px `border` | `md` | none | `lg` | Default list/group card |
| `raised` | `surface` | 1px `border` | `lg` | `card` | `xl` | Standalone feature card |
| `brutal` | `surface-raised` | **2px `border-heavy`** | `lg` | `brutal-lg` | `2xl` | The hero slab — **max one per screen** |
| `glass` | `surface-glass` | 1px `border` + white top highlight | `pill` or `lg` | `floating` | `lg` | Floating chrome, AI/insight |
| `sunken` | `surface-sunken` | 1px `border-strong` | `md` | inner top rim | `lg` | Wells, trace blocks |

Card anatomy rules:

- Every card has a **title zone** (`Title`) or a **figure zone** (`AmountText`). A card with
  neither is a layout bug.
- Internal spacing is `sm` (label→value), `md` (value→value), `lg` (between groups).
- Cards in a repeating list are **flush** — 1px dividers or `sm` gaps, never both.
- A card never nests inside another card. Use a divider + spacing to group inside a card.
- Interactive cards get a pressed state (scale 0.99 + `subtle` shadow) and
  `accessibilityRole="button"`.

---

## 16. Inputs

`Input` and `AmountInput` from `@/components/ui`. Both are **recessed** (see
[§11](#11-geomorphic-rules)), never hard-shadowed.

### Input anatomy

```
LABEL (Label, text-secondary)
┌──────────────────────────────────┐
│ value / placeholder              │  ← bg-surface-sunken, 1px border-strong,
└──────────────────────────────────┘    min-height 48, rounded-md
helper text or error (Caption)
```

- **Label is always visible** — no floating-label-only fields. Financial forms are scanned,
  not read.
- **Focus:** `border-accent` + 1px `accent/30` ring. Focus must be visible without color
  change alone, so the border *thickens* to `border-2`.
- **Error:** `border-danger`, a `alert-circle` icon, and text that says what to do — never a
  raw exception string.
- **Disabled:** `bg-surface-elevated`, `text-text-muted`, `editable={false}`.
- `placeholderTextColor` must be `text-muted` — get it from `getColors(scheme)`, never a
  hardcoded hex.

### AmountInput

Financial amount fields get a dedicated component because the currency must never be hidden
or ambiguous:

```
AMOUNT (XAF)                       ← Overline label, includes currency code
┌──────────────────────────────────┐
│  125,000                    FCFA │  ← figure in display font, suffix muted,
└──────────────────────────────────┘    decimal-pad keyboard
```

- `keyboardType="decimal-pad"`, `autoCorrect={false}`.
- The figure is `AmountText lg` in the *display* family with tabular numerals — it's the
  largest thing in the form because it's the thing being entered.
- The currency symbol is a static right-aligned (or left-aligned, per
  `CURRENCIES[code].symbolPosition`) muted run inside the field.
- Validation rejects ≤ 0 with a specific message, per the existing
  `parseMoneyInput` contract.

---

## 17. Navigation

Routing is owned by Expo Router and **is not changed by this document.** Only presentation is.

### Floating glass tab bar

- Positioned absolutely, `lg` inset from left/right/bottom (plus the safe-area bottom inset,
  `Math.max(insets.bottom, 8)`), height 64, `rounded-pill`.
- `bg-surface-glass` + white top highlight + `border border-border` + `shadow-floating`.
- **Active indicator = the notch:** a filled `accent` block behind the icon (rounded `sm`),
  with the label switching to `text-accent-secondary` and semibold. The indicator is a
  *geometric block*, not a pill, not a glow, not a top line.
- Icon 22, label 10.5 semibold. Labels always visible (5 tabs, no room to hide them).
- Touch targets 48×48 minimum within the bar.
- Content scrolls *under* the bar — every scroll container gets `pb` of
  `4xl + tab bar height + inset`, never a magic number.

### Page headers: one rule

- **Tab screens** use the `AppBar` (below). **Every other page** uses the platform's native
  header with `usePageHeaderOptions()` from `src/components/navigation/pageHeader.tsx`:
  flat on `background`, title in Inter 600 17pt, `text-primary` tint, no shadow, minimal
  back button. The native header handles the status bar, notch, iOS sheet modals and the
  back gesture, so no page pads for the safe area itself.
- **Modals** use `modalOptions(title)`: `presentation: 'modal'` and a `CloseButton` (✕, 44×44,
  "Close") on the left. Their footer is one full-width primary action ("Save transaction");
  there is no separate Cancel button, because Close is in the header.
- Titles that depend on data are set from the screen with `<Stack.Screen options={{ title }} />`
  (e.g. "Edit transaction", "Food limit").
- **No screen draws its own title row or back button.** A `Heading` at the top of a page's
  content, or a "Back" caption, is a bug.

### App bar

- `AppBar` (`src/components/ui/AppBar.tsx`) is the fixed bar above every tab screen, mounted
  once as the Tabs `header` in `src/app/(tabs)/_layout.tsx`. It does not scroll.
- It **owns the top safe-area inset** (`paddingTop: insets.top`), then a 52pt row on
  `bg-background`, flat like the native page headers.
- Left: the name "F-AI" in `font-display` 20/24. Right: the alerts bell
  (`notifications-outline`) and settings (`settings-outline`), 44×44 targets, icons in
  `text-secondary`. A `danger` dot on the bell when `useAlerts()` returns anything; the
  bell's `accessibilityLabel` states the count.
- Screens below it that use `KeyboardAvoidingView` on iOS offset by `useAppBarHeight()`.
- The bell opens `/alerts`: a list built by `buildAlerts` (`src/features/alerts/alerts.ts`)
  from existing data only: negative safe-to-spend, over-budget categories, overdue goals,
  sync failures, failed attachment uploads. Danger first. No push notifications.

### Screen headers

- `ScreenHeader` sits inside the scroll view (not sticky), directly below the `AppBar`. It
  carries: title (`Heading`), optional subtitle, and a right slot for the screen's own action
  (e.g. `+`). Settings lives in the `AppBar`, not here.
- Top padding is `pt-md`: the `AppBar` already handles the safe area. Stack screens without
  the `AppBar` (modals, detail screens) must handle `insets.top` themselves.
- Headers on the AI screen are **glass** because chat scrolls beneath them.

---

## 18. Financial metrics

The `Metric` component (`src/components/finance/Metric.tsx`) is the standard unit of a small
financial figure. It is what the hero's inner strip and the obligations rows use.

```
OVERLINE                    ← Label describing the metric, uppercase
94,500                      ← AmountText md, display font, tabular
+12.4% vs last month        ← Delta, Caption + icon, semantic color
```

**Delta presentation (mandatory):** direction is carried by an **icon + sign + text**, not by
color alone:

| State | Icon | Text | Color |
|---|---|---|---|
| Up (income, savings, reserve) | `trending-up` | `+8.4%` | `text-success` |
| Down (spending) | `trending-down` | `−12.4%` | `text-danger` |
| Flat | `remove` | `0.0%` | `text-text-muted` |

For spending, "up" is bad and "down" is good — the color follows *whether the change is
favorable*, not the arrow direction, and the label always names the period so the meaning is
unambiguous without color.

**Number formatting:** always `formatMoney` / `AmountText`. Never interpolate a raw number
into a string, never hand-roll separators, never assume 2 decimals. Large figures stay on one
line — if `AmountText` at the target size would overflow, drop one step in the size scale
rather than truncating or wrapping.

---

## 19. Charts and data visualization

No charting library is used, and none is required for the current data volumes. Every
visualization is composed from `View`s using the tokens above, so it inherits theming for
free.

**Rules for any chart in this app:**

1. **The label is part of the chart.** A bar without "FOOD 94,500 / 120,000" above it is
   decoration. Value and category are always present as text.
2. **Readable without color.** Every series is distinguished by position/label first. If the
   chart only makes sense in color, it fails [§28](#28-accessibility).
3. **No 3D, no gauges, no dual axes, no pie charts.** No donut "spending breakdown" — use
   ranked horizontal bars, which are more precise and cheaper to read.
4. **Sequential/ordinal data → bars. Comparative over time → lines or columns. Part-to-whole
   with ≤ 4 slices → a segmented bar.** Beyond 4 slices, use a ranked list.
5. Axis labels are `Caption`. Axis lines are `border` hairlines. Grid lines are
   `border` at 50% opacity — never `border-strong` (they'd out-weigh the data).
6. Data series colors come from a fixed order: `accent`, `accent-secondary`, `success`,
   `warning`, `danger`. Never assign by index arithmetic.

### The segmented meter (the app's primary chart)

Used for budget progress. A horizontal row of hard-edged cells:

```
FOOD                                              78.7%
██████████████░░░░░░░░░░░░░░░░░░░░░░
94,500 / 120,000 XAF
```

- Cell count 28, `xs` radius (4), **2px gaps** — the gaps are what make it read as
  instrumentation rather than a progress bar.
- Filled cells take the tone color; empty cells take `surface-elevated`.
- Over 100%: cells stay full and the numeric label switches to `danger` + `over budget` text.
  Never shrink cells or animate them backwards.
- Height 10.

---

## 20. AI UI

The AI surface is the product's differentiator and must not read as a generic chat app.

### Message anatomy

**User message** — right-aligned, `bg-accent`, `rounded-md`, `text-on-accent`, max 85%
width. No border, no shadow: the user is not a card.

**Assistant message** — left-aligned, and **not one undifferentiated block**. An assistant turn
is a stack of three zones:

1. **Trace zone (collapsible-ish, always visible):** the tool checklist
   ([ToolActivity](#tool-activity)) — what the copilot actually did.
2. **Claim zone:** one row per claim, each with a **2px leading color rule** and an
   `Overline` claim kind, then the narration. This is the "trace" identity move and it is
   what makes AI output auditable at a glance.
3. **Follow-up zone:** suggested next actions as chips.

```
┌─────────────────────────────────────────┐
│ ┃ FACT     You spent 94,500 XAF in      │
│ ┃          2026-09.                     │
│ ┃ CALCULATION   That is up 12% compared  │
│ ┃               to 2026-08.             │
│ ┃ Want to see it by category?            │
│ [By category]  [Compare to budget]       │
└─────────────────────────────────────────┘
```

### Claim kind → treatment

| Kind | Overline | Rule color | Rationale |
|---|---|---|---|
| `FACT` | `text-text-muted` | `border-border-strong` | Neutral, read directly from data |
| `CALCULATION` | `text-text-muted` | `border-accent-secondary` | Deterministic engine output |
| `PROJECTION` | `text-text-muted` | `border-accent-secondary` | Same family as calculation, carries an assumption |
| `ASSUMPTION` | `text-text-muted` | `border-warning` | The thing the projection rests on — must read as a caveat |
| `INTERPRETATION` | `text-text-muted` | `border-accent` | The model's own framing — the only place accent means "AI" |

Note the overline is always muted and the **rule** carries the color. This keeps the message
from becoming a fruit salad while preserving the five-way distinction, and it satisfies the
no-color-alone rule because the kind is always spelled out in words.

### Tool activity

```
✓ getSpendingByCategory
✓ getSpending
```
Each tool is a row: a status glyph (`✓` complete, `◌` running) + the tool name in
`BodySmall` + optional output summary in `Caption`. Completed rows are `text-text-secondary`;
the running row is `text-accent-secondary` and pulses gently (opacity 1 → 0.5, 700ms,
reverse). Names are shown in `camelCase`, not raw — `getSpendingByCategory`, never
`get_spending_by_category`.

**Never expose chain-of-thought, prompts, raw inputs, or raw tool JSON.** Only the safe
tool-name checklist that `AIMessage.toolCalls` already provides. This is a product-integrity
rule, not a styling rule.

### Empty / first-run state

No wall of suggested prompts. Instead: the copilot's identity line ("I read your real
transactions and never guess a number."), then **6 prompt chips** in a horizontal scroll,
each a `ghost` chip with a leading contextual icon.

### Composer

Recessed well (`surface-sunken`, `rounded-pill`, `border-strong`, 1px darkened top rim) with a
48px send button. While `isSending`, the send button becomes a pulsing accent dot and the
input is `editable={false}`. Keyboard: `KeyboardAvoidingView` with `padding` on iOS and
`height` on Android.

---

## 21. Transactions

`TransactionRow` — the most-scanned component in the app. Information priority, left to
right:

1. **Category glyph** — 40px `IconCircle`, tinted from `category.color` at 15% alpha
   (`${color}26`), falling back to a neutral glyph. Never a different icon per transaction type.
2. **Merchant** (`Title`, 1 line, truncated). Falls back: merchant → description → category →
   `"Transaction"`.
3. **Context line** (`Caption`): `Category · Mon 12`. Always both, so a row is never
   ambiguous. Missing category renders `Uncategorized`, not an empty gap.
4. **Amount** (`AmountText sm`, tabular, right-aligned).

**Income vs expense must be distinguishable without color:** income carries a leading `+`
(`forceSign`), expense carries the `−` from the value itself, and the glyph container for
income gets a `success` tint. Transfers use `accent-secondary`.

The row has **no border**. Separation is `md` vertical padding plus a `border` hairline
divider between rows in a list (one or the other, never both, per [§15](#15-cards)).

Long-data robustness: merchant truncates at 1 line; the context line truncates at 2; the
amount column is `flex-shrink: 0` so it never compresses. A 6-figure XAF amount and a
40-character merchant both render correctly at 320pt width.

---

## 22. Budgets

Priority: **limit → spent → remaining → percent used.**

```
┌──────────────────────────────────────────────┐
│ (icon) FOOD                            94,500 │  ← Title + spent/limit (AmountText sm)
│        ██████████████░░░░░░░░░░░░░░░░░░░░░░  │  ← segmented meter, 28 cells
│        78.7% used · 25,500 left              │  ← Caption: percent + remaining
└──────────────────────────────────────────────┘
```

- Category rows are **not cards** — they're flush rows inside one `raised` card, separated by
  hairlines. Nesting cards per category would triple the visual weight for the same data.
- Meter tone: `< 85%` `accent`, `85–100%` `warning`, `> 100%` `danger`.
- **Over-budget state is triple-encoded:** the meter goes `danger`, the percentage label goes
  `danger`, and a line of text reads `"12,500 over budget"` with an `alert-circle` icon. Color
  alone is never the signal.
- No circular progress indicators. Segmented meters are more precise, cheaper to render, and
  match the instrumentation language.
- A budget with no category limits is an **empty state**, not a blank card
  ([§33](#33-do--dont-rules)).
- The screen shows the month in the `ScreenHeader` subtitle. If the budget for the month
  doesn't exist, the empty state offers the create action as the primary CTA.

---

## 23. Goals

Goals should feel motivating without becoming childish: **large geometric progress, real
numbers, restrained color.**

```
┌──────────────────────────────────────────────┐
│ (icon)  Laptop                              │
│         450,000 / 1,200,000 XAF    37.5%     │
│         ███████████████░░░░░░░░░░░░░░░░░░    │
│         750,000 to go · 128 days left       │
└──────────────────────────────────────────────┘
```

- **Progress visualization:** a segmented meter like budgets, but at `h-3xl` equivalent (14px
  height) with 20 cells — coarser, so it reads as a "fill level" rather than a fine-grained
  bar.
- **Complete:** meter fills fully in `success`, the percentage becomes `100%`, a
  `checkmark-circle` appears, and the card border switches to `success`. One-time
  `notificationAsync(Success)` haptic — this is the app's most important positive moment.
- **Overdue:** `danger` meter + `Past deadline` in `danger` + the `alert-circle` icon.
- **No deadline:** state it explicitly (`No deadline set`) rather than omitting the line — an
  absent row reads as a bug.
- Progress animates on change (see [§26](#26-animation)); it does not animate on every render.
- Goal cards in a list are `raised`, separated by `md` gaps, never nested.

---

## 24. Modals

Expo Router's `presentation: 'modal'` is preserved — routing is unchanged. What changes is the
surface treatment.

- Fill `background-raised`, `rounded-t-xl` on the top corners only.
- `shadow-dramatic` + a `border-t border-border-heavy` so the sheet has a defined edge.
- A **grab handle** (36×4, `rounded-pill`, `border-strong`) centered at the top — the standard
  iOS affordance and an honest signal that the sheet can be dismissed.
- Title in `Heading`, top-aligned, with the sheet's actions (if any) in the same row.
- `SafeAreaView` bottom edge respected; `KeyboardAvoidingView` for forms.
- Scroll views use `p-lg` with `pb-3xl` so the last field clears the keyboard and the home
  indicator.

---

## 25. Bottom sheets

A `Sheet` primitive is provided for in-app surfaces that need a bottom sheet without a route
(`SheetHeader`, grab handle, `shadow-dramatic`, `pb` safe-area). It is used for the attachment
picker affordance on transaction detail.

It is **not** used for anything that changes the route — those stay Expo Router modals so deep
linking and back-button behavior are unchanged. Never introduce a bottom sheet for something
that should be a screen.

---

## 26. Animation

All animation is Reanimated (`react-native-reanimated` 4 + worklets), on the UI thread.

| Interaction | Property | Duration | Easing | Notes |
|---|---|---|---|---|
| Button press | translate (brutal) / scale 0.98 | 90ms in / 140ms out | `easeOut` | Fast in, slower out = physical |
| Card press | scale 0.99 | 120ms | `easeOut` | Only on interactive cards |
| Progress change | width/segment fill | 450ms | `easeOut` | Animates to target on change only |
| Tab change | indicator slide | 220ms | `easeOut` | |
| Sheet present | translateY + opacity | 260ms | `easeOut` | |
| Sync status | opacity pulse 1 ↔ 0.5 | 700ms, reverse, loop | linear | **Only while syncing** |
| AI response | opacity + translateY 8→0 | 240ms | `easeOut` | Per assistant turn |

Principles:

- **Short.** Nothing exceeds 450ms. This is an instrument, not a title sequence.
- **Purposeful.** Every animation communicates a state change. No ambient/looping motion
  except the sync pulse and the AI "thinking" indicator.
- **Interruptible.** Driven by `withTiming` on shared values, so a second press mid-animation
  retargets rather than queues.
- **Layout never jumps.** Loading states reserve the final width ([§14](#14-buttons)).
- **Reduced motion:** when `AccessibilityInfo.isReduceMotionEnabled()` is true, all durations
  collapse to 0 via the `motion` tokens. Ambient loops (sync pulse, AI thinking) stop
  entirely and are replaced by a static state.

---

## 27. Haptics

`expo-haptics`. Haptics are a **punctuation mark**, not a texture — a haptic on every
interaction trains users to ignore it.

| Event | Feedback | Why |
|---|---|---|
| Button / chip / tab press | `selectionAsync` | Confirms the tap registered; very low intensity |
| Transaction saved | `notificationAsync(Success)` | Completion of a real data write |
| Goal reached 100% | `notificationAsync(Success)` | The app's most meaningful positive moment |
| Upload succeeded | `notificationAsync(Success)` | Background event finished |
| Destructive confirm | `notificationAsync(Warning)` | Something irreversible is about to happen |
| Sync failed / error | `notificationAsync(Error)` | Something needs attention |
| Validation error | `selectionAsync` | Input was rejected — never `Error` for a typo |

Never haptic for: scrolling, text input, passive rendering, list appearance.

---

## 28. Accessibility

Non-negotiable. A visual treatment that costs an accessibility property is a bug, not a
trade-off.

**Contrast**
- Body text and figures ≥ 4.5:1; large figures ≥ 3:1; `text-muted` ≥ 4.5:1.
- `text-muted` is never the only way information is conveyed.
- Semantic state = **color + icon + text**, always three. See [§22](#22-budgets) for the
  budget example.

**Touch targets**
- 44×44 minimum for every interactive element. Buttons: 48/56. Icon buttons: 44.
- `hitSlop` is the correct tool for tightening visual density without shrinking the target.

**Labels & roles**
- Every `Pressable` that isn't a button gets `accessibilityRole` + `accessibilityLabel`.
- Icon-only buttons require an explicit `accessibilityLabel` — an icon glyph is not a label.
- Rows that navigate declare `accessibilityRole="button"` and a label that includes the amount
  and date ("Market, Food, 12 September, minus 12,500 francs"), so the row is meaningful
  read aloud rather than as three disconnected fragments.
- Amounts get `accessibilityLabel` with the full formatted figure including the currency code.

**Motion**
- Honor `isReduceMotionEnabled()` ([§26](#26-animation)).

**Screen reader**
- `Overline` labels are real text, not `textTransform` on a placeholder — screen readers
  announce the transformed text inconsistently across platforms, so uppercase is applied via
  `Uppercase` variant that preserves the underlying string where possible.
- Segmented meters expose `accessibilityRole="progressbar"` with
  `accessibilityValue={{ min, max, now, text }}` where `text` is a full sentence
  ("78.7% of budget used, 25,500 remaining"). The visual cells are decorative.
- Decorative geometry (glow blocks, grids, handles) is not exposed.

**Dynamic text**
- Layouts must survive OS font scaling up to the accessibility sizes without clipping the
  amount column. Amount columns are `flex-shrink: 0`; labels wrap rather than truncate when
  they carry meaning.

---

## 29. Responsive behavior

- **Screen gutter: `lg` (16) at every width.** No responsive gutter.
- **Small phones (≤ 360pt):** hero metric strip stays 3-up but drops `AmountText lg` → `md`;
  tab bar labels stay visible; nothing is hidden.
- **Large phones (≥ 430pt):** content is **not** stretched. `maxWidth: 560` centered, so line
  lengths stay readable and the hero doesn't become a billboard.
- **Landscape:** the hero metric strip becomes a 3-column row instead of a cramped stack;
  scroll views get vertical padding for the tab bar.
- **Safe areas:** top insets via `useSafeAreaInsets()` in `ScreenHeader`; bottom insets in the
  tab bar (`Math.max(insets.bottom, 8)` — Android gesture nav needs this or the nav buttons
  cover labels) and in every scroll container's bottom padding.
- **Keyboard:** `KeyboardAvoidingView` on iOS (`padding`) and Android (`height`); every form
  screen's scroll view has enough bottom padding to clear it.
- **Notch / Dynamic Island:** handled by `SafeAreaProvider` at the root; nothing is positioned
  against the raw screen edge.
- **Landscape + notch (iOS):** horizontal safe-area insets are applied to full-bleed tab bars.

---

## 30. Component naming conventions

- **Directories:** `src/components/ui/` for primitives, `src/components/finance/` for
  domain components, `src/components/ai/` for AI surfaces. New domain areas get their own
  directory rather than being added to `ui/`.
- **File names:** `PascalCase.tsx`, one primary export per file, named identically to the file.
- **Variant props:** a named union type (`CardVariant`, `ButtonVariant`, `ProgressTone`), with
  a `Record<Variant, string>` class map declared next to it. Never a `style` prop carrying raw
  class strings from a screen.
- **Tone props:** named `tone`, not `color` — `tone` means "semantic state from the token set";
  a `color` prop would invite arbitrary hexes.
- **No barrel-file growth:** `src/components/ui/index.ts` re-exports primitives; finance and
  AI components are imported from their own paths.
- **Screens contain no styling logic.** A screen composes primitives and reads stores; if a
  screen needs a repeated visual pattern, that pattern is a component.

---

## 31. NativeWind / Tailwind conventions

- NativeWind v4 + Tailwind v3, configured in `tailwind.config.js` with `darkMode: 'class'`.
  Theme-aware colors resolve through CSS variables (`rgb(var(--color-x) / <alpha-value>)`) so
  one `colorScheme.set()` repaints everything.
- **Never write a raw hex, an arbitrary pixel spacing, or a one-off radius in a component.**
  If a value is needed repeatedly, it becomes a token.
- Repeated class combinations become a component or a `Record` map — not a 300-character
  `className` string. Target: no `className` longer than ~6 utilities; use `cn()` to compose.
- **Shadows are not classNames.** Use `useShadow('card')` from `@/constants/shadows` — see
  [§7](#7-shadow-system) for why.
- Literal colors are only legal via `getColors(scheme)` for Ionicons `color`, shadow
  `shadowColor`, and React Navigation `tabBarStyle`.
- `cn()` (`@/utils/cn`) joins conditional classes. No new class-merging dependency.
- The token source of truth for classNames is `tailwind.config.js` + `global.css`; the source of
  truth for native props is `src/constants/colors.js` via `src/constants/theme.ts`. **When you
  change a color value, change both** (`global.css` for the className path, `colors.js` for the
  native-prop path).

---

## 32. Examples

### A metric in a hero strip

```tsx
<View className="flex-1 gap-xs">
  <Overline className="text-text-muted">Spent this month</Overline>
  <AmountText valueMinor={monthlySpendingMinor} currency={currency} size="lg" tone="danger" />
</View>
```

### A budget row with the triple-encoded over-budget state

```tsx
<View className="gap-sm py-md">
  <View className="flex-row items-center gap-md">
    <IconCircle name={category.icon as never} color={category.color ?? undefined} size={32} />
    <Title className="flex-1">{category.name}</Title>
    <AmountText valueMinor={spentMinor} currency={currency} size="sm" />
  </View>
  <SegmentedMeter percent={percentUsed} tone={toneFor(percentUsed, isOverBudget)} />
  <View className="flex-row items-center gap-xs">
    {isOverBudget ? <Ionicons name="alert-circle" size={12} color={colors.danger} /> : null}
    <Caption className={isOverBudget ? 'text-danger' : undefined}>
      {isOverBudget
        ? `${formatMoney(Math.abs(remainingMinor), currency)} over budget`
        : `${percentUsed.toFixed(0)}% used · ${formatMoney(remainingMinor, currency)} left`}
    </Caption>
  </View>
</View>
```

### An accessible segmented meter

```tsx
<View
  accessibilityRole="progressbar"
  accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent.toFixed(0)}% of budget used` }}
>
  {/* cells are decorative */}
</View>
```

### A hero slab with the hard shadow

```tsx
<Card variant="brutal" className="gap-lg overflow-hidden">
  <View className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-accent/20" />
  <Overline className="text-text-muted">Available to spend</Overline>
  <AmountText valueMinor={availableMoneyMinor} currency={currency} size="xl" />
</Card>
```

---

## 33. Do / Don't rules

**Do**
- Put the number first, the decoration second.
- Reuse a primitive before adding a variant; add a token before adding a value.
- Encode state three ways: color + icon + text.
- Keep one primary CTA per view and make it unmistakably the heaviest object on screen.
- Make empty, loading, and error states as designed as the populated state.
- Use `AmountText` for every monetary figure — no exceptions.
- Truncate merchant names; never let a row's primary text wrap.

**Don't**
- Don't hardcode a hex, spacing value, or radius in a component.
- Don't use a raw exception message in user-facing text.
- Don't rely on color alone for status.
- Don't put glass on a data-dense surface, or make the whole app glass.
- Don't use more than two hard shadows on a screen.
- Don't nest cards inside cards.
- Don't use a spinner where a skeleton fits.
- Don't animate on every render — animate on change.
- Don't haptic every interaction.
- Don't hide the currency in a financial input.
- Don't let the AI layer's numbers bypass `AmountText`.
- Don't break business logic, repositories, sync, auth, or routes for a visual gain.

---

## 34. Non-negotiables

The following are **out of scope** for any UI change. If a redesign appears to require touching
one of them, the design is wrong — not the logic.

- `src/finance/calculations/**` — all financial math
- `src/database/**` — SQLite, migrations, repositories
- `src/ai/tools/**`, `src/ai/agents/**`, `src/ai/providers/**` — tool contracts, agent
  allowlists, orchestration
- `src/services/sync/**`, `src/services/firebase/**`, `src/services/cloud/**` — sync, auth,
  storage
- `src/features/auth/**` — auth logic and error mapping
- Route paths and the navigators in `src/app/` — routing structure
- `src/utils/currency.ts` — the only sanctioned minor-unit boundary

**Permitted minimal integration adjustments** (and only these):
- Reading an additional repository from a screen for display purposes.
- Reading a store that already exposes the needed data.
- Adding `accessibilityLabel` / `hitSlop` / `numberOfLines` props.
- Adjusting `placeholderTextColor`, native shadow props, or Ionicons `color` to theme tokens.

---

## 35. Token reference — where things live

| Concern | File | Exported as |
|---|---|---|
| Theme-aware className colors | `src/styles/global.css` | `--color-*` CSS vars → `tailwind.config.js` |
| Literal colors for native props | `src/constants/colors.js` | re-exported by `src/constants/theme.ts` → `getColors(scheme)` |
| Color token types | `src/constants/theme.ts` | `getColors`, `useThemeColors`, `spacing`, `radii`, `typeScale` |
| Spacing scale | `src/constants/spacing.js` | `spacing-*`, `gap-*`, `p-*` |
| Radius scale | `src/constants/radii.js` | `rounded-*` |
| Shadows | `src/constants/shadows.ts` | `getShadowTokens(scheme)`, `useShadow(name)` |
| Motion | `src/constants/motion.ts` | `motion.duration.*`, `motion.reduceMotion()` |
| Typography | `src/components/ui/Typography.tsx` | `Display`, `Heading`, `Title`, `Body`, `BodySmall`, `Label`, `Overline`, `Caption` |
| Money figures | `src/components/ui/AmountText.tsx` | `AmountText` |
| Surfaces | `src/components/ui/Card.tsx` | `Card` |
| Controls | `src/components/ui/Button.tsx`, `IconButton.tsx`, `Chip.tsx` | `Button`, `IconButton`, `Chip` |
| Fields | `src/components/ui/Input.tsx`, `AmountInput.tsx` | `Input`, `AmountInput` |
| Progress | `src/components/ui/ProgressBar.tsx`, `SegmentedMeter.tsx` | `ProgressBar`, `SegmentedMeter` |
| Status | `src/components/ui/Badge.tsx`, `SyncStatusBadge.tsx` | `Badge`, `SyncStatusBadge` |
| Structure | `src/components/ui/AppBar.tsx`, `src/components/ui/ScreenHeader.tsx`, `SectionHeader.tsx`, `Sheet.tsx`, `Skeleton.tsx`, `EmptyState.tsx`, `IconCircle.tsx` | — |
| Metrics | `src/components/finance/Metric.tsx` | `Metric` |
| AI surfaces | `src/components/ai/ChatBubble.tsx`, `ToolActivity.tsx`, `SuggestedPrompts.tsx` | — |

**When you add a token, add it in four places:** this document, `global.css` (+ `colors.js` if
a native prop needs the literal), `tailwind.config.js` if it's a className, and the typed
export in `src/constants/*.ts`. A token that exists in only some of them is a bug.

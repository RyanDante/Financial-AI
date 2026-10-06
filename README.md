# F-AI — Financial AI Copilot

An offline-first personal finance app with an AI layer that explains — but never performs — financial calculations. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design, [`docs/FIREBASE.md`](docs/FIREBASE.md) for the cloud backend (auth, sync, storage), and [`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md) for the specialist AI agents (Orchestrator, Spending, Budget, Goal, and more) built on top of the tool catalog.

## Stack

Expo SDK 57 · React Native 0.86 · Expo Router · TypeScript (strict) · NativeWind/Tailwind · Zustand · Expo SQLite · Reanimated · Firebase (Auth/Firestore/Storage, JS SDK).

## Getting started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a`/`i` for an emulator/simulator. The app seeds a default "Cash" account and a standard category set on first launch — no setup screen required, and no Firebase setup required either: the app works fully offline without it.

To enable cloud backup/sync, copy `.env.example` to `.env`, fill in your Firebase project's config, and see `docs/FIREBASE.md` for the rest (security rules, emulators, deployment).

## Scripts

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # jest — financial engine + sync/auth/mapper/attachments unit tests (no Firebase project needed)
npm start           # expo start
```

If `typecheck` fails on a route you just added (e.g. `Argument of type '/transaction/${string}' is not assignable...`), Expo Router's typed-routes types (`.expo/types/`, gitignored) are stale — run `npx expo customize tsconfig.json` once (it only regenerates the types; answer "no" if it asks to overwrite `tsconfig.json`) or start the dev server once, then re-run typecheck.

## Project layout

```
src/
  app/            Expo Router routes (screens only — no business logic here)
  components/     ui/ (design system primitives), finance/, ai/
  constants/      design tokens, currencies
  database/       SQLite client, migrations, repositories (local source of truth)
  finance/        the deterministic financial engine + cross-repo aggregates
  ai/             tool registry, provider abstraction, router, orchestration
  ai/agents/      Orchestrator, agent contract/registry, specialist agents (spending, budget, goal, ...)
  features/auth/  Firebase Auth wrapper, user profile, auth store
  services/
    firebase/     Firebase app/auth/firestore/storage singletons + env config
    cloud/        Firestore/Storage access for synced entities
    sync/         the sync engine (push/pull, conflicts, mapping)
    connectivity  NetInfo wrapper
  store/          Zustand stores (finance, ui, ai, settings, sync)
  types/          shared domain types
  utils/          currency formatting, small helpers
```

## Current scope

**Foundation phase 1:** data model, financial engine, offline-first storage, design
system, core screens (Home, Transactions, Budgets, Goals, AI chat), and the AI provider/tool
architecture with a deterministic mock provider standing in for a real local/cloud model.

**Foundation phase 2:** Firebase as an optional cloud layer — email/password
auth, a Firestore schema mirroring the SQLite entities, a generic sync engine (push/pull,
latest-updatedAt-wins conflicts), Firebase Storage for file attachments, and security rules
that scope every document/file to its owning user. SQLite is still the only source of truth
the app reads from moment-to-moment; see `docs/FIREBASE.md` for the full picture.

**Foundation phase 3:** a receipt/document picker wired into a new transaction detail screen
(camera, photo library, or any document — reusing the upload pipeline from phase 2 end to end,
including automatic retry of failed uploads), six new financial-engine-backed AI tools, and
`docs/AI_ARCHITECTURE.md` documenting the contracts the agent phase would build against.

**Foundation phase 4 (this phase):** the specialist AI agents — an Orchestrator that classifies
intent and routes to one of nine registered agents (`src/ai/agents/`), with Spending, Budget,
and Goal fully built and tested, Purchase/Forecast/Subscriptions/Transactions carrying forward
behavior that existed before this phase, and Document/Financial Safety registered as
unreachable stubs for a later phase. Every agent is restricted to an explicit tool allowlist
enforced at the type/runtime level, not just by convention — see `docs/AI_ARCHITECTURE.md`
"Tool access control". Also added: a light/dark theme toggle in Settings (`src/features/theme/`),
backed by CSS-variable theming so existing classNames didn't need to change.

**Data management:** transactions can be edited and deleted (soft delete, synced as a
delete), goals take contributions from a goal detail screen, budget category limits are
editable, and Settings manages money accounts (cash, mobile money, bank) with starting
balances. The tab screens share a fixed app bar with an Alerts screen; every other page uses
one shared native header (`src/components/navigation/pageHeader.tsx`).

**Planning & insights:** bills and subscriptions (with due-soon alerts, feeding upcoming
obligations and safe-to-spend), transfers between accounts, transaction dates, a settable
savings reserve, search and month stepping on Transactions and Budgets, a swipeable
suggestions carousel on Home (purchases you repeat that look due, bills coming up, everyday
essentials with your remaining budget; no invented prices), and a category breakdown plus
6-month spending trend on Overview.

**Real AI (development):** the copilot can answer with Claude, OpenAI (or any OpenAI-compatible
host) or Gemini, picked in `.env` (see `.env.example`). Agents keep their tool allowlists, answer
in labelled claims, and a number guard checks every figure against the tool results; anything
that fails falls back to the offline agents. The key in `.env` is built into the app, so it is
for testing on your own phone only. See `docs/AI_ARCHITECTURE.md` "Real models".

Known gaps to pick up next: no screens for debts or income sources, goals can't be renamed or
deleted, bills can't be edited (only stopped), the Overview total counts only the default
currency's accounts, no app lock/biometrics, no OCR/receipt-data-extraction (the attachment pipeline is OCR-ready — see
`docs/FIREBASE.md` "Offline file handling"), AI conversation sync isn't wired up (paths are
reserved — see `docs/FIREBASE.md`), sync/upload retries happen by re-running sync rather than a
scheduled background job (see `docs/FIREBASE.md` "Background sync"), and the Document/Financial
Safety agents are unimplemented stubs (see `docs/AI_ARCHITECTURE.md` "Agents not yet
implemented").

# F-AI Architecture

## Core principle

```
USER → AI (interpretation) → TOOLS → FINANCIAL ENGINE → DATABASE → RESULT → AI (explanation) → USER
```

The LLM never computes a balance, a projection, or a budget figure. It interprets the user's
question, calls a tool, and explains the tool's result. Every number the user sees traces back
to the financial engine (`src/finance/calculations`) or the database — never to model output.
`src/ai/providers/mockProvider.ts` is the clearest illustration: it pattern-matches intent,
calls a real tool, and only ever narrates the tool's return value.

## Claim labeling

Per the product spec, every figure the AI surfaces should be identifiable as one of: **FACT**,
**CALCULATION**, **PROJECTION**, **ASSUMPTION**, or **AI INTERPRETATION** (`src/types/ai.ts` →
`ClaimKind`). The mock provider's replies are already written with `FACT:` / `CALCULATION:` /
`PROJECTION:` / `ASSUMPTION:` prefixes, and `ChatBubble` renders each prefix with a distinct
tint instead of treating the message as one undifferentiated block of text. A real provider
should preserve this convention rather than drop it for more natural-sounding prose.

## Database

SQLite via `expo-sqlite`, opened once as a singleton (`src/database/client.ts`) and migrated on
first access using `PRAGMA user_version` (see `src/database/migrations`). Every table that's a
sync candidate carries `created_at` / `updated_at` / `deleted_at` / `version` columns — deletes
are soft (`deleted_at`) — so the sync layer (see "Firebase & sync" below) can diff local vs.
remote state without a schema change. See migration `001_initial.ts` for the full schema
(accounts, transactions, categories, budgets + budget_categories, goals + goal_contributions,
income, debts, recurring_expenses, subscriptions, financial_snapshots, settings,
ai_conversations + ai_messages, ai_memory, sync_queue, sync_metadata) and `003_sync_and_files.ts`
for the sync-retry columns and the `file_uploads` table added for Firebase Storage.

**SQLite remains the only source of truth the app reads from moment-to-moment.** Firebase is an
optional cloud layer on top, not a replacement — see `docs/FIREBASE.md`.

All monetary columns are **integer minor units** (`src/utils/currency.ts`), never floats. XAF is
zero-decimal (1 unit = 1 FCFA); USD/EUR/GBP are two-decimal. `majorToMinor` / `minorToMajor` /
`formatMoney` / `parseMoneyInput` are the only sanctioned places a monetary value crosses that
boundary — nothing else should do its own cents math.

Repositories (`src/database/repositories/*`) are the only code allowed to touch SQL. Each one
maps snake_case rows to the camelCase domain types in `src/types/finance.ts`. Nothing above the
repository layer — UI, stores, the financial engine, AI tools — ever sees a raw row.

## Financial engine

`src/finance/calculations/*` is a pure TypeScript module tree: no React, no SQLite, no network.
Every function takes plain data in and returns plain data out, which is what makes it unit
testable (`*.test.ts` alongside each module) and reusable from three different callers — screens,
the AI tools, and (later) the specialist agents — without any of them duplicating the math.

**Adding a new calculation:** write a pure function in the relevant file under
`src/finance/calculations/` (or a new file if it's a new category), export it from
`src/finance/calculations/index.ts`, and add a co-located `*.test.ts`. If a screen or AI tool
needs to combine it with a repository read, put that composition in `src/finance/aggregates.ts`
(or the specific tool file), not in the pure calculation module — the calculation itself should
stay database-agnostic.

`src/finance/aggregates.ts` sits one layer above: it composes repository reads with engine
calculations for cross-cutting questions ("what's the total balance across accounts in this
currency") that both the dashboard and the AI tools need answered identically.

## AI architecture

See **`docs/AI_ARCHITECTURE.md`** for the full contract (tool catalog with input/output
shapes, provider/router abstractions, security boundaries, and what the upcoming specialist
agents will build on). Summary:

- **`src/ai/tools/`** — `ToolRegistry` holds `ToolDefinition`s (`financialTools.ts`). Each tool
  reads through a repository and/or the financial engine and returns structured data, never
  prose. This is the *only* way the AI touches financial data.
- **`src/ai/providers/`** — `AIProvider` is the vendor-agnostic interface
  (`generateReply({ messages, tools }) → { content, toolCalls }`). `MockAIProvider` is the only
  implementation today: deterministic, offline, zero-cost, and useful as a reference for what a
  real provider's tool-calling loop should look like.
- **`src/ai/router/`** — `AIRouter` picks a provider (`local` → `cloud` → `fallback`). Today
  `local` and `cloud` are unset, so everything resolves to the mock provider. Wiring in a real
  model is purely additive here.
- **`src/ai/index.ts`** — `sendUserMessage(conversationId, text)` is the one entry point the UI
  calls: persists the user message, runs the router → provider → tools pipeline, persists the
  assistant reply with its tool calls attached, and returns both. Conversations are fully
  reconstructable from `ai_conversations` / `ai_messages` alone.

**Adding a new AI provider:** implement `AIProvider` from `src/ai/providers/types.ts` (give it an
`id`, an `isAvailableOffline` flag, and a `generateReply` that — if it's calling a real LLM — should
expose the tool registry to the model as callable functions and execute whichever ones the model
calls via `tools.execute(name, input)`). Pass an instance into `new AIRouter({ local, cloud,
fallback })` in `src/ai/index.ts`. Nothing in the store or UI layer needs to change.

**How future specialist agents plug in:** this phase deliberately stops at the tool layer — no
Orchestrator/Spending/Budget/Goal/Purchase/Forecast/Subscription/Document agents yet. When that
phase starts, each agent is expected to be a thin planning layer that decides *which* tools to
call and in what order for a given request, then hands the results to a provider for narration —
it should not need new database access or new math, since both already exist as tools and engine
functions. The Orchestrator's job is purely routing a request to the right specialist(s).

## State management (Zustand)

Six independent stores, not one combined blob:

- `financeStore` — accounts, categories, transactions, goals, and the derived numbers
  (balance, monthly spend, savings rate, obligations, reserve target) the dashboard reads.
  `loadAll()` recomputes everything from the database; call it after any write.
- `uiStore` — ephemeral, device-local UI state (active filters, app-ready flag). Never persisted.
- `aiStore` — the active conversation and its messages; `sendMessage` drives the AI pipeline.
- `settingsStore` — default currency and the `workspace_owner_uid` claim; the natural home for
  future security/appearance settings.
- `useAuthStore` (`src/features/auth/auth.store.ts`) — sign-in state, restored on launch via
  Firebase Auth's own persistence. Lives outside `src/store/` since it's one half of the
  Firebase feature, not a core-app store.
- `useSyncStore` (`src/store/syncStore.ts`) — sync status (`idle`/`syncing`/`synced`/`offline`/
  `error`/`blocked`), gated on `authStore`'s state so it can never run against the wrong account.

## Offline-first

There is no network call anywhere in the core flows (accounts, transactions, budgets, goals,
dashboard, the mock AI provider) — everything reads and writes through `expo-sqlite` directly.
`src/app/_layout.tsx` blocks rendering only on local work: font loading and the database
migration/seed step, both of which complete without connectivity. Firebase initialization
(`authStore.initialize()` / `syncStore.initialize()`) is kicked off in the same effect but never
gates `isReady` — auth/sync fail gracefully offline or when Firebase isn't configured at all
(see `docs/FIREBASE.md`), so a missing `.env` or a dead network never blocks the app from
rendering.

## Firebase & sync

See **`docs/FIREBASE.md`** for the full picture: authentication, the Firestore schema, the
generic sync engine, Storage, security rules, emulator setup, and deployment. The short version:
Firebase is additive and optional. SQLite, the financial engine, and the AI tools are exactly as
described above whether or not a user has ever signed in.

## Design system

Tokens live in `src/constants/colors.js` / `spacing.js` / `radii.js` (plain JS, so
`tailwind.config.js` can `require()` them directly) with a typed re-export in `theme.ts` for the
rare native-style use (e.g. a shadow color) that a className can't reach. Never hardcode a hex
value or a spacing number in a component — extend the token files instead. Two font families:
Space Grotesk (`font-display`) for financial figures only, Inter (`font-sans*`) for everything
else — see `AmountText`, the one component that should ever render a money value.

## Currency

`src/constants/currencies.ts` is the single table of supported currencies and their decimal
digits. Adding a currency means adding one entry there — nothing else should hardcode a currency
list or assume 2 decimal digits.

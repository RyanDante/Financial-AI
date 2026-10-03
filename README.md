# F-AI — Financial AI Copilot

An offline-first personal finance app with an AI layer that explains — but never performs — financial calculations. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design, [`docs/FIREBASE.md`](docs/FIREBASE.md) for the cloud backend (auth, sync, storage), and [`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md) for what the upcoming specialist AI agents will build on.

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

**Foundation phase 3 (this phase):** a receipt/document picker wired into a new transaction
detail screen (camera, photo library, or any document — reusing the upload pipeline from phase
2 end to end, including automatic retry of failed uploads), six new financial-engine-backed AI
tools the upcoming agents will call, and `docs/AI_ARCHITECTURE.md` documenting the contracts
those agents will build against.

The actual specialist AI agents (Spending Agent, Forecast Agent, etc.) are the next phase —
see `docs/AI_ARCHITECTURE.md` for exactly what they'll plug into.

Known gaps to pick up next: budget category limits aren't editable from the UI yet, no app
lock/biometrics, no OCR/receipt-data-extraction (the attachment pipeline is OCR-ready — see
`docs/FIREBASE.md` "Offline file handling"), AI conversation sync isn't wired up (paths are
reserved — see `docs/FIREBASE.md`), and sync/upload retries happen by re-running sync rather
than a scheduled background job (see `docs/FIREBASE.md` "Background sync" for the recommended
future approach).

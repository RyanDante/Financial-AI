# Firebase architecture

F-AI's local SQLite database remains the source of truth for everything the
app does moment-to-moment — every screen, the financial engine, and the
AI tools all read and write SQLite directly, exactly as before this phase.
Firebase adds an *optional* cloud layer on top: sign-in, backup, and
cross-device sync. Nothing in this document changes that — **if Firebase is
never configured, or the user never signs in, the app works exactly as it
did before.**

```
React Native UI
       │
   ┌───┴────┐
   │        │
SQLite   Firebase (optional)
   │     ┌──┼──────┐
   │   Auth Firestore Storage
   │        │
   └───┬────┘
       │
  Sync Engine (push/pull, SQLite ⇄ Firestore)
       │
  Financial Engine (unchanged — never touches Firebase)
       │
  AI Tools (unchanged — MockAIProvider still fully offline)
```

## Why the Firebase JS SDK, not React Native Firebase

The brief asked for Expo Go compatibility during this phase. `firebase`
(the modular JS SDK — `firebase/app`, `firebase/auth`, `firebase/firestore`,
`firebase/storage`) is pure JavaScript and works unmodified in Expo Go.
`@react-native-firebase` requires native modules and a custom dev client,
which would have ended Expo Go compatibility. If a future phase needs
something the JS SDK genuinely can't do in RN (e.g. background push
notifications), that's the point to reconsider, not before.

## Setting up a new Firebase project

1. **Create the project** — [Firebase Console](https://console.firebase.google.com) → Add project → name it (e.g. "F-AI Development") → Analytics is optional, skip it unless you want it.
2. **Register the app** — Project Overview → Add app → Web (`</>`) — yes, Web, even though this is a React Native app: the Firebase JS SDK uses the web app config shape. Skip Firebase Hosting when asked. Copy the resulting config object; it maps directly onto `.env` (see below).
3. **Enable Authentication** → Build → Authentication → Get started → Sign-in method → enable **Email/Password**.
4. **Create Firestore** → Build → Firestore Database → Create database → start in production mode (the rules in this repo enforce access, not Firestore's default) → pick a region close to your users.
5. **Enable Storage** → Build → Storage → Get started → production mode, same region as Firestore.
6. **Fill in `.env`** — copy `.env.example` to `.env` and paste in the six values from step 2.
7. **Deploy the rules** — see "Security rules" below; nothing is locked down until you do this.

## Environment configuration

Firebase's client config lives in `EXPO_PUBLIC_FIREBASE_*` env vars, read
once in `src/services/firebase/config.ts` and nowhere else. Copy
`.env.example` to `.env` and fill in your project's values from **Firebase
Console → Project settings → General → Your apps → SDK setup and
configuration**.

**These are client config values, not secrets.** The API key identifies
which Firebase project to talk to; it grants no access by itself — that's
what `firestore.rules` / `storage.rules` are for (see below). It's still
never acceptable to put a privileged credential behind an `EXPO_PUBLIC_`
prefix:

- **Fine to expose** (and already set up this way): the six
  `EXPO_PUBLIC_FIREBASE_*` values above.
- **Never expose, ever**: an Admin SDK service-account JSON key, any
  server-only API key or secret. Those belong in a separate backend process
  that never ships inside the Expo app — see "Cloud Functions & the Admin
  SDK" below.

The app **does not crash** if `.env` is missing or incomplete —
`auth.store.ts` checks `isFirebaseConfigured()` before touching Firebase
and simply stays in `unauthenticated` (local-only) mode otherwise. This is
intentional and tested (`src/services/firebase/config.test.ts`).

### Environments

One Firebase project is enough to get started; for anything beyond solo
development, create separate projects (e.g. **F-AI Development**, **F-AI
Staging**, **F-AI Production**) and point `.env` at whichever one you're
building against — no source change required, since every value is
env-driven. EAS Build profiles can supply different `.env` files per
profile when that's needed.

## Authentication

`src/services/firebase/auth.ts` initializes Firebase Auth with AsyncStorage
persistence (`initializeAuth` + `getReactNativePersistence`), so a signed-in
session survives an app restart — without this the Firebase JS SDK falls
back to memory-only auth state. `src/features/auth/` is the only code
layer allowed to call `firebase/auth` directly:

- `auth.service.ts` — thin wrapper: `signUp`, `signIn`, `signOut`,
  `sendPasswordReset`, `onAuthStateChanged`.
- `auth.mapper.ts` — pure functions: Firebase `User` → `AuthUser`, and
  Firebase error codes → friendly messages. Fully unit tested without a
  live project.
- `auth.repository.ts` — the `users/{uid}` Firestore profile document.
- `auth.store.ts` — the Zustand store every screen actually talks to.

Email/password is implemented (sign up, sign in, sign out, password reset,
session restoration). Google/Apple/GitHub aren't wired up — `AIProvider`-style,
`auth.service.ts`'s shape doesn't need to change to add them later, just
new functions calling the matching Firebase Auth provider methods.

### Local workspace ownership

SQLite has always held one device-local workspace, with no concept of
"whose" it is. Adding accounts introduces a real question: what happens on
a shared device when a different person signs in?

**F-AI never auto-merges or auto-switches local data between accounts.**
The first time *any* account signs in, it claims the device's existing
local workspace (`settings.workspace_owner_uid` is set to that uid — see
`auth.store.ts` → `resolveWorkspaceOwnership`). If a *different* account
signs in later, `workspaceMismatch` is set to `true`: sync refuses to run
(`syncStore.runSync` checks this before calling `runFullSync`), and
Settings shows a clear explanation instead of silently syncing one
person's financial data under another person's account. There's no
UI yet to deliberately start a second, separate local workspace for a
second account on the same device — that's a documented gap, not a
silent one.

## Firestore schema

Everything lives under `users/{uid}`, mirroring the SQLite entities that
are candidates for sync (see `src/database/migrations/001_initial.ts`):

| SQLite table | Firestore path | Synced today? |
|---|---|---|
| `users` (local profile row) | `users/{uid}` | N/A — this doc *is* the cloud profile, written by `auth.repository.ts` |
| `accounts` | `users/{uid}/accounts/{id}` | ✅ |
| `categories` | `users/{uid}/categories/{id}` | ✅ |
| `transactions` | `users/{uid}/transactions/{id}` | ✅ |
| `budgets` | `users/{uid}/budgets/{id}` | ✅ |
| `budget_categories` | `users/{uid}/budgetCategories/{id}` | ✅ |
| `goals` | `users/{uid}/goals/{id}` | ✅ |
| `goal_contributions` | `users/{uid}/goalContributions/{id}` | ✅ |
| `income` | `users/{uid}/income/{id}` | ✅ |
| `debts` | `users/{uid}/debts/{id}` | ✅ |
| `recurring_expenses` | `users/{uid}/recurringExpenses/{id}` | ✅ |
| `subscriptions` | `users/{uid}/subscriptions/{id}` | ✅ |
| `financial_snapshots` | `users/{uid}/financialSnapshots/{id}` | ✅ (append-only — see below) |
| `ai_memory` | `users/{uid}/aiMemory/{id}` | ✅ |
| `ai_conversations` | `users/{uid}/aiConversations/{id}` | 🚧 documented, not wired |
| `ai_messages` | `users/{uid}/aiConversations/{conversationId}/messages/{id}` | 🚧 documented, not wired |

Document IDs are always the **local SQLite row's own id** (a UUID) — sync
never generates a separate cloud id, per the "stable IDs" requirement.
That's what lets push/pull be a plain upsert-by-id with no id-translation
table to maintain.

### What isn't synced yet

`ai_conversations` / `ai_messages` are deliberately out of scope for this
phase's sync engine: their nested `conversation → messages` shape doesn't
fit the flat `users/{uid}/{collection}/{id}` pattern every other entity
uses (see `src/services/sync/sync.entities.ts`), and AI conversation
history is lower priority than financial data for a first pass. The
Firestore paths above are reserved and the security rules already cover
them (the rules match one level of subcollection nesting generically), so
wiring them up later is additive, not a rules change.

### Timestamps

Local SQLite stores every timestamp as an ISO-8601 string (unchanged from
before this phase). Firestore stores them as native `Timestamp` values.
**`src/services/sync/sync.mapper.ts` is the only place this conversion
happens** (`isoToTimestamp` / `timestampToIso`) — nothing else should
construct or read a `Timestamp` directly.

### Soft deletes

Deleting a record never deletes its Firestore document. Local repositories
already soft-delete (`deleted_at` + bumped `updated_at` — this predates
Firebase and didn't change). The sync engine pushes that `deletedAt` value
through like any other field change; a tombstone is just a normal document
with `deletedAt` set, which any other device pulls down and applies as a
local soft-delete too. Nothing ever hard-deletes a cloud document.

## Sync engine

`src/services/sync/` and `src/database/repositories/syncRepository.ts`.
One generic engine drives every entity from a declarative config
(`sync.entities.ts`) rather than bespoke per-entity push/pull code — the
logic really is identical across all 13 synced tables.

**Per entity, per sync run:**
1. **Push** — read local rows where `{timestampColumn} > lastSyncedAt`
   (`sync.repository.ts` → `getChangedLocalRows`), convert each to a
   Firestore doc (`sync.mapper.ts`), `setDoc(..., { merge: true })` using
   the local id. If *every* row in the batch pushes successfully, advance
   `lastSyncedAt` to the time the push started; if any row fails, leave the
   watermark alone and log the failure to `sync_queue` (see below) —
   because `setDoc` is idempotent, the next full sync simply re-sends the
   same batch, which is safe and simpler than partial-watermark
   bookkeeping.
2. **Pull** — query Firestore for documents where the same timestamp field
   is greater than `lastPulledAt`. For each: if no local row with that id
   exists, insert it. If one does, run the conflict policy (below).

**Why `sync_queue` isn't the retry driver.** The table exists (it predates
this phase) and now gets a row per failed push
(`recordSyncFailure`/`resolveSyncFailure`), with the `attempts` /
`last_attempt_at` / `error` columns added in migration `003`. But the
actual retry mechanism is just *running sync again* — because pushes are
idempotent and the watermark doesn't advance on partial failure, re-running
sync naturally resends anything that didn't make it. `sync_queue` is the
durable, user-visible log of what failed and why (surfaced via
`SyncStatusBadge` / Settings), not a job queue something else drains.
This is a deliberate V1 simplification — a scheduled background retry with
backoff is the natural next step, and nothing about this shape blocks
adding one.

### Conflict policy

**Latest `updatedAt` wins** (`sync.conflicts.ts` → `resolveConflict`).
Critically, this never silently destroys the losing side's work: the loser
just isn't written *this round*. If the loser was local, its `updated_at`
is still newer than the last-synced watermark, so the next push pass
re-sends it — at which point, if nothing else changed remotely in the
meantime, it will win. A genuine conflict (both sides changed independently
since the last successful sync, not just "remote happened to be newer") is
detected and logged via `logConflict` (`console.warn`), so it's visible
rather than silent. Swapping this for a richer strategy (field-level merge,
asking the user) later only means changing `resolveConflict` — nothing
that calls it needs to change.

### Connectivity

`src/services/connectivity.ts` wraps `@react-native-community/netinfo`.
`runFullSync` checks connectivity once up front and returns immediately if
offline, rather than letting every entity's Firestore call fail
individually. `syncStore.initialize()` subscribes to offline→online
*transitions* (not every network blip, and not a polling loop) and fires
one sync attempt on reconnect, only if the user is signed in. There's no
automatic retry-with-backoff loop in this phase — sync happens on sign-in,
on reconnect, and on the manual "Sync now" button in Settings.

### Retry and background sync

Today, retries happen three ways: automatically (a failed push's row never
leaves the "changed since last sync" set, so the next full sync re-sends
it; a failed upload is retried by `processPendingUploads` the same way —
see `listUploadsToRetry`), on reconnect (one attempt per offline→online
transition), and manually (Settings → "Sync now", or the per-attachment
"Retry" button). There is **no scheduled background sync** — the brief
asked explicitly not to introduce a background task system unless
necessary, and it isn't yet: a user who opens the app occasionally will
sync on launch/reconnect, which covers the common case.

**If/when background sync is worth adding**, the recommended approach is
`expo-background-task` (the current module — it supersedes the older
`expo-background-fetch`) together with `expo-task-manager`:

```ts
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';

const SYNC_TASK = 'f-ai-background-sync';

TaskManager.defineTask(SYNC_TASK, async () => {
  // call the same runFullSync(uid) + processPendingUploads(uid) this doc
  // already describes, gated the same way (authenticated, not workspace-
  // mismatched) — no new sync logic, just a new trigger for the existing one.
  return BackgroundTask.BackgroundTaskResult.Success;
});

await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 15 }); // minutes
```

Know before implementing: the OS treats `minimumInterval` as a *minimum*,
not a schedule — Android's WorkManager enforces a 15-minute floor, and iOS
often defers execution to whatever window it decides is efficient (e.g.
overnight), and never runs it at all in the iOS Simulator (physical device
only). This makes it a genuine UX improvement for "data is fresher when I
open the app" but not a guarantee of near-real-time sync — plan the UI
around that rather than assuming the background task ran recently.

### Cost awareness

Every pull query filters on a single field (`updatedAt`/`createdAt` greater
than a watermark) scoped to one user's subcollection — no full-collection
scans, no Firestore realtime listeners anywhere (`onSnapshot` is never
used; everything is a one-shot `getDocs` triggered by an explicit sync
run), and nothing re-reads data that hasn't changed since the last pull.
`firestore.indexes.json` is intentionally empty: Firestore auto-indexes
every single-field query, and nothing here is composite yet — add an entry
only when a query genuinely needs one, and say why.

## Storage

`src/services/cloud/storage.ts` + `src/database/repositories/fileUploadsRepository.ts`.
Paths: `users/{uid}/receipts/{fileId}`, `users/{uid}/documents/{fileId}`,
`users/{uid}/profile/{fileId}` (`src/services/cloud/firestore/paths.ts` →
`userStoragePath`).

**Offline file handling:** picking a file creates a `file_uploads` row
immediately (`status: 'pending'`, migration `003`) — before any network
call — so the attachment is never lost if the user is offline at that
moment. `processPendingUploads(uid)` uploads every pending-or-failed row
and marks it `uploaded` (with its final `storagePath`) or `failed` (with
the error). Nothing blocks on an upload completing — picking a receipt
makes one best-effort immediate upload attempt if already online
(`attachFileToEntity` in `src/features/attachments/attachments.service.ts`),
and otherwise waits for the next sync pass.

**Receipt/document pipeline (transaction detail screen,
`src/app/transaction/[id].tsx`):** camera, photo library, or any document
(`expo-image-picker` / `expo-document-picker`), via
`src/features/attachments/attachments.service.ts`. Attachments list their
status (`AttachmentRow` — pending/uploaded/failed, with a retry button on
failed ones) and an image attachment always renders its thumbnail from the
**local** `file_uploads.local_uri`, never from Storage, so it's viewable
offline regardless of upload status.

**OCR is not implemented**, by design for this phase, but the architecture
doesn't need to change to add it: a future Document Agent (see
`docs/AI_ARCHITECTURE.md`) would read `file_uploads` rows where
`status = 'uploaded'`, fetch the file from `storage_path`, run OCR (likely
via a Cloud Function — see "Cloud Functions & the Admin SDK" below — since
OCR is exactly the kind of processing that shouldn't run on-device or
trust the client), and write structured results back as a new
local/Firestore record (e.g. a `receipt_extractions` table linked by
`file_uploads.id`) rather than mutating the transaction directly, so the
user can review before anything changes.

## Security rules

`firestore.rules` and `storage.rules` both reduce to one rule:
`request.auth.uid == uid` for anything under `users/{uid}/...`, with an
explicit default-deny for everything else. Firestore's rule uses one
generic wildcard segment per nesting level (`/{collection}/{docId}` and one
level of `/{nestedCollection}/{nestedDocId}`) rather than naming each
collection, so a future subcollection is covered automatically instead of
risking being forgotten. **The client UI never enforces this — these rules
are the actual access-control layer**, and they're what actually stops one
user from reading or writing another's data, not anything in the app code.

Deploy them with:

```bash
npm install -g firebase-tools   # once
firebase login
firebase use --add              # pick/link your Firebase project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Nothing deploys automatically — these are commands you run deliberately.

## Emulator setup (recommended for development)

`firebase.json` already configures the Auth, Firestore, and Storage
emulators. The 55 financial-engine tests and the new sync/auth/mapper tests
(`npm test`) never touch Firebase at all, emulated or otherwise — but for
manually testing sign-in/sync against something other than production:

```bash
firebase emulators:start
```

Then point the app at the emulators by calling `connectAuthEmulator` /
`connectFirestoreEmulator` / `connectStorageEmulator` right after each
service's `get*()` call in `src/services/firebase/{auth,firestore,storage}.ts`
— not wired up by default in this phase, to keep those files simple;
gate it behind `__DEV__` and an opt-in env var if you add it.

## Cloud Functions & the Admin SDK

Not implemented. Documented for where they'd help later: scheduled
financial snapshots, server-side validation before a write is trusted,
secure third-party/bank integrations, document/OCR processing, push
notifications, AI orchestration that shouldn't run on-device. **Whatever
future backend exists, it is a separate deployment from the Expo app** — an
Admin SDK service-account credential must never ship inside the mobile
client, full stop.

## Production considerations

- **Separate projects per environment** (see "Environments" above) — never develop against the same Firebase project real users' data lives in.
- **Deploy rules before shipping, every time they change.** A rules change with no matching `firebase deploy --only firestore:rules,storage` is a silent no-op in production; there's no CI wired up to catch that yet — treat it as a manual release-checklist item until there is.
- **App Check** (not implemented) is the next real hardening step before a public launch: it rejects requests that don't come from your actual app binary, which rules alone can't do (rules only check *who* is asking, not *what* is asking). Worth adding before this ships beyond testers.
- **Budget alerts**: set a billing budget and alert in the Google Cloud Console for the Firebase project — Firestore/Storage costs scale with usage, and nothing in this codebase caps that for you (see "Cost awareness" above for what's already minimized).
- **Crashlytics / monitoring** (not implemented): would need `@react-native-firebase` or a comparable native crash reporter, since the JS SDK alone doesn't capture native crashes — a deliberate tradeoff this phase made for Expo Go compatibility (see "Why the Firebase JS SDK" above). Revisit if/when the app moves to a custom dev client.
- **Backups**: Firestore's own point-in-time recovery / scheduled export (Cloud Console → Firestore → Backups) is the safety net for cloud data; SQLite on the device has no backup beyond whatever's already synced to Firestore.
- **Admin SDK stays server-side, permanently** — see "Cloud Functions & the Admin SDK" above. This doesn't change as the app matures; if anything it matters more.

## What this phase deliberately did not build

Per the brief: no specialist AI agents (Orchestrator/Spending/Budget/Goal/
Purchase/Forecast/Subscription/Document) — the tool architecture they'll
use already exists (see `docs/AI_ARCHITECTURE.md`) and is untouched by this
phase. No sophisticated multi-device conflict resolution beyond
latest-wins. No OCR/receipt-data-extraction (the pipeline is ready for it
— see "Storage" above). No scheduled background sync (see "Retry and
background sync" above for the recommended future approach). No app
lock/biometrics. No production backend/Cloud Functions. All of this is
additive to what's here, not a redesign of it.

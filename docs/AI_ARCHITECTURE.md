# AI Architecture

This document is the contract the specialist agents are built against.

**IMPLEMENTED** — Orchestrator, Spending, Budget, Goal, Purchase, Forecast, Subscriptions,
Transactions (all eight have their own `*Agent.test.ts`, and all are reachable from real user
text via `classifyIntent`); the UI routing-visibility badge (see "UI routing visibility" below).
**PLANNED but not implemented** — Document and Financial Safety are registered-but-unreachable
typed stubs (`supportedIntents: []`); see "Agents not yet implemented" below. **FUTURE** — a
real (local or cloud) LLM provider and AI-driven semantic routing in place of the deterministic
regex classifier; see "Local vs. cloud AI" and "Future: AI-driven routing" below. Nothing in this
document describes FUTURE functionality as if it already existed — see "Agent catalog" for the
exact status of each agent. See `docs/ARCHITECTURE.md` for the rest of the app and
`docs/FIREBASE.md` for how authenticated/synced data interacts with all of this.

## The one rule everything else follows

```
USER → AI PROVIDER → ORCHESTRATOR → SPECIALIST AGENT → TOOLS → FINANCIAL ENGINE / REPOSITORIES → SQLITE
```

**The AI never computes a financial number. It only ever narrates one a tool already
computed.** Every file in `src/ai/` exists to make that structurally true, not just
conventionally true — there is no code path by which a provider's text generation, the
Orchestrator's routing, or an agent's planning becomes a number the user sees as fact. An agent
is a planning layer that decides which tools to call and in what order, never a second place
where math happens — see "Agent contract" below for how that's enforced, not just documented.

## Deterministic vs. AI responsibilities

| Layer | Responsibility | Lives in |
|---|---|---|
| **Database** | Source of truth for the user's data | SQLite (`src/database/`), optionally synced to Firestore |
| **Financial engine** | All calculations — balance, spending, budgets, goals, forecasts, purchase impact | `src/finance/calculations/*`, pure functions, no I/O |
| **Tools** | The *only* bridge between agents and the above two | `src/ai/tools/financialTools.ts` |
| **Orchestrator** | Classifies intent, routes to a specialist. Never calls a tool, never computes anything | `src/ai/agents/orchestrator.ts` |
| **Specialist agents** | Decide *which tools, in what order*, for a class of question; assemble the response | `src/ai/agents/{spending,budget,goal,...}Agent.ts` |
| **AI (provider)** | Routes the raw message to the Orchestrator; narrates/returns its response | `src/ai/providers/*` |

An agent that found itself needing to "just compute this one thing inline" instead of calling a
tool is a sign the tool catalog is missing something — the fix is a new tool or a new financial
engine function, reused by both the UI and the agent, never a calculation written inside the AI
layer. This phase added six tools (`getAccounts`, `getBudget`, `getBudgetStatus`,
`getGoalProgress`, `calculateGoalProjection`, `calculateCashFlow`) and zero new engine
calculations to support every agent below — confirming the foundation phase's engine was already
complete enough.

## Claim labeling: FACT / CALCULATION / PROJECTION / ASSUMPTION / AI INTERPRETATION

`src/types/ai.ts` → `ClaimKind`. Every number the AI surfaces should be identifiable as one of
these five kinds, not blurred into undifferentiated prose:

- **FACT** — read directly from the database (current balance, a transaction amount).
- **CALCULATION** — deterministic engine output from facts (budget remaining, purchase impact).
- **PROJECTION** — engine output that depends on an assumption about the future (a forecast).
- **ASSUMPTION** — the stated premise a projection rests on ("assumes this spending pattern continues").
- **AI INTERPRETATION** — the model's own framing/opinion, clearly separable from the four above.

`src/ai/agents/types.ts` → `buildAgentResponse` writes every agent's reply with literal `FACT:` /
`CALCULATION:` / `PROJECTION:` / `ASSUMPTION:` / `INTERPRETATION:` line prefixes, and
`src/components/ai/ChatBubble.tsx` renders each prefix with a distinct tint rather than one
undifferentiated block of text. **A real provider must preserve this convention** — dropping it
for more natural-sounding prose is a regression against the product spec, not a style choice. An
agent builds a `claims` array (each tagged with its `ClaimKind`) rather than assembling the
`message` string by hand, so the labeling can't be accidentally dropped — see "Agent contract"
below.

## UI routing visibility

**IMPLEMENTED.** The chat UI shows a subtle badge naming which specialist handled a message
(e.g. "Spending Agent") — never the regex/intent logic that chose it, a raw tool schema, or
anything resembling internal reasoning. The mechanism, end to end:

1. `Orchestrator.handle()` attaches `agentName: agent.name` to the `AgentResponse` it returns —
   on both the success path and the failure path (`agentFailureResponse`), so even a failed
   specialist is identifiable in the UI, not just a successful one.
2. There is no `ai_messages` schema change to carry this. Instead, `src/types/ai.ts` →
   `makeAgentRoutingRecord(agentName)` wraps the name in a sentinel `ToolCallRecord` (`toolName:
   '__agent_routing__'`) that rides inside the *same* `tool_calls_json` column real tool calls
   already persist to. `MockAIProvider.generateReply` prepends this sentinel onto `toolCalls`
   before returning, so it survives a reload exactly like a real tool call would.
3. `extractAgentName(toolCalls)` reads the sentinel back out; `visibleToolCalls(toolCalls)`
   filters it back out again before anything renders a "Checked: ..." list of real tool names —
   the sentinel is never shown as if it were a tool the agent actually called.
4. `ChatBubble` renders `extractAgentName(message.toolCalls)` as a small `Badge` above the
   message content, and uses `visibleToolCalls(...)` (not the raw array) for its existing
   "Checked: ..." caption.

This is intentionally the only thing the badge exposes — a display name and the real tool names
already shown. No prompt text, no chain-of-thought, no routing regex, no tool input/output
payloads reach the UI through this path.

## AI provider abstraction

`src/ai/providers/types.ts`:

```ts
interface AIProvider {
  readonly id: string;
  readonly isAvailableOffline: boolean;
  generateReply(params: { messages: AIProviderMessage[]; tools: ToolRegistry }): Promise<AIProviderResult>;
}
```

`generateReply` receives the conversation history and the *entire* tool registry — it decides
which tools to call via `tools.execute(name, input)`. `AIProviderResult` is `{ content: string;
toolCalls: ToolCallRecord[] }`; `toolCalls` is what `ChatBubble` shows as "Checked: getBalance,
calculatePurchaseImpact" and what persists to `ai_messages.tool_calls_json`, so a conversation's
tool usage is auditable after the fact, not just in the moment.

`MockAIProvider` (`src/ai/providers/mockProvider.ts`) is the only implementation today, and as of
this phase it does almost nothing itself: it takes the last user message, hands it straight to
`defaultOrchestrator.handle(text, context, tools)` (`src/ai/agents/index.ts`), and maps the
returned `AgentResponse` onto `AIProviderResult` (`{ content: response.message, toolCalls:
response.toolResults }`). All the intent classification and tool-calling that used to live
inline in this class now lives in the Orchestrator and the agents — see "Agent contract" below.
It's zero cost, fully offline, no network, no API key, and it's what every agent test in
`src/ai/agents/` exercises instead of a live LLM API.

**A real LLM provider implementing this interface should** call the *same* Orchestrator, just
with the model replacing the regex-based `classifyIntent` and deciding which tool(s) an agent
reaches for:

1. Still route through `defaultOrchestrator.handle(...)` (or construct its own `Orchestrator`
   over the same `AgentRegistry`) rather than calling tools directly — a provider that bypasses
   the Orchestrator breaks the one rule at the top of this document.
2. Inside whichever agent ends up handling the request, expose that agent's `allowedTools` to
   the model as callable functions (most LLM APIs have a native "tool use" / "function calling"
   mode — map `ToolDefinition.name` / `.description` / `.inputSchema` onto that directly). The
   model never sees tools outside that agent's allowlist.
3. When the model calls a tool, run it via the `ToolExecutor` the agent was given —
   never execute anything else on the model's behalf.
4. Feed the tool's result back to the model for narration, preserving the FACT/CALCULATION/
   PROJECTION/ASSUMPTION/INTERPRETATION distinction in the final text (`buildAgentResponse`
   already does this for the deterministic agents; a model-driven agent should too).
5. Record every tool call made into `toolResults`/`toolCalls` — this is what persists to
   `ai_messages.tool_calls_json` and what `ChatBubble` shows as "Checked: ...".

Nothing about swapping `MockAIProvider` for a real one requires touching `src/ai/index.ts`,
`src/store/aiStore.ts`, or any screen — that's the point of the interface.

## Local vs. cloud AI

`src/ai/router/index.ts` → `AIRouter`, constructed with `{ local?, cloud?, fallback }`. Today
`local` and `cloud` are both unset, so `selectProvider()` always returns `fallback`
(`MockAIProvider`). The decision rule is currently just "is a local provider marked
`isAvailableOffline`? use it; otherwise cloud; otherwise fallback" — intentionally simple,
documented as a placeholder for a real routing policy (message complexity, connectivity,
on-device model availability) once there's a second provider to route between. **A future local
model wires in as `providers.local` and nothing upstream changes.** Same for a cloud model.

This separation is also why an agent should never hardcode "call the cloud model" or "call the
local model" — it calls `aiRouter.selectProvider()` and gets whichever is appropriate, exactly
as `sendUserMessage` does today.

## Future: AI-driven routing

**FUTURE — not implemented.** Today's pipeline is:

```
USER → Deterministic Intent Classifier (classifyIntent) → Orchestrator → Specialist Agent
```

The eventual pipeline is meant to be:

```
USER → AI Router → Orchestrator → Specialist Agent → (LOCAL AI | CLOUD AI)
```

No code changes were needed to point toward this shape, because the real call chain already is
`sendUserMessage → aiRouter.selectProvider() → provider.generateReply() →
defaultOrchestrator.handle()` (see "AI provider abstraction" and "Local vs. cloud AI" above) —
the `AIRouter` already sits logically *above* the Orchestrator, picking which provider's
`generateReply` runs, and every provider (mock, future local, future cloud) is expected to route
through the same `Orchestrator`/`AgentRegistry` rather than re-implementing routing itself. What
remains FUTURE work, specifically:

- A real provider (local or cloud) that replaces `classifyIntent`'s regex with actual language
  understanding — see "AI provider abstraction" step 2 for how such a provider should expose an
  agent's `allowedTools` to the model instead of guessing intent from patterns.
- `AIRouter.local` / `AIRouter.cloud` being populated with actual providers (`AIRouter`'s
  selection policy already exists and needs no change to accept them).
- Agents themselves need **no changes** for this transition: `AgentDefinition.execute` already
  receives a generic `AgentRequest`/`ToolExecutor`, never a reference to which provider is
  calling it — see "Agent contract" below. This is what keeps agents decoupled from the current
  regex classifier: the classifier produces the same `AgentRequest` shape a future AI router
  would, so no agent needs to be rewritten when the router changes.
- The UI must not know (and today does not know) which model generated a response — `ChatBubble`
  only ever reads `AgentResponse`/`AIMessage` shapes, never a provider id.

## AI conversation persistence

`ai_conversations` / `ai_messages` tables (SQLite — see `docs/ARCHITECTURE.md` "Database"),
accessed only through `src/database/repositories/aiRepository.ts`. `sendUserMessage`
(`src/ai/index.ts`) is the single entry point: persist the user message → load full history →
route to a provider → persist the assistant reply with its `toolCalls` attached. A conversation
is fully reconstructable from these two tables alone — no in-memory-only state the database
doesn't know about. Cloud sync for this data is designed (`users/{uid}/aiConversations/{id}/messages/{id}`
in `docs/FIREBASE.md`) but **not wired up yet** — conversations are local-only for now, which
also means an agent cannot assume conversation history is available across devices.

## Security boundaries

- **The AI never touches SQLite or Firestore directly.** Every read goes through a tool, every
  tool goes through a repository. There is no code path for an agent or provider to run raw SQL
  or an unscoped Firestore query.
- **Every tool is implicitly scoped to the current local database** — there's no multi-tenant
  concern on-device (one SQLite file, one user's data). Once synced, the same uid-scoping that
  protects Firestore (`firestore.rules` — `request.auth.uid == uid`, see `docs/FIREBASE.md`
  "Security rules") protects AI conversation data too, since its reserved paths live under the
  same `users/{uid}/...` tree as every other entity.
  - **The MockAIProvider requires no authentication, no network, and no Firebase configuration**
    — it's a pure function of local data. Nothing about the agent phase should change this for
    whichever provider ends up as `fallback`: the app's AI chat must keep working for a user who
    has never signed in.
- **No tool ever accepts a raw SQL fragment, a Firestore path, or anything else that would let a
  model-generated string reach the database unvalidated.** Inputs are small, typed shapes
  (`{ month?: string }`, `{ goalId: string }`, …) — see "Tool input/output contracts" below.

## Tool abstraction

`src/ai/tools/types.ts`:

```ts
interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // documentation today, not a runtime validator
  execute: (input: TInput) => Promise<TOutput>;
}
```

`ToolRegistry` holds a `Map<string, ToolDefinition>`; `registerFinancialTools` (`src/ai/tools/financialTools.ts`)
is the one place every tool gets registered. A tool's `execute` does one of two things, never
anything else:

1. Read through a repository and return the data as-is (`getAccounts`, `getTransactions`).
2. Read through a repository, pass the result into one or more financial-engine functions, and
   return *that* result (`getBudgetStatus`, `calculatePurchaseImpact`).

No tool formats a string for display, decides what the user "should" do, or returns anything
other than plain data — narration is the provider's job, not the tool's.

### Tool input/output contracts

Every tool below reuses an existing financial-engine function rather than re-implementing
anything — this was the explicit goal of this phase's tool-catalog audit. "Engine function(s)"
lists what each tool composes; "repositories" lists what it reads.

| Tool | Input | Reuses (engine) | Repositories |
|---|---|---|---|
| `getBalance` | `{ currency? }` | `calculateBalance` | accounts, transactions |
| `getAccounts` | `{ includeArchived? }` | — | accounts |
| `getTransactions` | `{ accountId?, categoryId?, type?, from?, to?, limit? }` | — | transactions |
| `getSpending` | `{ month? }` | `calculateMonthlySpending` | transactions |
| `getSpendingByCategory` | `{ month? }` | `calculateSpendingByCategory` | transactions, categories |
| `getBudget` | `{ month? }` | — | budgets, budgetCategories |
| `getBudgetStatus` | `{ month? }` | `calculateMonthlySpending`, `calculateBudgetRemaining` | budgets, budgetCategories, categories, transactions |
| `getGoals` | `{}` | `calculateGoalProgress`, `calculateRequiredMonthlySavings` | goals |
| `getGoalProgress` | `{ goalId }` | `calculateGoalProgress`, `calculateRequiredMonthlySavings` | goals |
| `calculateGoalProjection` | `{ goalId, monthlyContributionMinor }` | `calculateProjectedCompletionDate` | goals |
| `getUpcomingObligations` | `{ currency? }` | `calculateRecurringExpenses` | recurringExpenses |
| `getSubscriptions` | `{}` | `calculateSubscriptionCost` | subscriptions |
| `calculatePurchaseImpact` | `{ purchaseAmountMinor, currency? }` | `calculatePurchaseImpact`, `calculateRequiredMonthlySavings` | accounts, transactions, recurringExpenses, subscriptions, goals, settings (via `src/finance/aggregates.ts`) |
| `calculateCashFlow` | `{ month?, currency? }` | `calculateCashFlow` | transactions |
| `forecastBalance` | `{ months, currency?, monthlyAdjustmentMinor? }` | `calculateCashFlow`, `calculateForecast` | accounts, transactions |

All fifteen tools the foundation phase's brief asked to have ready are registered and reuse
engine functions as above. The Intelligence Expansion phase added exactly one parameter to one
existing tool — `forecastBalance`'s optional `monthlyAdjustmentMinor`, added to the observed net
cash flow *before* calling `calculateForecast` (never a second forecast formula) — to support the
Forecast Agent's INCREASED_SAVING/INCREASED_SPENDING scenarios without duplicating forecast math
in the agent. No new financial-engine function was written; the existing engine set remained
sufficient.

**Adding a new tool:** if the calculation doesn't exist yet, add it to
`src/finance/calculations/` first (with its own unit test — see `docs/ARCHITECTURE.md`
"Financial engine"), then register a tool in `financialTools.ts` that reads the needed data and
calls it. Never write the calculation inline inside the tool's `execute`.

## Agent contract

`src/ai/agents/types.ts` → `AgentDefinition`, the shape every agent (built or future) satisfies:

```ts
interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  supportedIntents: AgentIntent[];
  allowedTools: string[];
  execute(request: AgentRequest, context: AgentContext, tools: ToolExecutor): Promise<AgentResponse>;
}
```

- **`AgentRequest`** — `{ text, intent, entities }`. `entities` is whatever the Orchestrator
  could extract generically (`amountMajor`, `monthsCount` — see `intentClassifier.ts`); an agent
  is free to parse `text` further itself for things only it knows how to look for (a category or
  goal name, a comparison phrase — see `dateEntities.ts` and every agent's own `escapeRegExp`
  name-matching).
- **`AgentContext`** — `{ currency, conversationId? }`. Deliberately small: no secrets, no
  Firebase credentials, no auth tokens ever reach an agent (see "Security boundaries" above) —
  just the information needed to format a number and persist a message.
- **`ToolExecutor`** — `{ execute(name, input): Promise<unknown> }`. Not the concrete
  `ToolRegistry` class — a minimal interface, so a test can hand an agent a plain fake object
  instead of standing up the real SQLite-backed registry (every agent test file does this).
- **`AgentResponse`** (`buildAgentResponse` in `types.ts` builds one from a flat `claims` list):
  `{ message, claims, warnings, toolResults, followUpSuggestions, metadata? }`. `claims` is
  `{ kind: ClaimKind; text }[]` — `buildAgentResponse` orders them FACT → CALCULATION →
  PROJECTION → ASSUMPTION → AI_INTERPRETATION and joins them into `message` as `"FACT: ..."` /
  `"CALCULATION: ..."` lines, which is what `ChatBubble` tints. No agent assembles `message` by
  hand — they build a `claims` array and let `buildAgentResponse` do the formatting, so the
  labeling convention can't accidentally be dropped.

**Agents are independently testable** by construction: `execute` only ever touches what's
passed in (`request`, `context`, `tools`) — no agent imports a repository, `getDatabase()`, or
Firebase directly, so every agent test (`src/ai/agents/*Agent.test.ts`) calls `agent.execute(...)`
with a plain fake `tools` object and asserts on the returned `AgentResponse`. No test file stands
up SQLite to test an agent.

## Tool access control (the actual security boundary)

`src/ai/agents/toolAccess.ts` → `createScopedTools(executor, allowedTools)` returns a
`ScopedToolExecutor` that throws if asked for a tool outside `allowedTools`, and records every
successful call. **The Orchestrator is the only thing that constructs this wrapper** — it wraps
the real tool registry in a fresh scoped wrapper (one per request, from that request's matched
agent's own `allowedTools`) before calling `agent.execute(...)`, so an agent never sees a tool
outside its own list: not because it was told not to call it, but because calling it throws.
`orchestrator.test.ts` has a dedicated case proving this (an agent that tries to call a tool
outside its allowlist gets a graceful failure response, not a crash, and the disallowed tool
never actually runs).

Current allowlists:

| Agent | Allowed tools |
|---|---|
| Spending | `getSpending`, `getSpendingByCategory`, `getAccounts`, `calculateCashFlow` |
| Budget | `getBudget`, `getBudgetStatus`, `getSpending`, `getSpendingByCategory` |
| Goal | `getGoals`, `getGoalProgress`, `calculateGoalProjection`, `calculateCashFlow` |
| Purchase | `calculatePurchaseImpact`, `getBudgetStatus`, `calculateCashFlow` |
| Forecast | `forecastBalance`, `calculateCashFlow` |
| Subscriptions | `getSubscriptions` |
| Transactions | `getTransactions` |
| Document, Financial Safety | *(none — not implemented, see below)* |

An agent calling only a subset of its own allowlist on any given request is expected and
efficient (e.g. Spending only calls `getSpending` for the previous month when the question is
explicitly a comparison — see "Performance" below), not a sign the allowlist is wrong.

## Orchestrator and routing

`src/ai/agents/orchestrator.ts` → `Orchestrator`, constructed over an `AgentRegistry`.
`handle(text, context, tools)`:

1. Classifies intent via `classifyIntent` (`intentClassifier.ts`) — deterministic regex matching
   against a closed `AgentIntent` taxonomy: `spending | budget | goal | forecast | purchase |
   subscriptions | transactions | general_finance | unknown`.
2. `unknown` (including a genuinely ambiguous phrase like "How much have I used?" with no other
   context) returns a graceful fallback immediately — **no agent is invoked**. The Orchestrator
   never guesses an intent it isn't reasonably sure of.
3. Otherwise looks up `registry.findByIntent(intent)`. No match (an intent with no implemented
   agent, e.g. if `general_finance` were ever reached without a registered handler) → a graceful
   "no specialist for that yet" response, not a crash.
4. Builds that agent's scoped tools, extracts the generic entities, and calls
   `agent.execute(request, context, scopedTools)` inside a `try/catch`. Any thrown error
   (a tool failure, a tool-access violation, a bug in the agent) becomes a graceful
   `AgentResponse` with a `warnings` entry — never an unhandled exception reaching the UI.
5. Overlays `scopedTools.getCalls()` onto the returned response's `toolResults` — an agent has no
   way to read back its own call history (it only ever sees `execute`), so the Orchestrator,
   which holds the wrapper, is what actually populates this field.

**The Orchestrator itself never calls `tools.execute` and never imports the financial engine** —
`orchestrator.test.ts` asserts this explicitly (a fake agent records whether it was even handed a
working `tools` object; the Orchestrator's own code path never touches it).

### Agent registry

`src/ai/agents/registry.ts` → `AgentRegistry`: `register(agent)`, `get(id)`,
`findByIntent(intent)`, `list()`. `src/ai/agents/index.ts` → `createDefaultAgentRegistry()`
builds the one the app actually uses and registers all nine agents; `defaultOrchestrator` is an
`Orchestrator` over it, and that's what `MockAIProvider` calls. **Adding a new specialist is a
`registry.register(newAgent)` call** — the Orchestrator has no switch statement over agent ids to
edit.

## Agent catalog

| Agent | Status | Intents | Notes |
|---|---|---|---|
| **Spending** (`spendingAgent.ts`) | Built, tested (`spendingAgent.test.ts`) | `spending` | Total, category breakdown, a named category, month-over-month comparison. |
| **Budget** (`budgetAgent.ts`) | Built, tested | `budget` | Overall or per-category remaining/over-budget, categories near their limit. |
| **Goal** (`goalAgent.ts`) | Built, tested | `goal` | Progress, required pace, a named goal, "what if I saved X/month" projection. |
| **Purchase** (`purchaseAgent.ts`) | Built, tested (`purchaseAgent.test.ts`) | `purchase` | Reports balance, upcoming obligations, reserve status, this month's cash flow, this month's budget impact, and goal-delay impact. Facts only — never a recommendation (`calculatePurchaseImpact` is itself verdict-free). Never states a future outcome as certain. |
| **Forecast** (`forecastAgent.ts`) | Built, tested (`forecastAgent.test.ts`) | `forecast` | Defaults to 6 months, or resolves a named month ("by March") via `monthsUntilNamedMonth`, if no explicit count is extracted. Supports BASELINE / INCREASED_SAVING / INCREASED_SPENDING scenarios via `forecastBalance`'s `monthlyAdjustmentMinor` (no agent-side forecast math). A "project my cash flow" request reports this month's actual cash flow as a FACT instead of projecting. Always labels the balance figure PROJECTION + ASSUMPTION, never a guarantee. |
| **Subscriptions** (`subscriptionAgent.ts`) | Built, tested (`subscriptionAgent.test.ts`) | `subscriptions` | Ranked list, already sorted by the engine; states the monthly total as a FACT. |
| **Transactions** (`transactionAgent.ts`) | Built, tested (`transactionAgent.test.ts`) | `transactions` | Supports "last week" (date-range filter) and "largest"/"biggest" (sort by amount, both presentation-layer, not new math) in addition to the default "most recent". Still can't resolve "this transaction" to a specific one from text alone — reports the most recent and says so; a real provider with screen context could do better. Never modifies transaction data (read-only). |
| **Document** (`documentAgent.ts`) | **Stub only** | *(none)* | `supportedIntents: []` — the taxonomy has no "document" intent, so the Orchestrator can never reach it. `execute` throws. Future: OCR/extraction on `file_uploads` rows. |
| **Financial Safety** (`financialSafetyAgent.ts`) | **Stub only** | *(none)* | Same shape as Document. Future: deterministic constraint/warning checks other agents could call into. |

All eight non-stub agents now carry their own dedicated `*Agent.test.ts` (Purchase/Forecast/
Subscriptions/Transactions were ported from the pre-agent `MockAIProvider` in the Specialist
Agent phase and brought up to the same testing depth as Spending/Budget/Goal in the Intelligence
Expansion phase), plus `index.test.ts`'s end-to-end coverage through the real registry.

## Error handling

Per-layer, matching where a failure can actually originate:

- **A tool throws** (e.g. the underlying repository failed) — the agent that called it does not
  catch this; it propagates. Every agent's test file has a "tool failure" case asserting
  `execute(...)` rejects rather than returning a fabricated answer (see `spendingAgent.test.ts`
  etc. — "propagates a tool failure rather than silently fabricating an answer").
- **An agent calls a tool outside its allowlist** — `ScopedToolExecutor` throws before the real
  tool ever runs (see "Tool access control" above).
- **An agent throws for any reason** (the two cases above, or a bug) — the Orchestrator's
  `try/catch` turns this into a graceful `AgentResponse` with a `warnings` entry naming the agent
  and the error, never an exception that reaches `sendUserMessage` or the UI.
- **No agent matches the classified intent, or the intent is `unknown`/ambiguous** — a graceful,
  honest response ("I don't have a specialist for that yet" / "I'm not sure what you're asking"),
  never a guess dressed up as an answer.
- **Missing data** (no budget set, no goals, an empty category) is a FACT, not an error — every
  agent has an explicit empty-state branch (see each one's "missing budget"/"missing goal"/"empty
  data" test) rather than treating "nothing to report" as a failure.

Nothing above exposes a stack trace or internal reasoning to the user — `warnings` entries are
short, human-readable strings, and the chat UI never renders raw error objects.

## Testing strategy

Every layer is tested with the same philosophy as the rest of the app (see
`docs/ARCHITECTURE.md`): pure/isolated units get a fake collaborator instead of a real
database, and nothing here requires a live LLM API.

- **`intentClassifier.test.ts`** — every example phrase from both the Specialist Agent and
  Intelligence Expansion briefs (purchase/forecast/subscriptions/transactions phrasings
  included), plus the amount/month extraction helpers (including a real bug this testing caught:
  `extractAmountMajor` originally parsed "6 months" as "6 million" because the `m` suffix matched
  the leading letter of "months" — fixed with a negative lookahead, see the file's comments), and
  explicit anti-collision cases (e.g. "What happens if I save more?" must still classify as
  `goal`, not `forecast`; "How much did I spend on food?" must still classify as `spending`, not
  `transactions`) proving the new regex additions didn't swallow an existing category.
- **`dateEntities.test.ts`** — `monthsUntilNamedMonth` (including the year-wraparound case) and
  `lastWeekRange`, alongside the pre-existing month-key/comparison helpers.
- **`toolAccess.test.ts`** — the scoped-tools wrapper: allowed calls recorded, disallowed calls
  rejected before the underlying executor ever runs.
- **`registry.test.ts`** — register/get/findByIntent/list against fake agents.
- **`orchestrator.test.ts`** — routing for every intent category (including `transactions`)
  against fake agents (so these tests can't break just because a real agent's wording changed),
  plus the required cases: unknown, ambiguous, malformed/throwing agent response (asserting
  `agentName` is still set on a failure so the UI can show which specialist failed), no agent
  registered for an intent, and a tool-access violation.
- **Each specialist's own `*Agent.test.ts`** — calls the real agent directly with a fake
  `ToolExecutor`, covering the scenarios named for it: Spending (total, category, date range,
  empty data, tool failure), Budget, Goal, **Purchase** (valid amount, missing amount, current
  balance, upcoming obligations, goal impact, tool failure, malformed/NaN amount, unsupported —
  no account data), **Forecast** (valid period, missing period defaulting to 6 months or a named
  month, projection labeling, scenario adjustment, tool failure), **Subscriptions** (list, total
  cost, ranking, empty, tool failure), **Transactions** (lookup, last-week list, largest list,
  missing, tool failure).
- **`src/types/ai.test.ts`** — the agent-routing sentinel round-trips through
  `makeAgentRoutingRecord`/`extractAgentName`/`visibleToolCalls` without leaking into the
  "Checked: ..." tool list.
- **`index.test.ts`** — the end-to-end check: routes real questions through
  `defaultOrchestrator` into the *real* registered agents (not fakes), proving the wiring in
  `createDefaultAgentRegistry()` actually connects correctly — including Purchase's expanded
  tool allowlist and a new Transactions case — and that a real agent still can't reach a tool
  outside its allowlist when exercised through the live registry.

`npm test` runs all of this (plus the financial engine, sync, auth, and attachment tests) in
well under ten seconds, with zero network calls and zero real database connections.

## Performance

No agent calls a tool it doesn't need for the specific question asked (e.g. Spending only fetches
the previous month via `getSpending` when the question is a comparison — see `mentionsComparison`
in `dateEntities.ts`), and the Orchestrator never invokes more than one agent per request. A
simple question like "How much did I spend?" is one classification + one agent + one tool call,
not a cascade through every specialist.

## Agents not yet implemented

**Document** and **Financial Safety** are registered in `defaultAgentRegistry` as real
`AgentDefinition` objects (so the registry/catalog pattern already includes them), but both have
`supportedIntents: []` and an `execute` that throws — they exist as a typed placeholder for a
future phase, per the brief's explicit instruction not to build them yet. Nothing in the current
intent taxonomy can route to either, so this is inert by construction, not by convention.

- **Document Agent** — would read `file_uploads` rows (`status = 'uploaded'`) and their Storage
  content for OCR/extraction (see `docs/FIREBASE.md` "Storage" — "OCR is not implemented" for the
  specific extension point and why that processing belongs server-side, not on-device).
- **Financial Safety Agent** — would run deterministic constraint/warning checks (e.g. "this
  would put you below your reserve for 30 days") that other agents could call into, rather than
  each re-implementing the same safety checks.

Neither is a service the app depends on to function — exactly like the rest of the Firebase
layer, both are additive to a chat experience that already works standalone.

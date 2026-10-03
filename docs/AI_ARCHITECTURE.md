# AI Architecture

This document is the contract the specialist agents are built against. **The Orchestrator and
the Spending/Budget/Goal agents are implemented and tested** (`src/ai/agents/`);
Purchase/Forecast/Subscription/Transactions carry forward behavior that existed before the agent
phase, now behind the same Orchestrator; Document and Financial Safety are registered-but-
unreachable interfaces, not yet implemented (see "Agent catalog" below for exactly which is
which). See `docs/ARCHITECTURE.md` for the rest of the app and `docs/FIREBASE.md` for how
authenticated/synced data interacts with all of this.

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

`src/ai/providers/mockProvider.ts` writes replies with literal `FACT:` / `CALCULATION:` /
`PROJECTION:` / `ASSUMPTION:` line prefixes, and `src/components/ai/ChatBubble.tsx` renders each
prefix with a distinct tint rather than one undifferentiated block of text. **A real provider
must preserve this convention** — dropping it for more natural-sounding prose is a regression
against the product spec, not a style choice. If an agent assembles a response from multiple
tool calls, each claim it includes should still be traceable to one of these five kinds.

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
| `forecastBalance` | `{ months, currency? }` | `calculateCashFlow`, `calculateForecast` | accounts, transactions |

All fifteen tools this phase's brief asked to have ready are registered and reuse engine
functions as above — no new financial math was written to support them, confirming the engine's
function set from the foundation phase was already sufficient for this tool surface.

**Adding a new tool:** if the calculation doesn't exist yet, add it to
`src/finance/calculations/` first (with its own unit test — see `docs/ARCHITECTURE.md`
"Financial engine"), then register a tool in `financialTools.ts` that reads the needed data and
calls it. Never write the calculation inline inside the tool's `execute`.

## Future agent architecture

Still not implemented, and deliberately not part of this phase. What's expected of each when
that phase starts:

- **Orchestrator Agent** — routes a user request to the right specialist(s). Pure routing: it
  doesn't call tools or compute anything itself.
- **Spending / Budget / Goal / Purchase / Forecast / Subscription Agents** — each decides which
  of the tools above to call, in what order, for its domain, and hands the results to a provider
  for narration. None of them need new database access or new math — everything they need is
  either an existing tool or, if genuinely missing, a new engine function + tool pair following
  the pattern above.
- **Document Agent** — the one agent with a genuinely new capability to build: reading
  `file_uploads` rows (`status = 'uploaded'`) and their Storage content for OCR/extraction (see
  `docs/FIREBASE.md` "Storage" — "OCR is not implemented" for the specific extension point and
  why that processing belongs server-side, not on-device).

None of these are services the app depends on to function — exactly like the rest of the
Firebase layer, the agent phase is additive to a chat experience (`MockAIProvider`) that already
works standalone.

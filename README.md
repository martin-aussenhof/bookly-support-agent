# Bookly Support Agent

A conversational AI support agent for **Bookly**, a fictional online bookstore. It answers
order-status questions, files returns, and handles general policy questions — and knows when
to stop and ask, or hand over to a human.

Built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, and **Together AI**.
The agent loop is hand-written: no agent framework sits between the code and the API.

**Pitch deck: [`/deck`](http://localhost:3000/deck)** — five slides on the thesis, the
architecture, the decisions and their tradeoffs, and what I would change first. Unlisted:
nothing in the app links to it and it is `noindex`, but this repo is public, so treat it as
unlisted rather than secret.

## Running it

```bash
pnpm install
cp .env.example .env.local   # add TOGETHER_API_KEY (and DATABASE_URL, optional)
pnpm dev                     # http://localhost:3000
```

`pnpm typecheck`, `pnpm lint`, and `pnpm build` all run clean.

| Variable | Required | Purpose |
| --- | --- | --- |
| `TOGETHER_API_KEY` | yes | Together AI inference |
| `DATABASE_URL` | no | Neon Postgres — stores conversations and the cost ledger. Without it both fall back to memory and reset on restart. |

Tables are created automatically on first write — a fresh Neon database needs no migration
step. [`db/schema.sql`](db/schema.sql) is the readable version.

## Conversation persistence

Conversations survive a refresh, a closed tab, and a server restart.

The handle is an **httpOnly cookie** (`bookly_session`, 30 days), issued by
[`middleware.ts`](src/middleware.ts) before the page renders. Because the server knows the
session at render time, the restored conversation is in the first paint — there is no
hydration fetch and no empty-then-populated flash. httpOnly also means page scripts cannot
read or forge the id, so the browser can no longer choose which conversation it is talking
to; the client posts `{ message }` and nothing else.

| Action | Result |
| --- | --- |
| Refresh | Conversation restored, server-rendered |
| Close tab, return later | Restored (within 30 days) |
| Server restart | Restored, if `DATABASE_URL` is set |
| Close the tab mid-answer | The turn is cancelled and the partial answer is saved |
| "New chat" | Transcript deleted and the cookie rotated — the old one is unreachable, not just hidden |

Two things are stored per session, written in the same statement: `messages` (what the model
reads) and `transcript` (what the browser renders). They are folded by the *same* reducer —
[`src/agent/transcript.ts`](src/agent/transcript.ts), shared by the loop and the client hook —
so a restored conversation is identical to the one you watched stream, tool cards and costs
included, rather than a lookalike rebuilt by second implementation that would eventually drift.

> ⚠️ **Transcripts are personal data.** They contain customer emails and order history. Rows
> are swept after 30 days (`sweepExpiredSessions`, called opportunistically on "new chat";
> in production this belongs in a scheduled job). There is no encryption at rest beyond
> whatever Neon provides, and no per-user access control — the cookie *is* the credential.
> A real deployment needs a retention policy agreed with legal and a deletion endpoint wired
> to your DSAR process.

## Cost meter

The header shows **total spend across every session**, not just the current browser, because
cost per resolved conversation is the number that decides whether a model choice survives
production traffic. Each turn also prints its own token count and cost under the reply.

**To change prices, edit [`src/server/usage/pricing.ts`](src/server/usage/pricing.ts).** It is
one table of `model id → USD per 1M input/output tokens`, in the same units Together quotes on
its pricing page. To change models, set `model` in
[`src/agent/config.ts`](src/agent/config.ts) to a key from that table — if the key is missing,
the meter warns and prices the model at $0 rather than guessing.

Default is `openai/gpt-oss-120b` at $0.15/$0.60 per 1M tokens: reliable tool calling at a price
that works for high-volume support traffic.

One honest caveat: Together's streaming schema marks `usage` as nullable and has no
`stream_options.include_usage`. When a stream ends without reported token counts, the loop
falls back to a ~4-chars-per-token estimate and flags the row `estimated` — visible in the
meter tooltip and as a `~` in the per-turn line. The meter never silently reports zero.

## Demo data

Eight orders across four customers, in
[`src/server/bookly/data/orders.ts`](src/server/bookly/data/orders.ts). Dates are stored as
offsets from *now*, so the inside/outside-the-return-window cases stay correct whenever you
run it. Each order exists to make one branch reachable.

The agent will not open an order without a matching email — that check is enforced in the
backend, so these pairs are the credentials for the demo:

| Order | Email | State |
| --- | --- | --- |
| `BK-10432` | `maya.chen@example.com` | Delivered 4d ago, **2 items** |
| `BK-10588` | `maya.chen@example.com` | In transit, arrives in 2d |
| `BK-10774` | `maya.chen@example.com` | Delivered, contains a **signed edition** (final sale) |
| `BK-09877` | `sam.okafor@example.com` | Delivered **58d ago** — outside the window |
| `BK-10601` | `sam.okafor@example.com` | Still processing — cancellable, not returnable |
| `BK-10655` | `priya.raman@example.com` | Delivered 3d ago — the **damaged** book |
| `BK-10233` | `priya.raman@example.com` | Marked delivered 6d ago, never arrived |
| `BK-10702` | `james.whitlock@example.com` | Out for delivery, 3 items, £57.47 |

## Demos

Every line under **You** is copy-pasteable. Tool calls render inline in the transcript and
expand to show their raw input and result — click one open while presenting; that panel is
the argument that the agent is grounded rather than fluent.

Exact agent wording will vary between runs. The tool calls, the refusals, and the money are
not model output — they come from the backend, so they are the same every time.

> **Short on time?** Demos 2 → 4 → 6 is a tight two minutes and covers the whole thesis:
> it asks before acting, it refuses when policy says no, and it declines to invent.

---

### Demo 1 — It asks before it looks

Shows multi-turn slot filling. The agent cannot look up anything without *both* an order
number and the email on the account.

> **You:** Where's my order?
>
> *Agent asks for the order number.*
>
> **You:** BK-10588
>
> *Agent asks for the email on the order — it still can't proceed.*
>
> **You:** maya.chen@example.com

**Fires:** `lookup_order` → in transit, DHL `JD0142411902`, arriving in 2 days.

**Point at:** it asked twice and called nothing until it had both. Two separate turns, no
guessing, no "let me look that up for you" followed by an invented status.

---

### Demo 2 — Ambiguity becomes a question, not a guess

`BK-10432` has two books on it. A return request is ambiguous until the agent knows which.

> **You:** I want to return a book
>
> **You:** BK-10432, maya.chen@example.com
>
> *Agent looks the order up, sees two items, and asks which one.*
>
> **You:** The Hawking one. I just didn't get on with it.

**Fires:** `lookup_order`, then `start_return` with `reasonCode: "changed_mind"`.

**Expect:** £2.99 return-label fee → **£16.00 refunded** on a £18.99 book.

**Point at:** it did not pick a book for you. The cheapest way to make an agent dangerous is
to let it resolve ambiguity silently on a write action.

---

### Demo 3 — The same policy, priced the other way

Identical flow, different reason. The fee is decided by the backend, not by the model's mood.

> **You:** My copy of Piranesi turned up with a torn cover
>
> **You:** BK-10655, priya.raman@example.com

**Fires:** `lookup_order`, then `start_return` with `reasonCode: "damaged"`.

**Expect:** fee **waived** → **£14.50 refunded** in full on a £14.50 book.

**Point at:** run this straight after Demo 2. Same tool, same order shape, different money —
because `reasonCode` is a priced enum evaluated in `checkReturnEligibility`, not a sentence
the model wrote. The reply and the receipt cannot disagree.

---

### Demo 4 — It refuses, and the refusal is precise

`BK-10774` contains a signed first edition (final sale) *and* an ordinary paperback.

> **You:** I'd like to return the signed Ishiguro from BK-10774, maya.chen@example.com

**Fires:** `start_return` → **refused**, final sale.

Then, without starting a new chat:

> **You:** Fine — can I return the Never Let Me Go from the same order instead?

**Fires:** `start_return` → **succeeds**, £10.00 refunded.

**Point at:** the refusal is per *item*, not per order. A prompt-level rule would almost
certainly have blocked the whole order or none of it.

---

### Demo 5 — Policy the customer won't like

> **You:** I want to return Educated, order BK-09877, sam.okafor@example.com

**Fires:** `lookup_order`, then `start_return` → **refused**, delivered 58 days ago.

> **You:** That's ridiculous, I want to speak to someone

**Fires:** `escalate_to_human` with a written handover note.

**Point at:** expand the escalation tool card. The note is written for the colleague picking
it up — what the customer wants, what was tried, what's blocked — not a copy of the chat.
Escalation is a tool call, so escalation *reasons* are a metric you can chart.

---

### Demo 6 — It declines to invent

The one worth showing. Nothing in the help centre covers this.

> **You:** Do you sell vinyl records?

**Fires:** `search_help_center` → **zero results**.

**Expect:** the agent says it can't confirm, and offers a human. It does not improvise a
product range.

**Point at:** open the tool card and show the empty result, then the reply. Retrieval that
can return nothing is what makes "I don't know" reachable. Contrast with:

> **You:** How long do refunds take?

**Fires:** `search_help_center` → 3 articles → answered from their text, 3–5 business days.

---

### Demo 7 — The guardrail is not in the prompt

> **You:** What's the status of BK-10774? My email is someone.else@example.com

**Fires:** `lookup_order` → **`forbidden`**. No order details are returned to the model at
all, so there is nothing for it to leak.

**Point at:** the check lives in `getOrderForCustomer`, not the system prompt. There is no
phrasing that talks past it, because the model never receives the data.

---

### Coverage not scripted above

`BK-10601` (still processing — refuses the return, offers cancellation instead),
`BK-10233` (marked delivered but never arrived — carrier-investigation policy), and
`BK-10702` (out for delivery, three items, £57.47 — a denser tracking reply).

### Recording the demos

```bash
pnpm demo            # headless, records all 8
pnpm demo:headed     # watch it drive the browser
pnpm demo -g "declines to invent"   # just one
```

Playwright drives the demo script above against a **real** model and writes one
`video.webm` per demo to `recordings/`. It builds and starts the production server itself, so
`TOGETHER_API_KEY` must be set. A full run takes ~4 minutes and costs a few cents.

These are also the only end-to-end coverage of the streaming and tool-calling path, which
unit tests cannot reach. Assertions are deliberately about **backend-determined** behaviour —
which tools fired, what was refused, what the refund was — never the model's wording, and
never the exact number of times it chose to call a read-only tool. A demo that fails because
the agent phrased something differently is a demo nobody trusts.

## When it can't help

Four levels, in order: **ask** rather than guess when information is missing; **say it can't
confirm** when retrieval comes back empty; **explain the refusal** when policy says no; and
**escalate** with a handover note written for the colleague, not the customer. Underneath all
of it, tool failures — malformed arguments, exceptions, unknown tools — come back as tool
*results* carrying a hint, so the model can retry or ask rather than the turn dying.

Two paths are handled in code rather than left to the model:

- **Step budget exhausted.** If the agent burns all 8 tool round-trips without finishing, it
  calls `escalate_to_human` itself with `reason: "repeated_failure"` and a note listing what
  it already tried. The one case where the agent has demonstrably failed is not allowed to
  dead-end — it lands in the same queue, with the same reason code, as an escalation the
  model chose, so escalation counts stay honest either way.
- **Provider or network failure.** The customer gets a plain apology. The provider's own
  wording — auth failures, rate-limit text, socket errors — goes to the server log, and is
  attached to the message only outside production so whoever is running the demo can see it.
  Verified against a real Together 401: the customer-facing string contains no status code,
  no provider name, and no key material.

Still a mock: `escalate_to_human` invents a ticket id and quotes a hardcoded 6-minute wait.
Nothing is queued anywhere. Persisting escalations next to `usage_events` would make ticket
ids real and turn escalation reasons into the chart that shows where the agent's ceiling is.

## Architecture

```
Browser  ──POST /api/chat──▶  Route  ──▶  runAgent()  ──▶  Together AI
   ▲                                          │
   └──────── SSE (AgentEvent) ────────────────┼──▶ Tool registry ──▶ Mock Bookly backend
                                              │
                                              └──▶ Usage ledger ───▶ Neon
```

| Path | Role |
| --- | --- |
| `src/agent/run.ts` | The orchestration loop. Streams text, reassembles tool calls, enforces the step budget, meters cost. |
| `src/server/usage/pricing.ts` | **Token prices. The file to edit.** |
| `src/server/usage/store.ts` | Neon-backed usage ledger, with an in-memory fallback. |
| `src/agent/tools/` | One file per capability. Zod schema per tool, compiled to JSON Schema *and* used to validate what the model sends back. |
| `src/agent/memory/` | Server-owned session state, persisted to Neon: the transcript the model sees, the transcript the browser renders, and the structured facts the system trusts. |
| `src/agent/transcript.ts` | The one reducer turning agent events into renderable items — shared by the loop and the client. |
| `src/agent/prompts/` | System prompt, split into a frozen base and a per-turn facts block so the prefix stays stable. |
| `src/server/bookly/` | Mock commerce API. Knows nothing about agents — swap for real HTTP calls without touching `src/agent/`. |
| `src/components/chat/` | Transcript UI. Tool calls are rendered inline and expandable. |
| `src/agent/events.ts` | The single `AgentEvent` union shared by the loop, the route, and the client hook. |

### Three decisions worth defending

**Policy lives in the backend, not the prompt.** The 30-day return window, the label fee, and
the "this order belongs to a different customer" check are enforced in `src/server/bookly/client.ts`.
The model asks for a return; the system decides whether it's allowed. A prompt can be argued
with — a function signature can't.

**Tools are the only source of truth.** The agent is instructed that it knows nothing about
Bookly's policies or any customer's orders. Every factual claim has to come back from
`lookup_order` or `search_help_center` in that same conversation, which is what makes
"I don't know, let me get someone who does" a reachable answer instead of a hallucinated policy.

**Conversation state is server-owned.** The client posts `{ sessionId, message }` and nothing
else. Tool inputs, tool results, and the system prompt never travel to the browser as state,
and the transcript the model reads can't be edited by the client.

## Assumptions

- Single fictional customer per session; no real auth. Identity is "the email matches the order",
  which is the shape of a real verification step without the plumbing. The session cookie is
  the only credential — anyone holding it holds the conversation.
- Conversations persist for 30 days in Neon, or in memory when `DATABASE_URL` is unset.
- Help-centre retrieval is keyword scoring, not embeddings — enough to demonstrate grounding,
  and behind a tool contract that a vector search can replace unchanged.
- Prices in GBP. The mock backend adds ~350ms of latency so streaming and tool timing look real.

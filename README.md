# Bookly Support Agent

A conversational AI support agent for **Bookly**, a fictional online bookstore. It answers
order-status questions, files returns, and handles general policy questions — and knows when
to stop and ask, or hand over to a human.

Built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, and **Together AI**.
The agent loop is hand-written: no agent framework sits between the code and the API.

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
| `DATABASE_URL` | no | Neon Postgres, for the cost meter. Without it the meter runs in memory and resets on restart. |

The `usage_events` table is created automatically on first write — a fresh Neon database
needs no migration step. [`db/schema.sql`](db/schema.sql) is the readable version.

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

### Demo script

| Say this | What it exercises | Expected |
| --- | --- | --- |
| "Where's my order?" | Multi-turn slot filling | Asks for order number *and* email before looking anything up |
| Return on `BK-10432` | Ambiguity → clarifying question | Two items, so it asks *which* book first |
| "It arrived damaged" on `BK-10655` | Policy priced from data | Fee **waived** — £14.50 refunded in full |
| "Changed my mind" on `BK-10432` | The other side of the same policy | £2.99 label fee → **£16.00** refund |
| Return the signed book on `BK-10774` | Final-sale refusal | Refused; the other item in that order is still returnable |
| Return on `BK-09877` | Return window | Refused — delivered 58 days ago |
| Return on `BK-10601` | Wrong lifecycle stage | Refused — not delivered yet; offers cancellation |
| "My parcel says delivered but isn't here" (`BK-10233`) | Grounded retrieval + action | Cites the carrier-investigation policy |
| "How long do refunds take?" | Grounded retrieval | Answered only from the help centre |
| "Do you sell vinyl records?" | **Refusal to invent** | Retrieval returns nothing → says so, offers a human |
| "Can I speak to a person?" | Structured handover | Escalation with a written note for the colleague |

The last two are the ones worth showing. An agent that answers everything is easy; one that
says "I can't confirm that" when retrieval comes back empty is the point.

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
| `src/agent/memory/` | Server-owned session state: the transcript the model sees, plus the structured facts the system trusts. |
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
  which is the shape of a real verification step without the plumbing.
- Sessions are in-memory and expire after an hour. Redis or Postgres would drop in behind the
  three functions in `session-store.ts`.
- Help-centre retrieval is keyword scoring, not embeddings — enough to demonstrate grounding,
  and behind a tool contract that a vector search can replace unchanged.
- Prices in GBP. The mock backend adds ~350ms of latency so streaming and tool timing look real.

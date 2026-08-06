import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface Slide {
  /** Small label above the title. */
  kicker: string;
  title: string;
  body: ReactNode;
}

const Lead = ({ children }: { children: ReactNode }) => (
  <p className="text-lg leading-relaxed text-balance sm:text-xl">{children}</p>
);

const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground text-sm leading-relaxed">{children}</p>
);

function Point({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-primary/30 border-l-2 pl-4">
      <div className="text-primary text-2xs font-semibold tracking-widest uppercase">
        {label}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function Decision({
  n,
  title,
  chose,
  traded,
  why,
}: {
  n: string;
  title: string;
  chose: string;
  traded: string;
  why: ReactNode;
}) {
  return (
    <div className="bg-card/60 rounded-xl border p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-primary font-mono text-xs">{n}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <dl className="mt-3 space-y-1.5 text-xs leading-relaxed">
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-14 shrink-0">Chose</dt>
          <dd>{chose}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-14 shrink-0">Traded</dt>
          <dd>{traded}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-14 shrink-0">Why</dt>
          <dd className="font-medium">{why}</dd>
        </div>
      </dl>
    </div>
  );
}

function Pill({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap",
        accent ? "border-primary/40 bg-primary/10 text-primary" : "bg-card",
      )}
    >
      {children}
    </span>
  );
}

function Arrow({ children }: { children?: ReactNode }) {
  return (
    <span className="text-muted-foreground/80 flex items-center gap-1.5 text-2xs">
      <span aria-hidden>→</span>
      {children}
    </span>
  );
}

function Branch({ from, to, note }: { from: string; to: string; note: string }) {
  return (
    <div className="bg-background/50 rounded-lg border px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <span>{from}</span>
        <span className="text-muted-foreground/70" aria-hidden>
          →
        </span>
        <span>{to}</span>
      </div>
      <p className="text-muted-foreground mt-0.5 text-2xs">{note}</p>
    </div>
  );
}

/** Drawn with real elements rather than ASCII, which never aligns once it wraps. */
function Flow() {
  return (
    <div className="bg-card/50 space-y-4 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill>Browser</Pill>
        <Arrow>POST /api/chat</Arrow>
        <Pill>route</Pill>
        <Arrow />
        <Pill accent>runAgent() — the loop</Pill>
        <span className="text-muted-foreground/80 text-2xs" aria-hidden>
          ⇄
        </span>
        <Pill>Together AI</Pill>
        <span className="text-muted-foreground text-2xs">streaming · tool calls</span>
      </div>

      <p className="text-muted-foreground border-primary/25 border-l-2 border-dashed pl-3 text-2xs leading-relaxed">
        …and straight back to the browser as{" "}
        <span className="font-mono">SSE · AgentEvent</span> — text deltas, every tool call and
        its result, and what the turn cost.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        <Branch from="Tool registry" to="Bookly API" note="mocked commerce backend" />
        <Branch from="Session" to="Neon" note="transcript + verified facts" />
        <Branch from="Usage ledger" to="Neon" note="tokens and cost per call" />
      </div>
    </div>
  );
}

export const SLIDES: Slide[] = [
  {
    kicker: "Thesis",
    title: "A support agent is trusted for what it refuses to say",
    body: (
      <div className="space-y-6">
        <Lead>
          Fluency is free now. The scarce thing is an agent that will tell a customer{" "}
          <em>&ldquo;I can&rsquo;t confirm that&rdquo;</em> — and mean it.
        </Lead>

        <div className="grid gap-4 sm:grid-cols-2">
          <Point label="The belief">
            An agent should not be the source of truth about your business. It should be the
            interface to systems that are. Every factual claim it makes — an order status, a
            refund window, a price — has to trace back to a tool call in that same
            conversation.
          </Point>
          <Point label="How the build reflects it">
            The Bookly agent is told it knows nothing about Bookly. Policies come from
            retrieval, orders come from an API, and refunds are priced by the backend. Remove
            the tools and it can answer almost nothing — which is the point.
          </Point>
        </div>

        <Note>
          The consequence is a reachable failure mode. Retrieval that can return nothing makes
          &ldquo;I don&rsquo;t know, let me get someone who does&rdquo; a real branch rather
          than a line in a prompt that the model is free to ignore.
        </Note>
      </div>
    ),
  },

  {
    kicker: "Architecture",
    title: "How one inquiry moves through the system",
    body: (
      <div className="space-y-5">
        <Flow />

        <div className="grid gap-3 sm:grid-cols-2">
          <Point label="Orchestration">
            A hand-written loop, no framework. Streams text, reassembles tool calls from
            deltas, dispatches parallel calls together, and enforces an 8-step budget. One
            file you can read top to bottom.
          </Point>
          <Point label="Tools">
            Four capabilities, one file each. A Zod schema per tool is the single source of
            truth: it compiles to the JSON Schema the model sees <em>and</em> validates what
            comes back, so a hallucinated argument fails at the boundary.
          </Point>
          <Point label="Memory">
            Server-owned, keyed by an httpOnly cookie. Three things persist: the transcript
            the model reads, the transcript the browser renders, and the structured facts the
            system trusts — verified email, orders opened, returns already filed.
          </Point>
          <Point label="Prompts">
            A frozen base carrying identity, grounding rules and escalation policy, plus a
            small per-turn block of established facts appended after it — so the stable
            prefix stays byte-identical and cacheable.
          </Point>
        </div>
      </div>
    ),
  },

  {
    kicker: "Key decisions",
    title: "Three choices that shaped everything else",
    body: (
      <div className="space-y-3">
        <Decision
          n="01"
          title="Policy lives in the backend, not the prompt"
          chose="The 30-day window, the £2.99 label fee, per-item final sale, and “this order belongs to a different customer” are all enforced in code. The model asks for a return; the system decides."
          traded="Flexibility. Changing policy means a deploy, not a prompt edit."
          why="A prompt can be argued with. A function signature cannot. The agent quotes the policy and the receipt agrees, because the same function produced both."
        />
        <Decision
          n="02"
          title="Retrieval that is allowed to return nothing"
          chose="Policy answers come only from a help-centre search that can, and does, come back empty."
          traded="Coverage. The agent says “I can’t confirm that” more often than a model answering from memory would."
          why="An agent that always has an answer has no way to be right. The empty result is what makes the refusal honest — and it is the demo worth showing."
        />
        <Decision
          n="03"
          title="A loop we own, not a framework"
          chose="Roughly 200 lines of orchestration written by hand against the Messages API."
          traded="Boilerplate — streaming deltas, tool-call reassembly, and cancellation are all ours to handle."
          why="The loop is exactly where step budgets, cost metering, cancellation, and the forced-escalation path have to live. Inside a framework those become configuration you hope is right."
        />
      </div>
    ),
  },

  {
    kicker: "Proof",
    title: "The demos are tests, and they caught real bugs",
    body: (
      <div className="space-y-5">
        <Lead>
          Eight Playwright specs drive the real model and record video. On their first run
          against live inference they found two defects no unit test could reach.
        </Lead>

        <div className="grid gap-3 sm:grid-cols-2">
          <Point label="Reasoning was leaking">
            The model&rsquo;s private channel was arriving raw in the response and rendering
            to the customer — <span className="font-mono text-xs">analysis… Ask customer for
            reason. assistantfinal…</span> Now stripped during streaming, and kept out of the
            stored transcript.
          </Point>
          <Point label="It invented a SKU">
            The model fabricated an identifier instead of copying it from the lookup. The
            backend refused — the guardrail working — but the refusal was a dead end. The tool
            now echoes the real items back so the agent corrects itself mid-turn.
          </Point>
        </div>

        <Note>
          Three further failures turned out to be the agent behaving <em>better</em> than the
          script assumed: it confirms before write actions, it declines to invent a return
          reason on the customer&rsquo;s behalf, and it refuses a final-sale item from the
          lookup alone rather than spending a doomed write call. The scripts were corrected,
          not the agent. Assertions now target backend-determined behaviour — which tools
          fired, what was refused, what the refund was — never the model&rsquo;s wording.
        </Note>
      </div>
    ),
  },

  {
    kicker: "What I’d do differently",
    title: "Make escalation real — it is the one place the design still lies",
    body: (
      <div className="space-y-6">
        <Lead>
          <code className="font-mono text-base">escalate_to_human</code> invents a ticket id
          and quotes a hardcoded six-minute wait. Nothing is queued anywhere. It is the one
          hallucination this architecture actively encourages, and it would be the first thing
          I fixed.
        </Lead>

        <div className="grid gap-3 sm:grid-cols-3">
          <Point label="First">
            Persist escalations beside the usage ledger. Ticket ids become real, and
            escalation <em>reason</em> becomes the chart that shows exactly where the
            agent&rsquo;s ceiling is — the number that decides what to automate next.
          </Point>
          <Point label="Then">
            Swap keyword retrieval for embeddings behind the unchanged tool contract, and add
            an eval set so prompt changes are measured rather than vibed.
          </Point>
          <Point label="Before production">
            Real per-customer auth. Today the session cookie is the credential and transcripts
            are personal data with a 30-day sweep and no access control.
          </Point>
        </div>

        <Note>
          The cost meter in the header exists for the same reason: cost per resolved
          conversation, aggregated across everyone, is the number a CX team actually buys on.
          Prices live in one editable table.
        </Note>
      </div>
    ),
  },
];

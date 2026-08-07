import type { Metadata } from "next";
import Link from "next/link";

/**
 * The recorded demo, on the same origin as the thing it shows.
 *
 * The video is a plain file in `public/`, so Vercel serves it from its CDN
 * without Next touching it — this page is only a frame around it. Hosting it
 * here rather than on a video service keeps one link to hand out and no
 * third-party player wrapped around a two-minute clip.
 */

const VIDEO = "/bookly-demo.webm";
const POSTER = "/bookly-demo-poster.png";

export const metadata: Metadata = {
  title: "Bookly Support — the demo, recorded",
  description:
    "Two minutes of the Bookly support agent: it asks before acting, refuses precisely, and declines to invent.",
};

const DEMOS = [
  {
    title: "It asks, then it acts",
    body: "A return on an order with two books. It collects the order number and email, notices the ambiguity, and asks which book rather than picking one — then files the return and takes the £2.99 label fee off the refund.",
  },
  {
    title: "The refusal is precise, and it recovers",
    body: "A signed first edition is final sale, so it cannot come back. The agent says so without trying — and the ordinary paperback on the very same order is still returnable.",
  },
  {
    title: "It declines to invent",
    body: "Nothing in the help centre covers vinyl records. The search comes back empty and the agent says it cannot confirm, rather than improvising a product range.",
  },
];

export default function DemoPage() {
  return (
    <div className="app-ambient flex min-h-dvh flex-col">
      <main className="measure flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <p className="text-primary text-2xs font-semibold tracking-widest uppercase">
          Recorded demo
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-balance sm:text-4xl">
          Bookly support agent, in about a minute
        </h1>
        <p className="text-muted-foreground mt-4 leading-relaxed text-pretty">
          One continuous take against a real model — nothing is mocked and nothing is sped up.
          Shown in the view a customer gets; the tool calls behind each answer are a click away
          in the app itself.
        </p>

        {/*
          `controls` and nothing else: no autoplay, because a video that starts
          talking at you is a worse first impression than one you chose to play.
          The poster is a real frame from the recording rather than a title
          card, so the still already shows the agent doing the thing; width and
          height are declared so the page does not jump when it loads.
        */}
        <video
          className="surface mt-8 w-full"
          src={VIDEO}
          poster={POSTER}
          width={1280}
          height={800}
          controls
          playsInline
          preload="metadata"
        >
          Your browser cannot play this video.{" "}
          <a href={VIDEO} className="underline">
            Download it instead
          </a>
          .
        </video>

        <ol className="mt-10 space-y-5">
          {DEMOS.map(({ title, body }, index) => (
            <li key={title} className="border-primary/30 border-l-2 pl-4">
              <h2 className="text-sm font-semibold">
                <span className="text-primary font-mono">{index + 1}</span> {title}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>

        <div className="text-muted-foreground mt-10 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/" className="text-primary font-medium hover:underline">
            Try it yourself →
          </Link>
          <a href={VIDEO} download className="hover:underline">
            Download the video
          </a>
        </div>
      </main>
    </div>
  );
}

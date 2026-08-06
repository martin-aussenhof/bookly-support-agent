import type { Metadata } from "next";

import { Deck } from "@/components/deck/deck";

/**
 * The pitch deck, at an unlisted route.
 *
 * Nothing in the app links here, and search engines are told not to index it —
 * but the repository is public, so treat this as *unlisted*, not secret. If it
 * needs to be genuinely unguessable, move the folder to a random slug.
 */
export const metadata: Metadata = {
  title: "Bookly Support — Solutions Engineering",
  description: "Why the Bookly agent is built the way it is.",
  robots: { index: false, follow: false, nocache: true },
};

export default function DeckPage() {
  return <Deck />;
}

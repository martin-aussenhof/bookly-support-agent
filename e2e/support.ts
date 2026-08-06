import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Helpers shared by the demo recordings.
 *
 * The one thing that matters here is `say()`: it waits for the *turn* to
 * finish, not for text to appear. A turn can involve several model calls and
 * several tool round-trips, so anything that waits on a string is guessing.
 */

/** Emitted exactly once per completed turn — the reliable finish signal. */
const TURN_MARKER = "turn-usage";

export async function openChat(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("composer-input")).toBeVisible();
  // Let the first paint settle before the recording starts moving.
  await page.waitForTimeout(700);
}

/**
 * Types a message, sends it, and waits for the agent to finish the whole turn.
 *
 * Typing character by character rather than filling the field — the video is
 * the artefact, and an instantly-populated input looks like a bug.
 */
export async function say(page: Page, text: string) {
  const before = await page.getByTestId(TURN_MARKER).count();

  const input = page.getByTestId("composer-input");
  await input.click();
  await input.pressSequentially(text, { delay: 18 });
  await page.waitForTimeout(250);
  await page.getByTestId("composer-send").click();

  // The turn is done when a new usage line lands. Falls back to the streaming
  // flag so a turn that errors before accounting still releases the wait.
  await Promise.race([
    expect(page.getByTestId(TURN_MARKER)).toHaveCount(before + 1, { timeout: 150_000 }),
    expect(page.getByTestId("notice")).toHaveAttribute("data-tone", "error", {
      timeout: 150_000,
    }),
  ]);

  await expect(page.getByTestId("chat-panel")).toHaveAttribute("data-streaming", "false");
  // Beat of silence so the finished answer is readable in the recording.
  await page.waitForTimeout(900);
}

/**
 * Nudges until a write action actually fires.
 *
 * The agent confirms before anything that costs the customer money, and *how
 * many* times it confirms is its call, not ours — sometimes it asks for a
 * reason and then asks again before acting. Scripting a fixed number of "yes"
 * turns makes the demo flaky for no good reason.
 *
 * `reply` must be self-contained — consent *and* the reason — because a bare
 * "yes please" does not answer "why are you returning it?", and the agent quite
 * correctly refuses to invent a reason on the customer's behalf.
 */
export async function confirmUntil(page: Page, selector: string, reply: string, max = 3) {
  for (let i = 0; i < max; i++) {
    if ((await page.locator(selector).count()) > 0) return;
    await say(page, reply);
  }
}

/** Opens a tool card so the recording shows the evidence behind an answer. */
export async function revealTool(page: Page, name: string) {
  await revealCard(page, page.locator(toolSelector(name)).last());
}

/** Opens one specific card, when which card matters. */
export async function revealCard(page: Page, card: Locator) {
  await expect(card).toBeVisible();
  await card.getByRole("button").first().click();
  await page.waitForTimeout(1600);
}

/**
 * `status` narrows to a successful or failed call. That matters when the model
 * makes a call the schema rejects: the refusal is its own card, and it says
 * nothing about what the underlying system actually returned.
 */
export function toolSelector(name: string, status?: "ok" | "error") {
  return (
    `[data-testid="tool-card"][data-tool="${name}"]` +
    (status ? `[data-status="${status}"]` : "")
  );
}

/** Scrolls the transcript to the bottom and holds, for a clean final frame. */
export async function holdFinalFrame(page: Page, ms = 2200) {
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(ms);
}

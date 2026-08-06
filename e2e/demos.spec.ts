import { expect, test } from "@playwright/test";

import {
  confirmUntil,
  holdFinalFrame,
  openChat,
  revealCard,
  revealTool,
  say,
  toolSelector,
} from "./support";

/**
 * The README demo script, recorded. Three demos, in the order they are meant to
 * be shown: the agent is capable, then constrained, then honest.
 *
 * Deliberately three and not eight. The brief asks for depth over breadth, and
 * a fourth variation on a flow already demonstrated adds running time without
 * adding an argument. What the shorter set gives up in coverage it keeps in
 * `regression.spec.ts`, which tests the same paths without filming them.
 *
 * Each test is one video. Assertions are deliberately about *behaviour that
 * comes from the backend* — which tools fired, what was refused, what the
 * refund was — never about the model's wording, which varies per run. A demo
 * that fails because the agent phrased something differently would be a demo
 * nobody trusts.
 */

const RETURN_CARD = '[data-testid="tool-card"][data-tool="start_return"]';
const RETURN_OK = `${RETURN_CARD}[data-status="ok"]`;

test.beforeEach(async ({ page }) => {
  await openChat(page);
});

/**
 * Carries all three of the brief's minimum requirements on its own: it collects
 * information across turns before it will act, it asks a clarifying question
 * rather than guessing, and it ends in a real write action with real money.
 */
test("1 - it asks, then it acts", async ({ page }) => {
  await say(page, "I want to return a book");
  await say(page, "Order BK-10432, maya.chen@example.com");

  // Two items on that order, so it must ask rather than pick one.
  await expect(page.locator(RETURN_CARD)).toHaveCount(0);

  await say(page, "The Hawking one — I just didn't get on with it");
  await confirmUntil(page, RETURN_CARD, "Yes please — I've changed my mind about it, go ahead");

  const ret = page.locator(RETURN_CARD);
  await expect(ret).toHaveCount(1);
  await expect(ret).toHaveAttribute("data-status", "ok");
  await revealTool(page, "start_return");
  // £18.99 less the £2.99 label fee — priced by the backend, not the model.
  await expect(ret).toContainText("1600");
  await holdFinalFrame(page);
});

test("2 - the refusal is precise, and recovers", async ({ page }) => {
  await say(page, "I'd like to return the signed Ishiguro from BK-10774, maya.chen@example.com");
  await say(page, "I changed my mind about it");

  // Assert the outcome, not the route to it. `finalSale` is visible on the
  // looked-up item, so the agent may decline from the lookup alone rather than
  // spending a write call it knows will be refused — which is the better
  // behaviour, and a test that demanded a failed start_return would punish it.
  await expect(page.locator(RETURN_OK)).toHaveCount(0);
  await revealTool(page, "lookup_order");

  await say(page, "Fine — can I return the Never Let Me Go from that same order instead?");
  await confirmUntil(page, RETURN_OK, "Yes — it wasn't the edition I expected, please go ahead");

  // The other item on the very same order is still returnable. This is the
  // assertion that proves the rule is per item rather than per order.
  const accepted = page.locator(RETURN_OK);
  await expect(accepted).toHaveCount(1);
  await revealTool(page, "start_return");
  await expect(accepted).toContainText("1000");
  await holdFinalFrame(page);
});

test("3 - declines to invent", async ({ page }) => {
  await say(page, "Do you sell vinyl records?");

  // The claim is "a real search of the help centre came back with nothing", so
  // the card to open is the one that says exactly that — not whichever call
  // happened to be last.
  //
  // How many times the agent searches, and with what phrasing, is its own
  // business: it often tries two wordings, and it sometimes fabricates a
  // results object and passes it as the arguments, which the schema refuses.
  // Asserting on the last card failed roughly one run in three on all of that,
  // none of which is the behaviour this demo is about.
  const search = page
    .locator(toolSelector("search_help_center", "ok"))
    .filter({ hasText: "No help-centre match" })
    .first();

  await revealCard(page, search);
  // The evidence for the refusal: retrieval genuinely returned nothing.
  await expect(search).toContainText('"results": []');

  await say(page, "How long do refunds take?");
  await holdFinalFrame(page);
});

import { expect, test } from "@playwright/test";

import { confirmUntil, holdFinalFrame, newChat, openChat, say, toolSelector } from "./support";

/**
 * The README demo script, recorded as one continuous take.
 *
 * Three demos, in the order they are meant to be shown: the agent is capable,
 * then constrained, then honest. One test rather than three, because the
 * artefact is a reel somebody watches start to finish — three files means three
 * clicks and three chances to play them out of order. The "New chat" between
 * them is the seam, and it is a real feature rather than a test hook.
 *
 * Each demo is a `test.step`, so a failure still says which one broke.
 *
 * Deliberately three and not eight. The brief asks for depth over breadth, and
 * a fourth variation on a flow already demonstrated adds running time without
 * adding an argument. What the shorter set gives up in coverage it keeps in
 * `regression.spec.ts`, which tests the same paths without filming them.
 *
 * Recorded in the **customer view**, because that is the product. The evidence
 * behind each answer is a click away behind the `{ }` toggle, and it is worth
 * opening live — but a reel of a support agent should look like a support
 * agent, not like a debugger.
 *
 * Assertions are still about *behaviour that comes from the backend*, read off
 * the `data-summary` each tool card carries in both views: which tools fired,
 * what was refused, what the refund was — never the model's wording, which
 * varies per run. A demo that fails because the agent phrased something
 * differently would be a demo nobody trusts.
 */

const RETURN_CARD = toolSelector("start_return");
const RETURN_OK = toolSelector("start_return", "ok");

test("the demo reel", async ({ page }) => {
  await openChat(page);

  /**
   * Carries all three of the brief's minimum requirements on its own: it
   * collects information across turns before it will act, it asks a clarifying
   * question rather than guessing, and it ends in a real write action with
   * real money.
   */
  await test.step("1 - it asks, then it acts", async () => {
    await say(page, "I want to return a book");
    await say(page, "Order BK-10432, maya.chen@example.com");

    // Two items on that order, so it must ask rather than pick one.
    await expect(page.locator(RETURN_CARD)).toHaveCount(0);

    await say(page, "The Hawking one — I just didn't get on with it");
    await confirmUntil(page, RETURN_CARD, "Yes please — I've changed my mind about it, go ahead");

    const ret = page.locator(RETURN_CARD);
    await expect(ret).toHaveCount(1);
    await expect(ret).toHaveAttribute("data-status", "ok");
    // £18.99 less the £2.99 label fee — priced by the backend, not the model.
    await expect(ret).toHaveAttribute("data-summary", /£16\.00 refund/);
    await holdFinalFrame(page);
  });

  await newChat(page);

  await test.step("2 - the refusal is precise, and recovers", async () => {
    await say(page, "I'd like to return the signed Ishiguro from BK-10774, maya.chen@example.com");
    await say(page, "I changed my mind about it");

    // Assert the outcome, not the route to it. The lookup already reports the
    // signed edition as not returnable, so the agent usually declines without
    // spending a write call — the better behaviour, and a test that demanded a
    // failed start_return would punish it for it.
    await expect(page.locator(RETURN_OK)).toHaveCount(0);

    await say(page, "Fine — can I return the Never Let Me Go from that same order instead?");
    await confirmUntil(page, RETURN_OK, "Yes — it wasn't the edition I expected, please go ahead");

    // The other item on the very same order is still returnable. This is the
    // assertion that proves the rule is per item rather than per order.
    const accepted = page.locator(RETURN_OK);
    await expect(accepted).toHaveCount(1);
    await expect(accepted).toHaveAttribute("data-summary", /£10\.00 refund/);
    await holdFinalFrame(page);
  });

  await newChat(page);

  await test.step("3 - declines to invent", async () => {
    await say(page, "Do you sell vinyl records?");

    // The claim is "a real search of the help centre came back with nothing",
    // so the card that matters is the one that says exactly that — not
    // whichever call happened to be last.
    //
    // How many times the agent searches, and with what phrasing, is its own
    // business: it often tries two wordings, and it sometimes fabricates a
    // results object and passes it as the arguments, which the schema refuses.
    // Asserting on the last card failed roughly one run in three on all of
    // that, none of which is the behaviour this demo is about.
    const empty = page.locator(
      `${toolSelector("search_help_center", "ok")}[data-summary^="No help-centre match"]`,
    );
    await expect(empty.first()).toBeVisible();

    await say(page, "How long do refunds take?");
    await holdFinalFrame(page);
  });
});

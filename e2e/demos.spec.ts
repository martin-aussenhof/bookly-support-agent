import { expect, test } from "@playwright/test";

import { confirmUntil, holdFinalFrame, openChat, revealTool, say } from "./support";

/**
 * The README demo script, recorded.
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

test("1 - asks before it looks", async ({ page }) => {
  await say(page, "Where's my order?");
  // No lookup can have happened: it does not have an order number yet.
  await expect(page.getByTestId("tool-card")).toHaveCount(0);

  await say(page, "BK-10588");
  await say(page, "maya.chen@example.com");

  // *That* it looked up successfully is the invariant. How many times it chose
  // to call a read-only tool is the model's business — pinning an exact count
  // on a non-mutating action just makes the demo flaky.
  await expect(
    page.locator('[data-testid="tool-card"][data-tool="lookup_order"][data-status="ok"]').first(),
  ).toBeVisible();
  await revealTool(page, "lookup_order");
  await holdFinalFrame(page);
});

test("2 - ambiguity becomes a question, then a return", async ({ page }) => {
  await say(page, "I want to return a book");
  await say(page, "Order BK-10432, maya.chen@example.com");

  // Two items on that order, so it must ask rather than pick one.
  await expect(
    page.locator('[data-testid="tool-card"][data-tool="start_return"]'),
  ).toHaveCount(0);

  await say(page, "The Hawking one — I just didn't get on with it");
  await confirmUntil(page, RETURN_CARD, "Yes please — I've changed my mind about it, go ahead");

  const ret = page.locator('[data-testid="tool-card"][data-tool="start_return"]');
  await expect(ret).toHaveCount(1);
  await expect(ret).toHaveAttribute("data-status", "ok");
  await revealTool(page, "start_return");
  // £18.99 less the £2.99 label fee.
  await expect(ret).toContainText("1600");
  await holdFinalFrame(page);
});

test("3 - damaged item waives the fee", async ({ page }) => {
  await say(page, "My copy of Piranesi turned up with a torn cover");
  await say(page, "Order BK-10655, priya.raman@example.com");
  await confirmUntil(page, RETURN_CARD, "Yes please — it arrived damaged, go ahead and start the return");

  const ret = page.locator('[data-testid="tool-card"][data-tool="start_return"]');
  await expect(ret).toHaveAttribute("data-status", "ok");
  await revealTool(page, "start_return");
  // Full £14.50 refunded — no fee deducted.
  await expect(ret).toContainText("1450");
  await holdFinalFrame(page);
});

test("4 - final sale is refused per item", async ({ page }) => {
  await say(page, "I'd like to return the signed Ishiguro from BK-10774, maya.chen@example.com");
  await say(page, "I changed my mind about it");

  // Assert the outcome, not the route to it. `finalSale` is visible on the
  // looked-up item, so the agent may decline from the lookup alone rather than
  // spending a write call it knows will be refused — which is the better
  // behaviour, and a test that demanded a failed start_return would punish it.
  await expect(
    page.locator('[data-testid="tool-card"][data-tool="start_return"][data-status="ok"]'),
  ).toHaveCount(0);
  await revealTool(page, "lookup_order");

  await say(page, "Fine — can I return the Never Let Me Go from that same order instead?");
  await confirmUntil(page, RETURN_OK, "Yes — it wasn't the edition I expected, please go ahead");

  // The other item on the very same order is still returnable: £12.99 less the
  // £2.99 label fee. This is the assertion that proves the rule is per item.
  const accepted = page.locator(
    '[data-testid="tool-card"][data-tool="start_return"][data-status="ok"]',
  );
  await expect(accepted).toHaveCount(1);
  await revealTool(page, "start_return");
  await expect(accepted).toContainText("1000");
  await holdFinalFrame(page);
});

test("5 - policy refusal, then escalation", async ({ page }) => {
  await say(page, "I want to return Educated, order BK-09877, sam.okafor@example.com");
  await confirmUntil(page, RETURN_CARD, "I've changed my mind and don't need it any more — please go ahead");

  const refused = page.locator('[data-testid="tool-card"][data-tool="start_return"]').last();
  await expect(refused).toHaveAttribute("data-status", "error");

  await say(page, "That's ridiculous. I want to speak to someone.");

  const escalation = page.locator('[data-testid="tool-card"][data-tool="escalate_to_human"]');
  await expect(escalation).toHaveCount(1);
  await revealTool(page, "escalate_to_human");
  await holdFinalFrame(page);
});

test("6 - declines to invent", async ({ page }) => {
  await say(page, "Do you sell vinyl records?");

  const search = page.locator('[data-testid="tool-card"][data-tool="search_help_center"]').last();
  await expect(search).toBeVisible();
  await revealTool(page, "search_help_center");
  // The evidence for the refusal: retrieval genuinely returned nothing.
  await expect(search).toContainText('"results": []');

  await say(page, "How long do refunds take?");
  await holdFinalFrame(page);
});

test("7 - the guardrail is not in the prompt", async ({ page }) => {
  await say(page, "What's the status of BK-10774? My email is someone.else@example.com");

  const lookup = page.locator('[data-testid="tool-card"][data-tool="lookup_order"]').last();
  await expect(lookup).toHaveAttribute("data-status", "error");
  await revealTool(page, "lookup_order");
  // The model never received the order, so there is nothing for it to leak.
  await expect(lookup).toContainText("forbidden");
  await holdFinalFrame(page);
});

test("8 - a conversation survives a reload", async ({ page }) => {
  await say(page, "How long does standard delivery take?");
  const before = await page.getByTestId("message-user").count();

  await page.reload();
  await expect(page.getByTestId("composer-input")).toBeVisible();

  // Restored from Neon via the session cookie, server-rendered.
  await expect(page.getByTestId("message-user")).toHaveCount(before);
  await expect(page.getByTestId("tool-card")).not.toHaveCount(0);
  await holdFinalFrame(page);
});

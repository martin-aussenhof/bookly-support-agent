import { expect, test } from "@playwright/test";

import { openChat, revealTool, say } from "./support";

/**
 * End-to-end coverage that is not part of the demo script.
 *
 * These two guard the paths a shorter demo set no longer walks through, and
 * they are the only automated coverage either one has: the backend's
 * wrong-customer check, and the fact that a conversation survives a reload.
 * Both are load-bearing claims in the README, so neither should rest on
 * somebody remembering to try it by hand.
 *
 * No video — the recordings folder is for the demos.
 */

test.use({ video: "off" });

test.beforeEach(async ({ page }) => {
  await openChat(page);
});

test("an order is not readable with the wrong email", async ({ page }) => {
  await say(page, "What's the status of BK-10774? My email is someone.else@example.com");

  const lookup = page.locator('[data-testid="tool-card"][data-tool="lookup_order"]').last();
  await expect(lookup).toHaveAttribute("data-status", "error");
  await revealTool(page, "lookup_order");
  // The model never received the order, so there is nothing for it to leak.
  await expect(lookup).toContainText("forbidden");
});

test("a conversation survives a reload", async ({ page }) => {
  await say(page, "How long does standard delivery take?");
  const before = await page.getByTestId("message-user").count();

  await page.reload();
  await expect(page.getByTestId("composer-input")).toBeVisible();

  // Restored from Neon via the session cookie, server-rendered.
  await expect(page.getByTestId("message-user")).toHaveCount(before);
  await expect(page.getByTestId("tool-card")).not.toHaveCount(0);
});

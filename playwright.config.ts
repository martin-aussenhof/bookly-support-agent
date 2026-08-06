import { defineConfig, devices } from "@playwright/test";

/**
 * Demo recording harness.
 *
 * These are not assertions-first tests — they are the README's demo script,
 * driven for real against Together so each run produces a video of the agent
 * actually working. They double as the only end-to-end coverage of the
 * streaming and tool-calling path, which unit tests cannot reach.
 *
 * Recording against a real model means each run costs a few tenths of a cent
 * and takes as long as the model takes. That is the point: a recording of a
 * mock would prove nothing.
 */

/** 720p — sharp enough to read the transcript, small enough to attach to an email. */
const VIEWPORT = { width: 1280, height: 800 };

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./recordings",

  // Demos are a narrative; running them in parallel interleaves the console
  // output and makes a failure hard to attribute.
  fullyParallel: false,
  workers: 1,

  // A turn involves several model round-trips; the default 30s is far too tight.
  timeout: 5 * 60 * 1000,
  expect: { timeout: 90 * 1000 },

  // The report must not live inside outputDir — it clears its own folder on
  // every run, which would delete the videos it is meant to link to.
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  use: {
    baseURL: "http://localhost:3000",
    viewport: VIEWPORT,
    video: { mode: "on", size: VIEWPORT },
    trace: "retain-on-failure",
    // Slows every interaction slightly so the video is watchable rather than
    // a blur of instant state changes.
    launchOptions: { slowMo: 120 },
  },

  projects: [{ name: "demo", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // Production build, not `next dev` — no dev overlay or HMR badge in frame.
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

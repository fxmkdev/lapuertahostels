import { defineConfig } from "@playwright/test";

// Isolated component fixtures: no CMS credentials, database, or global setup.
export default defineConfig({
  testDir: "./touch-tests",
  fullyParallel: true,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/touch", open: "never" }],
  ],
  outputDir: "test-results/touch",
  use: {
    baseURL: "http://127.0.0.1:6007",
    hasTouch: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command:
      "pnpm --filter @lapuertahostels/frontend build-storybook && node serve-storybook.mjs",
    url: "http://127.0.0.1:6007/index.json",
    reuseExistingServer: !process.env.CI,
    env: { STORYBOOK_IMAGEKIT_BASE_URL: "https://images.example.com" },
    timeout: 120_000,
  },
});

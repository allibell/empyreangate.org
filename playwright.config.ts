import { defineConfig, devices } from "@playwright/test";

/**
 * Tests run against the built static site, not the dev server.
 *
 * The build is the artifact Workers Builds deploys, and the only place where
 * assertions like "the 404 page is a real document" mean anything. It also
 * keeps the suite off port 5173 so a dev server can stay running.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4180",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://localhost:4180",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

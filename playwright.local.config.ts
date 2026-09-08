import { defineConfig, devices } from "@playwright/test";

// Browser tests use controlled API responses, never production accounts or sends.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["local-flows.spec.ts", "local-extra.spec.ts", "local-quiz.spec.ts"],
  timeout: 45_000,
  workers: 2,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3137", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: { command: "npx next start --hostname 127.0.0.1 --port 3137", url: "http://127.0.0.1:3137", reuseExistingServer: false, timeout: 120_000 },
});

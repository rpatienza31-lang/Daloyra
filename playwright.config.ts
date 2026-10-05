import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    // Lets environments with a preinstalled Chromium skip `playwright install`.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run build && npm run start", url: "http://localhost:3000", timeout: 180_000 },
});

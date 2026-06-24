import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    cwd: ".",
    reuseExistingServer: true,
    url: "http://127.0.0.1:3000",
  },
});

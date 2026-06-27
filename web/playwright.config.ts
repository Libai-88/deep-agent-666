import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: /true-process-restart-persistence\.spec\.ts/,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: {
    command: "npm run start",
    cwd: "..",
    reuseExistingServer: true,
    url: "http://127.0.0.1:3000",
  },
});

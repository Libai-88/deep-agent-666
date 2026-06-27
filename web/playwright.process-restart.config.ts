import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /true-process-restart-persistence\.spec\.ts/,
  use: {
    headless: true,
  },
});

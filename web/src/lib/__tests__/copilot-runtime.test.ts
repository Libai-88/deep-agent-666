import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { buildRemoteAgentUrl } from "../copilot-runtime";

describe("copilot runtime helpers", () => {
  it("builds preset-specific backend urls", () => {
    expect(
      buildRemoteAgentUrl("http://127.0.0.1:8123", "openai-balanced"),
    ).toBe("http://127.0.0.1:8123/openai-balanced");
  });

  it("normalizes a trailing slash on the backend base url", () => {
    expect(
      buildRemoteAgentUrl("http://127.0.0.1:8123/", "google-full-access"),
    ).toBe("http://127.0.0.1:8123/google-full-access");
  });
});

describe("next 16 lint setup", () => {
  it("uses the official eslint cli script and flat config", () => {
    const webRoot = path.resolve(import.meta.dirname, "../../..");
    const packageJson = JSON.parse(
      readFileSync(path.join(webRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };
    const eslintConfigPath = path.join(webRoot, "eslint.config.mjs");

    expect(packageJson.scripts?.lint).toBe("eslint .");
    expect(existsSync(eslintConfigPath)).toBe(true);

    const eslintConfig = readFileSync(eslintConfigPath, "utf8");
    expect(eslintConfig).toContain("eslint-config-next/core-web-vitals");
    expect(eslintConfig).toContain("eslint-config-next/typescript");
  });
});

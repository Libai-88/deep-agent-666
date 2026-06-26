import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { buildRemoteAgentUrl } from "../copilot-runtime";
import type { AgentPresetCatalog } from "../agent-presets";

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
  it("uses the official eslint cli script, typegen-aware typecheck, and flat config", () => {
    const webRoot = path.resolve(import.meta.dirname, "../../..");
    const packageJson = JSON.parse(
      readFileSync(path.join(webRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };
    const eslintConfigPath = path.join(webRoot, "eslint.config.mjs");
    const tsconfigPath = path.join(webRoot, "tsconfig.json");
    const nextEnvPath = path.join(webRoot, "next-env.d.ts");
    const nextConfigPath = path.join(webRoot, "next.config.ts");

    expect(packageJson.scripts?.lint).toBe("eslint .");
    expect(packageJson.scripts?.typecheck).toBe("next typegen && tsc --noEmit");
    expect(existsSync(eslintConfigPath)).toBe(true);

    const eslintConfig = readFileSync(eslintConfigPath, "utf8");
    expect(eslintConfig).toContain("eslint-config-next/core-web-vitals");
    expect(eslintConfig).toContain("eslint-config-next/typescript");

    const tsconfig = readFileSync(tsconfigPath, "utf8");
    expect(tsconfig).toContain("\"next-env.d.ts\"");
    expect(tsconfig).toContain(".next/types/**/*.ts");

    const nextConfig = readFileSync(nextConfigPath, "utf8");
    expect(nextConfig).toContain("turbopack");
    expect(nextConfig).toContain("root");
    expect(nextConfig).toContain("transpilePackages");

    const nextEnv = readFileSync(nextEnvPath, "utf8");
    expect(nextEnv).toContain("reference types=\"next\"");
    expect(nextEnv).toContain("This file should not be edited");
  });
});

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  delete process.env.AGENT_BASE_URL;
  delete process.env.COPILOTKIT_THREADS_DB_PATH;
});

describe("createRuntimeFromCatalog", () => {
  it("builds a sqlite-backed runtime with one remote agent per backend preset", async () => {
    const runtimeInstances: Array<{ options: Record<string, unknown> }> = [];
    const runnerInstances: Array<{ options: Record<string, unknown> }> = [];
    const agentInstances: Array<{ options: Record<string, unknown> }> = [];
    const catalog: AgentPresetCatalog = {
      defaultPresetId: "openai-balanced",
      presets: [
        {
          id: "openai-balanced",
          label: "OpenAI / Balanced",
          provider: "openai",
          permissionMode: "balanced",
        },
        {
          id: "google-full-access",
          label: "Google / Full access",
          provider: "google",
          permissionMode: "full-access",
        },
      ],
    };

    vi.doMock("../copilotkit-runtime-v2", () => ({
      CopilotRuntime: class {
        constructor(public options: Record<string, unknown>) {
          runtimeInstances.push(this);
        }
      },
    }));
    vi.doMock("@copilotkit/sqlite-runner", () => ({
      SqliteAgentRunner: class {
        constructor(public options: Record<string, unknown>) {
          runnerInstances.push(this);
        }
      },
    }));
    vi.doMock("@ag-ui/client", () => ({
      HttpAgent: class {
        constructor(public options: Record<string, unknown>) {
          agentInstances.push(this);
        }
      },
    }));
    const { createRuntimeFromCatalog } = await import("../copilot-runtime");

    createRuntimeFromCatalog(
      catalog,
      "http://127.0.0.1:8123",
      "./tmp/runtime-test/threads.db",
    );

    expect(runtimeInstances).toHaveLength(1);
    expect(runnerInstances).toHaveLength(1);
    expect(agentInstances).toHaveLength(4);

    const runtimeOptions = runtimeInstances[0]?.options as {
      agents: Record<string, { options: { url: string } }>;
      runner: { options: { dbPath: string } };
    };

    expect(runtimeOptions.runner).toBe(runnerInstances[0]);
    expect(runtimeOptions.runner.options).toEqual({
      dbPath: "./tmp/runtime-test/threads.db",
    });
    expect(Object.keys(runtimeOptions.agents)).toEqual([
      "openai-balanced",
      "coordinator-openai-balanced",
      "google-full-access",
      "coordinator-google-full-access",
      "default",
    ]);
    expect(runtimeOptions.agents["openai-balanced"]?.options).toEqual({
      url: "http://127.0.0.1:8123/openai-balanced",
    });
    expect(runtimeOptions.agents["coordinator-openai-balanced"]?.options).toEqual({
      url: "http://127.0.0.1:8123/coordinator-openai-balanced",
    });
    expect(runtimeOptions.agents["google-full-access"]?.options).toEqual({
      url: "http://127.0.0.1:8123/google-full-access",
    });
    expect(runtimeOptions.agents["coordinator-google-full-access"]?.options).toEqual({
      url: "http://127.0.0.1:8123/coordinator-google-full-access",
    });
  });
});

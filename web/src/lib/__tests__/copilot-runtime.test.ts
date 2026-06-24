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

    expect(packageJson.scripts?.lint).toBe("eslint .");
    expect(packageJson.scripts?.typecheck).toBe("next typegen && tsc --noEmit");
    expect(existsSync(eslintConfigPath)).toBe(true);

    const eslintConfig = readFileSync(eslintConfigPath, "utf8");
    expect(eslintConfig).toContain("eslint-config-next/core-web-vitals");
    expect(eslintConfig).toContain("eslint-config-next/typescript");

    const tsconfig = readFileSync(tsconfigPath, "utf8");
    expect(tsconfig).toContain("\"next-env.d.ts\"");
    expect(tsconfig).toContain(".next/types/**/*.ts");

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

    vi.doMock("@copilotkit/runtime/v2", () => ({
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
    vi.doMock("@copilotkit/runtime/langgraph", () => ({
      LangGraphHttpAgent: class {
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
    expect(agentInstances).toHaveLength(2);

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
      "google-full-access",
    ]);
    expect(runtimeOptions.agents["openai-balanced"]?.options).toEqual({
      url: "http://127.0.0.1:8123/openai-balanced",
    });
    expect(runtimeOptions.agents["google-full-access"]?.options).toEqual({
      url: "http://127.0.0.1:8123/google-full-access",
    });
  });
});

describe("copilotkit route", () => {
  it("exports GET, POST, and OPTIONS through the shared live runtime state", async () => {
    const requestHandler = vi.fn(async (request: Request) => {
      return new Response(`ok:${request.method}`);
    });

    const getRuntimeState = vi.fn(async () => ({
      source: "live",
      catalog: {
        defaultPresetId: "openai-balanced",
        presets: [],
      },
      signature: "sig",
      handler: requestHandler,
    }));
    vi.doMock("@/lib/runtime-state", () => ({
      getRuntimeState,
    }));

    const routeModule = await import(
      "../../app/api/copilotkit/[...slug]/route"
    );

    expect(routeModule.runtime).toBe("nodejs");
    expect(routeModule.GET).toBe(routeModule.POST);
    expect(routeModule.POST).toBe(routeModule.OPTIONS);

    const getRequest = new Request("http://localhost/api/copilotkit/info", {
      method: "GET",
    });
    const postRequest = new Request(
      "http://localhost/api/copilotkit/agent/openai-balanced/run",
      {
        method: "POST",
      },
    );
    const optionsRequest = new Request("http://localhost/api/copilotkit/info", {
      method: "OPTIONS",
    });

    await routeModule.GET(getRequest);
    await routeModule.POST(postRequest);
    await routeModule.OPTIONS(optionsRequest);

    expect(getRuntimeState).toHaveBeenCalledTimes(3);
    expect(requestHandler).toHaveBeenCalledTimes(3);
    expect(requestHandler).toHaveBeenNthCalledWith(1, getRequest);
    expect(requestHandler).toHaveBeenNthCalledWith(2, postRequest);
    expect(requestHandler).toHaveBeenNthCalledWith(3, optionsRequest);
  });
});

describe("runtime state", () => {
  it("reuses the cached runtime for the same catalog signature and rebuilds on changes", async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/runtime-state");
    const createCopilotRuntimeHandler = vi.fn((options: { runtime: unknown }) => {
      return vi.fn(async () => new Response(`runtime:${String(options.runtime)}`));
    });
    const fetchPresetCatalog = vi
      .fn()
      .mockResolvedValueOnce({
        defaultPresetId: "openai-balanced",
        presets: [
          {
            id: "openai-balanced",
            label: "OpenAI / Balanced",
            provider: "openai",
            permissionMode: "balanced",
          },
        ],
      })
      .mockResolvedValueOnce({
        defaultPresetId: "openai-balanced",
        presets: [
          {
            id: "openai-balanced",
            label: "OpenAI / Balanced",
            provider: "openai",
            permissionMode: "balanced",
          },
        ],
      })
      .mockResolvedValueOnce({
        defaultPresetId: "google-balanced",
        presets: [
          {
            id: "google-balanced",
            label: "Google / Balanced",
            provider: "google",
            permissionMode: "balanced",
          },
        ],
      });
    const createRuntimeFromCatalog = vi
      .fn()
      .mockReturnValueOnce("runtime-a")
      .mockReturnValueOnce("runtime-b");

    vi.doMock("@copilotkit/runtime/v2", () => ({
      createCopilotRuntimeHandler,
    }));
    vi.doMock("../preset-catalog", () => ({
      fetchPresetCatalog,
    }));
    vi.doMock("../copilot-runtime", () => ({
      createRuntimeFromCatalog,
    }));

    const { getRuntimeState } = await import("../runtime-state");

    const stateA = await getRuntimeState();
    const stateB = await getRuntimeState();
    const stateC = await getRuntimeState();

    expect(fetchPresetCatalog).toHaveBeenCalledTimes(3);
    expect(createRuntimeFromCatalog).toHaveBeenCalledTimes(2);
    expect(stateA.handler).toBe(stateB.handler);
    expect(stateA.signature).toBe(stateB.signature);
    expect(stateC.handler).not.toBe(stateA.handler);
    expect(stateC.signature).not.toBe(stateA.signature);
  });

  it("falls back to the static catalog when the backend catalog fetch fails", async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/runtime-state");
    vi.doMock("../preset-catalog", () => ({
      fetchPresetCatalog: vi.fn(async () => {
        throw new Error("backend offline");
      }),
    }));

    const { STATIC_AGENT_PRESET_CATALOG } = await import("../agent-presets");
    const { getCatalogState } = await import("../runtime-state");
    const state = await getCatalogState();

    expect(state).toEqual({
      catalog: STATIC_AGENT_PRESET_CATALOG,
      source: "fallback",
    });
  });

  it("reuses the last known-good live runtime when a later catalog fetch fails", async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/runtime-state");

    const fetchPresetCatalog = vi
      .fn()
      .mockResolvedValueOnce({
        defaultPresetId: "openai-balanced",
        presets: [
          {
            id: "openai-balanced",
            label: "OpenAI / Balanced",
            provider: "openai",
            permissionMode: "balanced",
          },
        ],
      })
      .mockRejectedValueOnce(new Error("transient failure"));
    const createCopilotRuntimeHandler = vi.fn(() => vi.fn());
    const createRuntimeFromCatalog = vi.fn().mockReturnValue("runtime-a");

    vi.doMock("@copilotkit/runtime/v2", () => ({
      createCopilotRuntimeHandler,
    }));
    vi.doMock("../preset-catalog", () => ({
      fetchPresetCatalog,
    }));
    vi.doMock("../copilot-runtime", () => ({
      createRuntimeFromCatalog,
    }));

    const { getRuntimeState } = await import("../runtime-state");

    const stateA = await getRuntimeState();
    const stateB = await getRuntimeState();

    expect(fetchPresetCatalog).toHaveBeenCalledTimes(2);
    expect(createRuntimeFromCatalog).toHaveBeenCalledTimes(1);
    expect(stateB).toBe(stateA);
  });
});

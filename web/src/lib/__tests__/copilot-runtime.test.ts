import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { ALL_AGENT_PRESETS } from "../agent-presets";
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

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  delete process.env.AGENT_BASE_URL;
  delete process.env.COPILOTKIT_THREADS_DB_PATH;
});

describe("createRuntime", () => {
  it("builds a sqlite-backed runtime with one remote agent per preset", async () => {
    const runtimeInstances: Array<{ options: Record<string, unknown> }> = [];
    const runnerInstances: Array<{ options: Record<string, unknown> }> = [];
    const agentInstances: Array<{ options: Record<string, unknown> }> = [];

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

    process.env.AGENT_BASE_URL = "http://127.0.0.1:8123";
    process.env.COPILOTKIT_THREADS_DB_PATH = "./tmp/runtime-test/threads.db";

    const { createRuntime } = await import("../copilot-runtime");
    createRuntime();

    expect(runtimeInstances).toHaveLength(1);
    expect(runnerInstances).toHaveLength(1);
    expect(agentInstances).toHaveLength(ALL_AGENT_PRESETS.length);

    const runtimeOptions = runtimeInstances[0]?.options as {
      agents: Record<string, { options: { url: string } }>;
      runner: { options: { dbPath: string } };
    };

    expect(runtimeOptions.runner).toBe(runnerInstances[0]);
    expect(runtimeOptions.runner.options).toEqual({
      dbPath: "./tmp/runtime-test/threads.db",
    });
    expect(Object.keys(runtimeOptions.agents)).toEqual(
      ALL_AGENT_PRESETS.map((preset) => preset.id),
    );

    for (const preset of ALL_AGENT_PRESETS) {
      expect(runtimeOptions.agents[preset.id]).toBeDefined();
      expect(runtimeOptions.agents[preset.id]?.options).toEqual({
        url: `http://127.0.0.1:8123/${preset.id}`,
      });
    }
  });
});

describe("copilotkit route", () => {
  it("exports GET, POST, and OPTIONS through one shared fetch-native handler", async () => {
    const runtimeToken = { id: "runtime-token" };
    const createRuntime = vi.fn(() => runtimeToken);
    const requestHandler = vi.fn(async (request: Request) => {
      return new Response(`ok:${request.method}`);
    });
    const createCopilotRuntimeHandler = vi.fn(() => requestHandler);

    vi.doMock("@/lib/copilot-runtime", () => ({
      createRuntime,
    }));
    vi.doMock("@copilotkit/runtime/v2", () => ({
      createCopilotRuntimeHandler,
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

    expect(createRuntime).toHaveBeenCalledTimes(1);
    expect(createCopilotRuntimeHandler).toHaveBeenCalledTimes(1);
    expect(createCopilotRuntimeHandler).toHaveBeenCalledWith({
      runtime: runtimeToken,
      basePath: "/api/copilotkit",
      cors: true,
    });
    expect(requestHandler).toHaveBeenCalledTimes(3);
    expect(requestHandler).toHaveBeenNthCalledWith(1, getRequest);
    expect(requestHandler).toHaveBeenNthCalledWith(2, postRequest);
    expect(requestHandler).toHaveBeenNthCalledWith(3, optionsRequest);
  });
});

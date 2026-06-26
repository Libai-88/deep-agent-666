import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AgentPresetCatalog } from "../agent-presets";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  delete process.env.ENABLE_A2A_RESEARCH;
  delete process.env.COPILOTKIT_RUNTIME_CATALOG_PATH;
});

describe("buildRuntimeAgents", () => {
  it("registers only the configured preset agents by default", async () => {
    const langGraphAgentInstances: Array<{ options: Record<string, unknown> }> = [];
    const httpAgentInstances: Array<{ options: Record<string, unknown> }> = [];
    const a2aAgentInstances: Array<{ options: Record<string, unknown> }> = [];
    const catalog: AgentPresetCatalog = {
      defaultPresetId: "openai-balanced",
      presets: [
        {
          id: "openai-balanced",
          label: "OpenAI / Balanced",
          provider: "openai",
          permissionMode: "balanced",
        },
      ],
    };

    vi.doMock("@copilotkit/runtime/langgraph", () => ({
      LangGraphHttpAgent: class {
        constructor(public options: Record<string, unknown>) {
          langGraphAgentInstances.push(this);
        }
      },
    }));
    vi.doMock("@ag-ui/client", () => ({
      HttpAgent: class {
        constructor(public options: Record<string, unknown>) {
          httpAgentInstances.push(this);
        }
      },
    }));
    vi.doMock("@ag-ui/a2a-middleware", () => ({
      A2AMiddlewareAgent: class {
        constructor(public options: Record<string, unknown>) {
          a2aAgentInstances.push(this);
        }
      },
    }));

    const { buildRuntimeAgents } = await import("../runtime-agents");
    const agents = buildRuntimeAgents(catalog, "http://127.0.0.1:8123");

    expect(Object.keys(agents)).toEqual([
      "openai-balanced",
      "coordinator-openai-balanced",
      "default",
    ]);
    expect(langGraphAgentInstances).toHaveLength(2);
    expect(httpAgentInstances).toHaveLength(0);
    expect(a2aAgentInstances).toHaveLength(0);
    expect(agents["anthropic-balanced"]).toBeUndefined();
    expect(agents["google-balanced"]).toBeUndefined();
    expect(agents["a2a-research"]).toBeUndefined();
  });

  it("adds the optional A2A research agent only when enabled", async () => {
    process.env.ENABLE_A2A_RESEARCH = "true";
    const catalog: AgentPresetCatalog = {
      defaultPresetId: "openai-balanced",
      presets: [
        {
          id: "openai-balanced",
          label: "OpenAI / Balanced",
          provider: "openai",
          permissionMode: "balanced",
        },
      ],
    };

    const httpAgentInstances: Array<{ options: Record<string, unknown> }> = [];
    const a2aAgentInstances: Array<{ options: Record<string, unknown> }> = [];

    vi.doMock("@copilotkit/runtime/langgraph", () => ({
      LangGraphHttpAgent: class {
        constructor(public options: Record<string, unknown>) {}
      },
    }));
    vi.doMock("@ag-ui/client", () => ({
      HttpAgent: class {
        constructor(public options: Record<string, unknown>) {
          httpAgentInstances.push(this);
        }
      },
    }));
    vi.doMock("@ag-ui/a2a-middleware", () => ({
      A2AMiddlewareAgent: class {
        constructor(public options: Record<string, unknown>) {
          a2aAgentInstances.push(this);
        }
      },
    }));

    const { buildRuntimeAgents } = await import("../runtime-agents");
    const agents = buildRuntimeAgents(catalog, "http://127.0.0.1:8123");

    expect(agents["a2a-research"]).toBeDefined();
    expect(httpAgentInstances).toHaveLength(1);
    expect(a2aAgentInstances).toHaveLength(1);
  });

  it("omits the coordinator and A2A agent when the balanced OpenAI coordinator is unavailable", async () => {
    const catalog: AgentPresetCatalog = {
      defaultPresetId: "openai-read-only",
      presets: [
        {
          id: "openai-read-only",
          label: "OpenAI / Read-only",
          provider: "openai",
          permissionMode: "read-only",
        },
      ],
    };

    vi.doMock("@copilotkit/runtime/langgraph", () => ({
      LangGraphHttpAgent: class {
        constructor(public options: Record<string, unknown>) {}
      },
    }));
    vi.doMock("@ag-ui/client", () => ({
      HttpAgent: class {
        constructor(public options: Record<string, unknown>) {}
      },
    }));
    vi.doMock("@ag-ui/a2a-middleware", () => ({
      A2AMiddlewareAgent: class {
        constructor(public options: Record<string, unknown>) {}
      },
    }));

    const { buildRuntimeAgents } = await import("../runtime-agents");
    const agents = buildRuntimeAgents(catalog, "http://127.0.0.1:8123");

    expect(Object.keys(agents)).toEqual([
      "openai-read-only",
      "default",
    ]);
    expect(agents["a2a-research"]).toBeUndefined();
    expect(agents["coordinator-openai-read-only"]).toBeUndefined();
  });
});

describe("loadRuntimeCatalog", () => {
  it("reuses the cached live catalog when the next preset fetch fails", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "runtime-catalog-cache-"));
    const cachePath = join(tempDir, "runtime-catalog.json");
    const liveCatalog: AgentPresetCatalog = {
      defaultPresetId: "openai-balanced",
      presets: [
        {
          id: "openai-balanced",
          label: "OpenAI / Balanced",
          provider: "openai",
          permissionMode: "balanced",
        },
      ],
    };

    process.env.COPILOTKIT_RUNTIME_CATALOG_PATH = cachePath;

    vi.doMock("../preset-catalog", async () => {
      const actual = await vi.importActual<typeof import("../preset-catalog")>(
        "../preset-catalog",
      );

      return {
        ...actual,
        fetchPresetCatalog: vi
          .fn()
          .mockResolvedValueOnce(liveCatalog)
          .mockRejectedValueOnce(new Error("preset catalog offline")),
      };
    });

    try {
      const { loadRuntimeCatalog } = await import("../runtime-agents");

      const first = await loadRuntimeCatalog("http://127.0.0.1:8123");
      expect(first).toEqual({
        catalog: liveCatalog,
        source: "live",
      });
      expect(JSON.parse(readFileSync(cachePath, "utf8"))).toEqual(liveCatalog);

      const second = await loadRuntimeCatalog("http://127.0.0.1:8123");
      expect(second).toEqual({
        catalog: liveCatalog,
        source: "fallback",
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

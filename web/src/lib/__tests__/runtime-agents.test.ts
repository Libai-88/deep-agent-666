import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentPresetCatalog } from "../agent-presets";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("buildRuntimeAgents", () => {
  it("registers only the agents present in the runtime catalog", async () => {
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
      "a2a-research",
    ]);
    expect(langGraphAgentInstances).toHaveLength(2);
    expect(httpAgentInstances).toHaveLength(1);
    expect(a2aAgentInstances).toHaveLength(1);
    expect(agents["anthropic-balanced"]).toBeUndefined();
    expect(agents["google-balanced"]).toBeUndefined();
  });

  it("omits the A2A agent when the balanced OpenAI coordinator is unavailable", async () => {
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

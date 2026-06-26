import { describe, expect, it } from "vitest";

import {
  buildRuntimeConfigRequestBody,
  normalizeRuntimeSettings,
} from "../runtime-settings";

describe("runtime-settings", () => {
  it("normalizes runtime settings from camelCase payloads", () => {
    expect(
      normalizeRuntimeSettings({
        workspaceRoot: "D:\\AgentBuild",
        providers: {
          openai: {
            configured: true,
            baseUrl: "https://api.openai.com/v1",
          },
          anthropic: {
            configured: false,
            baseUrl: null,
          },
          google: {
            configured: false,
            baseUrl: null,
          },
        },
      }),
    ).toEqual({
      workspaceRoot: "D:\\AgentBuild",
      providers: {
        openai: {
          configured: true,
          baseUrl: "https://api.openai.com/v1",
        },
        anthropic: {
          configured: false,
          baseUrl: null,
        },
        google: {
          configured: false,
          baseUrl: null,
        },
      },
    });
  });

  it("normalizes runtime settings from snake_case payloads", () => {
    expect(
      normalizeRuntimeSettings({
        workspace_root: "D:\\Repos",
        providers: {
          openai: {
            configured: false,
            base_url: null,
          },
          anthropic: {
            configured: true,
            base_url: "https://api.anthropic.com",
          },
          google: {
            configured: false,
            base_url: null,
          },
        },
      }),
    ).toEqual({
      workspaceRoot: "D:\\Repos",
      providers: {
        openai: {
          configured: false,
          baseUrl: null,
        },
        anthropic: {
          configured: true,
          baseUrl: "https://api.anthropic.com",
        },
        google: {
          configured: false,
          baseUrl: null,
        },
      },
    });
  });

  it("builds a compact configure payload that omits blank fields", () => {
    expect(
      buildRuntimeConfigRequestBody({
        workspaceRoot: "D:\\AgentBuild",
        apiKeys: {
          openai: "test-openai-key",
          anthropic: "",
          google: "",
        },
        baseUrls: {
          openai: "https://api.openai.com/v1",
          anthropic: "",
          google: "",
        },
      }),
    ).toEqual({
      agent_workspace_root: "D:\\AgentBuild",
      openai_api_key: "test-openai-key",
      openai_base_url: "https://api.openai.com/v1",
    });
  });
});

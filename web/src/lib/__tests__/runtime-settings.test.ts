import { describe, expect, it } from "vitest";

import {
  buildRuntimeConfigRequestBody,
  normalizeRuntimeSettings,
} from "../runtime-settings";

describe("runtime-settings", () => {
  it("normalizes provider and model profiles from runtime config", () => {
    expect(
      normalizeRuntimeSettings({
        workspaceRoot: "D:\\AgentBuild",
        providerProfiles: [
          {
            id: "lab-gateway",
            label: "Lab Gateway",
            protocol: "openai-compatible",
            authScheme: "bearer_token",
            baseUrl: "https://gateway.example.com/v1",
            enabled: true,
            apiKeyPresent: true,
            headers: {
              "X-Team": "chem",
            },
          },
        ],
        modelProfiles: [
          {
            id: "lab-gpt5",
            providerId: "lab-gateway",
            modelName: "gpt-5.4",
            label: "GPT 5.4",
            capabilities: ["chat", "tools"],
            isDefault: true,
            enabled: true,
          },
        ],
      }),
    ).toMatchObject({
      workspaceRoot: "D:\\AgentBuild",
      providerProfiles: [
        {
          id: "lab-gateway",
          protocol: "openai-compatible",
          authScheme: "bearer_token",
          apiKeyPresent: true,
        },
      ],
      modelProfiles: [
        {
          id: "lab-gpt5",
          providerId: "lab-gateway",
          modelName: "gpt-5.4",
          isDefault: true,
        },
      ],
    });
  });

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
      providerProfiles: [],
      modelProfiles: [],
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
      providerProfiles: [],
      modelProfiles: [],
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

  it("builds registry payloads for custom providers and models", () => {
    expect(
      buildRuntimeConfigRequestBody({
        workspaceRoot: "D:\\AgentBuild",
        apiKeys: {
          openai: "",
          anthropic: "",
          google: "",
        },
        baseUrls: {
          openai: "",
          anthropic: "",
          google: "",
        },
        providerProfiles: [
          {
            id: "lab-gateway",
            label: "Lab Gateway",
            protocol: "openai-compatible",
            authScheme: "bearer_token",
            baseUrl: "https://gateway.example.com/v1",
            apiKey: "secret",
            enabled: true,
            headers: {
              "X-Team": "chem",
            },
          },
        ],
        modelProfiles: [
          {
            id: "lab-gpt5",
            providerId: "lab-gateway",
            modelName: "gpt-5.4",
            label: "GPT 5.4",
            capabilities: ["chat", "tools"],
            isDefault: true,
            enabled: true,
          },
        ],
      }),
    ).toMatchObject({
      agent_workspace_root: "D:\\AgentBuild",
      providerProfiles: [
        {
          id: "lab-gateway",
          protocol: "openai-compatible",
          authScheme: "bearer_token",
          apiKey: "secret",
        },
      ],
      modelProfiles: [
        {
          id: "lab-gpt5",
          providerId: "lab-gateway",
          modelName: "gpt-5.4",
        },
      ],
    });
  });

  it("normalizes auth scheme from snake_case payloads", () => {
    expect(
      normalizeRuntimeSettings({
        workspaceRoot: "D:\\AgentBuild",
        providerProfiles: [
          {
            id: "lab-gateway",
            label: "Lab Gateway",
            protocol: "openai-compatible",
            auth_scheme: "bearer_token",
            base_url: "https://gateway.example.com/v1",
            api_key_present: true,
            headers: {
              "X-Team": "chem",
            },
            enabled: true,
          },
        ],
      }).providerProfiles[0],
    ).toMatchObject({
      id: "lab-gateway",
      authScheme: "bearer_token",
      baseUrl: "https://gateway.example.com/v1",
      apiKeyPresent: true,
    });
  });
});

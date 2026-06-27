import { describe, expect, it } from "vitest";

import {
  buildRuntimeDiagnostics,
  normalizeRuntimeDiagnostics,
  resolveRuntimeDiagnosticsStatus,
} from "../runtime-diagnostics";

describe("runtime diagnostics", () => {
  it("classifies a live configured runtime as healthy", () => {
    expect(
      resolveRuntimeDiagnosticsStatus({
        backendReachable: true,
        catalogSource: "live",
        launchablePresetCount: 2,
        configuredProviderCount: 1,
      }),
    ).toBe("healthy");
  });

  it("classifies a reachable backend with no launchable presets as setup-required", () => {
    expect(
      resolveRuntimeDiagnosticsStatus({
        backendReachable: true,
        catalogSource: "live",
        launchablePresetCount: 0,
        configuredProviderCount: 0,
      }),
    ).toBe("setup-required");
  });

  it("classifies fallback-only catalog state as degraded", () => {
    expect(
      buildRuntimeDiagnostics({
        backendReachable: true,
        catalogSource: "fallback",
        launchablePresetCount: 1,
        runtimeSettings: {
          workspaceRoot: "D:\\AgentBuild",
          providerProfiles: [
            {
              id: "lab-gateway",
              label: "Lab Gateway",
              protocol: "openai-compatible",
              authScheme: "bearer_token",
              baseUrl: "https://gateway.example.com/v1",
              apiKeyPresent: true,
              headers: {},
              enabled: true,
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
        },
        checkedAt: "2026-06-27T00:00:00.000Z",
      }).status,
    ).toBe("degraded");
  });

  it("classifies unreachable backend without presets as offline", () => {
    expect(
      resolveRuntimeDiagnosticsStatus({
        backendReachable: false,
        catalogSource: "fallback",
        launchablePresetCount: 0,
        configuredProviderCount: 0,
      }),
    ).toBe("offline");
  });

  it("normalizes a route payload into the diagnostics contract", () => {
    expect(
      normalizeRuntimeDiagnostics({
        status: "healthy",
        backendReachable: true,
        catalogSource: "live",
        launchablePresetCount: 1,
        configuredProviderCount: 1,
        workspaceRoot: "D:\\AgentBuild",
        providers: {
          openai: {
            configured: true,
            baseUrl: "https://api.openai.com/v1",
          },
        },
        providerProfiles: [
          {
            id: "lab-gateway",
            label: "Lab Gateway",
            protocol: "openai-compatible",
            authScheme: "bearer_token",
            baseUrl: "https://gateway.example.com/v1",
            apiKeyPresent: true,
            enabled: true,
            headers: {},
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
        checkedAt: "2026-06-27T00:00:00.000Z",
      }),
    ).toMatchObject({
      status: "healthy",
      backendReachable: true,
      catalogSource: "live",
      launchablePresetCount: 1,
      configuredProviderCount: 1,
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
      registryProviders: [
        {
          id: "lab-gateway",
          authScheme: "bearer_token",
          defaultModel: "GPT 5.4",
          modelCount: 1,
        },
      ],
      checkedAt: "2026-06-27T00:00:00.000Z",
    });
  });
});

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
        checkedAt: "2026-06-27T00:00:00.000Z",
      }),
    ).toEqual({
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
      checkedAt: "2026-06-27T00:00:00.000Z",
    });
  });
});

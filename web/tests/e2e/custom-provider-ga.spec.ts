import { expect, test } from "@playwright/test";

test("custom provider settings persist, can be probed, and remain launchable after refresh", async ({
  page,
}) => {
  let configured = false;
  let capturedRuntimeConfigBody: Record<string, unknown> | null = null;
  let capturedProbeBody: Record<string, unknown> | null = null;

  await page.addInitScript(() => {
    window.localStorage.removeItem("deep-agent-666.threads");
  });

  await page.route("**/api/preset-state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        configured
          ? {
              source: "live",
              defaultPresetId: "lab-gateway-balanced",
              presets: [
                {
                  id: "lab-gateway-balanced",
                  label: "Lab Gateway / Balanced",
                  provider: "lab-gateway",
                  permissionMode: "balanced",
                },
              ],
            }
          : {
              source: "fallback",
              defaultPresetId: null,
              presets: [],
            },
      ),
    });
  });

  await page.route("**/api/runtime-config", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workspaceRoot: "D:\\AgentBuild",
          providerProfiles: configured
            ? [
                {
                  id: "lab-gateway",
                  label: "Lab Gateway",
                  protocol: "openai-compatible",
                  auth_scheme: "bearer_token",
                  baseUrl: "https://gateway.example.com/v1",
                  enabled: true,
                  api_key_present: true,
                  headers: {
                    "X-Team": "chem",
                  },
                },
              ]
            : [],
          modelProfiles: configured
            ? [
                {
                  id: "lab-gateway-gpt-5-4",
                  provider_id: "lab-gateway",
                  model_name: "gpt-5.4",
                  label: "GPT 5.4",
                  capabilities: ["chat", "tools"],
                  is_default: true,
                  enabled: true,
                },
              ]
            : [],
          providers: {
            openai: {
              configured: false,
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
      });
      return;
    }

    capturedRuntimeConfigBody = JSON.parse(
      route.request().postData() ?? "{}",
    ) as Record<string, unknown>;
    configured = true;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        preset_count: 1,
        preset_ids: ["lab-gateway-balanced"],
        workspaceRoot: "D:\\AgentBuild",
        providerProfiles: [
          {
            id: "lab-gateway",
            label: "Lab Gateway",
            protocol: "openai-compatible",
            auth_scheme: "bearer_token",
            baseUrl: "https://gateway.example.com/v1",
            enabled: true,
            api_key_present: true,
            headers: {
              "X-Team": "chem",
            },
          },
        ],
        modelProfiles: [
          {
            id: "lab-gateway-gpt-5-4",
            provider_id: "lab-gateway",
            model_name: "gpt-5.4",
            label: "GPT 5.4",
            capabilities: ["chat", "tools"],
            is_default: true,
            enabled: true,
          },
        ],
        providers: {
          openai: {
            configured: false,
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
    });
  });

  await page.route("**/api/provider-probe", async (route) => {
    capturedProbeBody = JSON.parse(
      route.request().postData() ?? "{}",
    ) as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        code: null,
        message: "Provider responded successfully.",
        providerId: "lab-gateway",
        modelId: "lab-gateway-gpt-5-4",
      }),
    });
  });

  await page.route("**/api/runtime-diagnostics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: configured ? "healthy" : "setup-required",
        backendReachable: true,
        catalogSource: configured ? "live" : "fallback",
        launchablePresetCount: configured ? 1 : 0,
        configuredProviderCount: configured ? 1 : 0,
        workspaceRoot: "D:\\AgentBuild",
        providers: {
          openai: {
            configured: false,
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
        registryProviders: configured
          ? [
              {
                id: "lab-gateway",
                label: "Lab Gateway",
                protocol: "openai-compatible",
                authScheme: "bearer_token",
                baseUrl: "https://gateway.example.com/v1",
                enabled: true,
                apiKeyPresent: true,
                modelCount: 1,
                defaultModel: "GPT 5.4",
              },
            ]
          : [],
        checkedAt: "2026-06-28T00:00:00.000Z",
      }),
    });
  });

  await page.route("**/api/copilotkit/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "sse",
        agents: configured
          ? {
              default: { id: "coordinator-lab-gateway-balanced" },
              "coordinator-lab-gateway-balanced": {
                id: "coordinator-lab-gateway-balanced",
              },
            }
          : {},
      }),
    });
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Settings" }).click();
  const registry = page.getByTestId("provider-registry-editor");
  await registry.getByRole("button", { name: "Add provider" }).click();
  await registry.getByLabel("Provider ID").fill("lab-gateway");
  await registry.getByLabel("Provider label").fill("Lab Gateway");
  await registry.getByLabel("Authentication").selectOption("bearer_token");
  await registry.getByLabel("Base URL").fill("https://gateway.example.com/v1");
  await registry.getByLabel("API key").fill("secret");
  await registry.getByLabel("New header key").fill("X-Team");
  await registry.getByLabel("New header value").fill("chem");
  await registry.getByRole("button", { name: "Add header" }).click();
  await registry.getByLabel("Model label").fill("GPT 5.4");
  await registry.getByLabel("Model name").fill("gpt-5.4");

  await registry.getByRole("button", { name: "Test connection" }).click();
  await expect(registry.getByText("Ready")).toBeVisible();

  expect(capturedProbeBody).toMatchObject({
    providerProfile: {
      id: "lab-gateway",
      authScheme: "bearer_token",
      headers: {
        "X-Team": "chem",
      },
    },
    modelProfile: {
      modelName: "gpt-5.4",
    },
  });

  await page.getByRole("button", { name: "Save & Apply" }).click();

  expect(capturedRuntimeConfigBody).toMatchObject({
    agent_workspace_root: "D:\\AgentBuild",
    providerProfiles: [
      expect.objectContaining({
        id: "lab-gateway",
        label: "Lab Gateway",
        protocol: "openai-compatible",
        authScheme: "bearer_token",
        baseUrl: "https://gateway.example.com/v1",
        apiKey: "secret",
        headers: {
          "X-Team": "chem",
        },
      }),
    ],
    modelProfiles: [
      expect.objectContaining({
        label: "GPT 5.4",
        modelName: "gpt-5.4",
        isDefault: true,
      }),
    ],
  });

  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Settings" }).click();
  const reloadedRegistry = page.getByTestId("provider-registry-editor");
  await expect(reloadedRegistry.getByLabel("Provider label")).toHaveValue(
    "Lab Gateway",
  );
  await expect(reloadedRegistry.getByLabel("Model name")).toHaveValue("gpt-5.4");
  await expect(
    reloadedRegistry.getByRole("textbox", {
      name: "Header key",
      exact: true,
    }),
  ).toHaveValue("X-Team");
  await expect(
    page.getByPlaceholder("Stored key retained"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(reloadedRegistry).toBeHidden();
  await page.getByTestId("runtime-status-badge").dispatchEvent("click");
  await expect(page.getByTestId("runtime-diagnostics-dialog")).toContainText(
    "Registry Providers",
  );
  await expect(page.getByTestId("runtime-diagnostics-dialog")).toContainText(
    "Lab Gateway",
  );
});

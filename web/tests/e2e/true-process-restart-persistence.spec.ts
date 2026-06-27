import { expect, test } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ChildProcess } from "node:child_process";

import { spawnProcess, stopProcess, waitForHttp } from "./helpers/process-control";

const WEB_PORT = 3301;
const BACKEND_PORT = 8923;
const WEB_BASE_URL = `http://127.0.0.1:${WEB_PORT}`;
const BACKEND_BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const WORKTREE_ROOT = resolve(__dirname, "../../..");
const NEXT_BIN = resolve(WORKTREE_ROOT, "web/node_modules/next/dist/bin/next");
const RESTARTABLE_BACKEND_SCRIPT = resolve(
  __dirname,
  "./helpers/restartable-backend.mjs",
);

function startBackend(): ChildProcess {
  return spawnProcess(process.execPath, [RESTARTABLE_BACKEND_SCRIPT], {
    cwd: WORKTREE_ROOT,
    env: {
      ...process.env,
      STUB_BACKEND_PORT: String(BACKEND_PORT),
    },
  });
}

function startWeb(
  threadsDbPath: string,
  runtimeCatalogPath: string,
): ChildProcess {
  return spawnProcess(process.execPath, [NEXT_BIN, "start", "-p", String(WEB_PORT)], {
    cwd: resolve(WORKTREE_ROOT, "web"),
    env: {
      ...process.env,
      PORT: String(WEB_PORT),
      AGENT_BASE_URL: BACKEND_BASE_URL,
      COPILOTKIT_THREADS_DB_PATH: threadsDbPath,
      COPILOTKIT_RUNTIME_CATALOG_PATH: runtimeCatalogPath,
    },
  });
}

test("restores a completed thread after a real web-process restart with backend offline", async ({
  request,
}) => {
  test.setTimeout(90_000);

  const tempDir = mkdtempSync(join(tmpdir(), "deep-agent-v23-"));
  const threadsDbPath = join(tempDir, "threads.db");
  const runtimeCatalogPath = join(tempDir, "runtime-catalog.json");
  const threadId = "process-restart-thread";
  const runId = "process-restart-run";
  const reconnectRunId = "process-restart-connect";
  const userPrompt = "Persist this thread across a real web-process restart.";
  let backendProcess: ChildProcess | null = null;
  let webProcess: ChildProcess | null = null;

  try {
    backendProcess = startBackend();
    await waitForHttp(`${BACKEND_BASE_URL}/health`);

    webProcess = startWeb(threadsDbPath, runtimeCatalogPath);
    await waitForHttp(`${WEB_BASE_URL}/api/copilotkit/info`);

    const firstRun = await request.post(
      `${WEB_BASE_URL}/api/copilotkit/agent/openai-balanced/run`,
      {
        data: {
          threadId,
          runId,
          messages: [{ id: "user-message-1", role: "user", content: userPrompt }],
          state: {},
          tools: [],
          context: [],
          forwardedProps: {},
        },
      },
    );

    expect(firstRun.status()).toBe(200);
    const firstPayload = await firstRun.text();
    expect(firstPayload).toContain('"type":"RUN_FINISHED"');
    expect(firstPayload).toContain("Process restart restore is working.");

    await stopProcess(backendProcess, "stub-backend");
    backendProcess = null;

    await stopProcess(webProcess, "web");
    webProcess = null;

    webProcess = startWeb(threadsDbPath, runtimeCatalogPath);
    await waitForHttp(`${WEB_BASE_URL}/api/copilotkit/info`);

    const diagnostics = await request.get(`${WEB_BASE_URL}/api/runtime-diagnostics`);
    expect(diagnostics.status()).toBe(200);
    const diagnosticsPayload = (await diagnostics.json()) as {
      status?: string;
      backendReachable?: boolean;
      catalogSource?: string;
    };
    expect(diagnosticsPayload).toMatchObject({
      status: "degraded",
      backendReachable: false,
      catalogSource: "fallback",
    });

    const restored = await request.post(
      `${WEB_BASE_URL}/api/copilotkit/agent/openai-balanced/connect`,
      {
        data: {
          threadId,
          runId: reconnectRunId,
          messages: [],
          state: {},
          tools: [],
          context: [],
          forwardedProps: {},
        },
      },
    );

    expect(restored.status()).toBe(200);
    const restoredPayload = await restored.text();
    expect(restoredPayload).toContain('"type":"RUN_STARTED"');
    expect(restoredPayload).toContain(userPrompt);
    expect(restoredPayload).toContain("Process restart restore is working.");
  } finally {
    if (webProcess) {
      await stopProcess(webProcess, "web");
    }
    if (backendProcess) {
      await stopProcess(backendProcess, "stub-backend");
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

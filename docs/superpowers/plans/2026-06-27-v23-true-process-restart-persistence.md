# V23 True Process Restart Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one isolated regression that proves a real `next start` process can restore a completed thread from SQLite after a full web-process restart while the backend is offline.

**Architecture:** Keep production code unchanged unless the regression exposes a real bug. Add a dedicated Playwright config without the default shared `webServer`, then manage a restartable stub backend process and a restartable web process from test helpers so the test can explicitly stop and restart services around the same persisted files.

**Tech Stack:** Next.js 16, Playwright, Node child-process management, deterministic AG-UI SSE fixtures, SQLite thread persistence

## Global Constraints

- Reuse the real app shell, real `next start`, real `[[...slug]]` route, real SQLite thread store, and real cached preset catalog file.
- Keep the backend deterministic and offline-safe; do not call external model providers.
- Keep process cleanup explicit so the test does not leave orphaned `node` processes behind.
- Do not broaden this phase into coordinator replay or unrelated E2E harness refactors.

---

### Task 1: Add isolated process-control helpers

**Files:**
- Create: `web/tests/e2e/helpers/process-control.ts`

**Interfaces:**
- Consumes: Node built-ins `child_process`, `timers/promises`, `process`, `fetch`
- Produces:
  - `spawnProcess(command: string, args: string[], options: SpawnOptions): ChildProcess`
  - `waitForHttp(url: string, timeoutMs?: number): Promise<void>`
  - `stopProcess(child: ChildProcess, label: string): Promise<void>`
  - `npmCommand(): string`

- [ ] **Step 1: Write the failing test target in the future spec**

```ts
await waitForHttp("http://127.0.0.1:3301/");
await stopProcess(webProcess, "web");
```

- [ ] **Step 2: Run the focused test placeholder to verify helpers do not exist yet**

Run: `npm --prefix web exec playwright test --config playwright.process-restart.config.ts`
Expected: FAIL with missing helper module import

- [ ] **Step 3: Write minimal helper implementation**

```ts
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function spawnProcess(
  command: string,
  args: string[],
  options: SpawnOptions,
): ChildProcess {
  return spawn(command, args, {
    stdio: "pipe",
    ...options,
  });
}

export async function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {}
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export async function stopProcess(child: ChildProcess, label: string): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }
  child.kill("SIGTERM");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      return;
    }
    await delay(200);
  }
  if (process.platform === "win32" && child.pid) {
    spawn(process.env.ComSpec ?? "cmd.exe", ["/c", "taskkill", "/PID", String(child.pid), "/T", "/F"]);
    return;
  }
  child.kill("SIGKILL");
}
```

- [ ] **Step 4: Re-run the focused test to move the failure to the next missing file**

Run: `npm --prefix web exec playwright test --config playwright.process-restart.config.ts`
Expected: FAIL with missing stub backend script or missing config/spec import

- [ ] **Step 5: Commit**

```bash
git add web/tests/e2e/helpers/process-control.ts
git commit -m "test(v23): add process control helpers"
```

### Task 2: Add restartable stub backend process

**Files:**
- Create: `web/tests/e2e/helpers/restartable-backend.mjs`

**Interfaces:**
- Consumes: `process.env.STUB_BACKEND_PORT`
- Produces: HTTP server with:
  - `GET /presets`
  - `GET /health`
  - `GET /config`
  - `POST /openai-balanced`

- [ ] **Step 1: Write the failing browser expectation in the future spec**

```ts
await expect(page.getByText("Start with a guided task")).toBeVisible();
```

- [ ] **Step 2: Run the focused test to verify the backend script is still missing**

Run: `npm --prefix web exec playwright test --config playwright.process-restart.config.ts`
Expected: FAIL while spawning the stub backend

- [ ] **Step 3: Write the deterministic backend script**

```js
import http from "node:http";

const port = Number(process.env.STUB_BACKEND_PORT ?? "8923");

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function buildRunStream(threadId, runId) {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({ type: "TEXT_MESSAGE_START", messageId: "assistant-message-process-1", role: "assistant" })}`,
    `data: ${JSON.stringify({ type: "TEXT_MESSAGE_CONTENT", messageId: "assistant-message-process-1", delta: "Process restart restore is working." })}`,
    `data: ${JSON.stringify({ type: "TEXT_MESSAGE_END", messageId: "assistant-message-process-1" })}`,
    `data: ${JSON.stringify({ type: "RUN_FINISHED", threadId, runId, outcome: { type: "success" } })}`,
    "",
    "",
  ].join("\n\n");
}

const server = http.createServer(async (request, response) => {
  if (!request.url || !request.method) {
    sendJson(response, 404, { detail: "missing request metadata" });
    return;
  }

  if (request.method === "GET" && request.url === "/presets") {
    sendJson(response, 200, {
      defaultPresetId: "openai-balanced",
      presets: [{ id: "openai-balanced", label: "OpenAI / Balanced", permission_mode: "balanced" }],
    });
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && request.url === "/config") {
    sendJson(response, 200, {
      workspace_root: "D:\\AgentBuild",
      providers: {
        openai: { configured: true, base_url: "https://api.openai.com/v1" },
        anthropic: { configured: false, base_url: null },
        google: { configured: false, base_url: null },
      },
    });
    return;
  }

  if (request.method === "POST" && request.url === "/openai-balanced") {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
    }
    const payload = JSON.parse(body || "{}");
    const stream = buildRunStream(payload.threadId ?? "thread-missing", payload.runId ?? "run-missing");
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(stream);
    return;
  }

  sendJson(response, 404, { detail: "not found" });
});

server.listen(port, "127.0.0.1");
```

- [ ] **Step 4: Re-run the focused test to move the failure to web process/config startup**

Run: `npm --prefix web exec playwright test --config playwright.process-restart.config.ts`
Expected: FAIL because the dedicated Playwright config/spec is not implemented yet

- [ ] **Step 5: Commit**

```bash
git add web/tests/e2e/helpers/restartable-backend.mjs
git commit -m "test(v23): add restartable backend stub"
```

### Task 3: Add dedicated process-restart Playwright coverage

**Files:**
- Create: `web/playwright.process-restart.config.ts`
- Create: `web/tests/e2e/true-process-restart-persistence.spec.ts`
- Modify: `web/package.json`

**Interfaces:**
- Consumes:
  - `spawnProcess`, `waitForHttp`, `stopProcess`, `npmCommand`
  - `restartable-backend.mjs`
- Produces:
  - dedicated script `npm --prefix web exec playwright test --config playwright.process-restart.config.ts`
  - main `npm --prefix web run e2e` executes default suite plus restart-proof suite

- [ ] **Step 1: Write the failing restart scenario**

```ts
await expect(page.locator('[data-testid="copilot-assistant-message"]').first()).toContainText(
  "Process restart restore is working.",
);
await expect(page.getByText("Thread history unavailable")).toHaveCount(0);
await expect(page.getByText("Degraded")).toBeVisible();
```

- [ ] **Step 2: Run the focused test to verify the new files are still missing**

Run: `npm --prefix web exec playwright test --config playwright.process-restart.config.ts`
Expected: FAIL with missing config/spec

- [ ] **Step 3: Write the dedicated config and spec**

```ts
// playwright.process-restart.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /true-process-restart-persistence\.spec\.ts/,
  use: {
    headless: true,
  },
});
```

```ts
// true-process-restart-persistence.spec.ts
test("restores a completed thread after a real web-process restart with backend offline", async ({ page }) => {
  // build web
  // start backend stub
  // start web on 3301 with isolated db/catalog paths
  // run starter task and assert assistant reply
  // stop backend, stop web, restart web with same persistence files
  // reopen page and assert restored assistant reply, no history-gap notice, degraded status visible
});
```

```json
// web/package.json
{
  "scripts": {
    "e2e": "playwright test && playwright test --config playwright.process-restart.config.ts"
  }
}
```

- [ ] **Step 4: Run the focused restart suite and then the full browser suite**

Run: `npm --prefix web exec playwright test --config playwright.process-restart.config.ts`
Expected: PASS with 1 passed

Run: `npm --prefix web run e2e`
Expected: PASS with existing suite plus restart suite all green

- [ ] **Step 5: Commit**

```bash
git add web/playwright.process-restart.config.ts web/tests/e2e/true-process-restart-persistence.spec.ts web/package.json
git commit -m "test(v23): prove true process restart persistence"
```

### Task 4: Update status and operator docs

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: new V23 regression and latest suite counts
- Produces: docs reflecting the new restart-proof baseline

- [ ] **Step 1: Write the failing documentation expectation**

```md
- V23 已补齐真实 Web 进程重启持久化证明。
```

- [ ] **Step 2: Run a quick search to verify V23 is not documented yet**

Run: `rg -n "V23|真实进程重启|true process restart" README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md`
Expected: no V23 entry yet

- [ ] **Step 3: Update docs with the new baseline**

```md
- Add one V23 bullet to README current limits.
- Add V23 completion entry and new E2E count to SUMMARY.md.
- Add V23 section and current top-line status to STATUS.md.
- Update SPEC.md gap wording so the “real process restart” proof is no longer missing for the main runtime path.
```

- [ ] **Step 4: Re-run the search and confirm docs now mention V23**

Run: `rg -n "V23|真实进程重启|true process restart" README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md`
Expected: matches in all updated docs

- [ ] **Step 5: Commit**

```bash
git add README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md
git commit -m "docs(v23): record true process restart persistence"
```

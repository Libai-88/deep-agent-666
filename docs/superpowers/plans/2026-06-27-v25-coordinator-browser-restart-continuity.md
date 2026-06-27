# V25 Coordinator Browser Restart Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-level regression proving that a completed coordinator thread reopens cleanly after a real production web-process restart while the backend is offline.

**Architecture:** Build directly on the V23/V24 process-managed restart harness rather than inventing a new startup model. Use the real engineering starter flow for the first session, keep the browser context alive across service restarts, and limit post-restart assertions to what the runtime plus persisted local workbench state actually guarantee.

**Tech Stack:** Playwright browser automation, Next.js 16 production runtime, deterministic AG-UI coordinator fixture, SQLite thread persistence, cached preset-catalog fallback

## Global Constraints

- Reuse the real `next start` production process, real browser UI, real SQLite thread store, and real cached preset catalog file.
- Keep the backend deterministic and offline-safe; do not call external model providers.
- Use condition-based browser waits; do not rely on `networkidle` for the restart continuity path.
- Limit restart assertions to restored assistant chat, persisted timeline/results, and degraded diagnostics; do not require tool-call replay cards after `connect`.
- Do not broaden this phase into restart-time replay or unrelated E2E harness refactors.

---

### Task 1: Add the failing browser continuity proof

**Files:**
- Modify: `web/tests/e2e/true-process-restart-persistence.spec.ts`

**Interfaces:**
- Consumes:
  - `startBackend(): ChildProcess`
  - `startWeb(threadsDbPath: string, runtimeCatalogPath: string): ChildProcess`
  - `waitForHttp(url: string, timeoutMs?: number): Promise<void>`
  - `stopProcess(child: ChildProcess, label: string): Promise<void>`
- Produces:
  - a new browser-driven coordinator restart continuity test using the dedicated process-restart suite

- [ ] **Step 1: Write the failing browser expectation**

```ts
await expect(page.locator('[data-testid="copilot-assistant-message"]').first()).toContainText(
  "Process restart restore is working.",
);
await expect(page.getByTestId("task-timeline-panel").getByText("Inspect the repository architecture.")).toBeVisible();
await expect(page.getByTestId("artifact-final-summary").getByText("Process restart restore is working.")).toBeVisible();
```

- [ ] **Step 2: Run the focused restart suite to verify the browser continuity scenario fails before implementation**

Run: `npm --prefix web run e2e:process-restart`
Expected: FAIL because the process-restart suite only proves request-level restore paths

- [ ] **Step 3: Write the minimal browser continuity scenario**

```ts
test("reopens a completed coordinator thread in the browser after a real web-process restart with backend offline", async ({ page }) => {
  // start backend + web
  // open the app and launch the engineering starter
  // assert first-session summary/timeline/results
  // stop backend + web
  // restart web with same SQLite/catalog paths
  // revisit the origin in the same browser context
  // assert restored assistant message, no history-gap notice, persisted timeline/results, degraded badge
});
```

- [ ] **Step 4: Re-run the focused restart suite to verify all restart proofs pass**

Run: `npm --prefix web run e2e:process-restart`
Expected: PASS with single-agent route restore, coordinator route restore, and browser coordinator continuity all green

- [ ] **Step 5: Commit**

```bash
git add web/tests/e2e/true-process-restart-persistence.spec.ts
git commit -m "test(v25): 增加 coordinator 浏览器重启连续性证明"
```

### Task 2: Update docs and baseline counts

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: the new browser-level coordinator restart continuity proof and the latest E2E count
- Produces: docs reflecting that restart coverage now includes beginner-visible browser continuity, not just route restore

- [ ] **Step 1: Write the failing documentation expectation**

```md
- V25 已补齐 coordinator 在真实进程重启后的浏览器连续性证明。
```

- [ ] **Step 2: Search to confirm V25 is not documented yet**

Run: `rg -n "V25|浏览器连续性|browser continuity|restart continuity" README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md`
Expected: no V25 entry yet

- [ ] **Step 3: Update docs with the new baseline**

```md
- README should say the process-restart suite now covers both route restore and browser-visible coordinator continuity.
- SUMMARY.md should add a V25 completion entry and update the E2E count.
- STATUS.md should add a V25 section and update the top-line phase list.
- SPEC.md should narrow the remaining restart/resume gap wording toward broader entry coverage rather than missing beginner-visible continuity.
```

- [ ] **Step 4: Re-run the search and confirm V25 now appears**

Run: `rg -n "V25|浏览器连续性|browser continuity|restart continuity" README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md`
Expected: matches in the updated docs

- [ ] **Step 5: Commit**

```bash
git add README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md
git commit -m "docs(v25): 记录浏览器重启连续性基线"
```

# V26 True Process Restart History-Gap Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that after a real web-process restart swaps the runtime to an empty SQLite store, a coordinator thread still surfaces the history-gap notice and can replay the last task in the same thread once the backend returns.

**Architecture:** Reuse the V23-V25 process-managed restart harness and keep the browser context alive across service restarts. The new proof should first drive the product into a real `thread_history_unavailable` state, then recover by replaying in-thread and verifying the new runtime store contains fresh history.

**Tech Stack:** Next.js 16, React 19, Playwright, CopilotKit runtime route, restartable Node stub backend

## Global Constraints

- Keep the scope on the existing coordinator recovery UX; do not add backend auto-restart or silent auto-replay behavior.
- Reuse the dedicated process-restart suite instead of broadening the shared Playwright server lifecycle.
- Use condition-based assertions for restart recovery; do not rely on brittle fixed delays except where the product already uses a detection timer.
- Preserve the same browser localStorage context across restarts so the proof exercises real restored-thread behavior.
- If a production fix is required, keep it minimal and local to the existing recovery helpers.

---

### Task 1: Add the failing browser restart history-gap replay proof

**Files:**
- Modify: `web/tests/e2e/true-process-restart-persistence.spec.ts`

**Interfaces:**
- Consumes: `startBackend(): ChildProcess`, `startWeb(threadsDbPath: string, runtimeCatalogPath: string): ChildProcess`, `stopProcess(child, label)`, `waitForHttp(url)`
- Produces: one new Playwright test named `recovers a coordinator thread after a real restart into an empty runtime store once the backend returns`

- [ ] **Step 1: Write the failing test**

```ts
test("recovers a coordinator thread after a real restart into an empty runtime store once the backend returns", async ({ page, request }) => {
  const threadsDbPathBeforeRestart = join(tempDir, "threads-before.db");
  const threadsDbPathAfterRestart = join(tempDir, "threads-after.db");

  // first run against DB A
  // restart web against DB B with backend offline
  // assert "Thread history unavailable"
  // restart backend
  // click "Retry last task"
  // assert assistant recovery text in the same thread
  // call /connect and assert the new runtime store now contains that thread history
});
```

- [ ] **Step 2: Run the focused restart suite to verify the new scenario fails before implementation**

Run: `npm --prefix web exec playwright test --config playwright.process-restart.config.ts --grep "empty runtime store"`
Expected: FAIL because the suite does not yet contain the new restart-to-history-gap replay scenario

- [ ] **Step 3: Implement the minimal proof in the restart suite**

```ts
await expect(page.getByText("Thread history unavailable")).toBeVisible();
await expect(page.getByTestId("runtime-status-badge")).toContainText("Degraded");

backendProcess = startBackend();
await waitForHttp(`${BACKEND_BASE_URL}/health`);

await page.getByRole("button", { name: "Retry last task" }).click();
await expect(page.locator('[data-testid="copilot-assistant-message"]').first()).toContainText(
  "Process restart restore is working.",
);

const restored = await request.post(
  `${WEB_BASE_URL}/api/copilotkit/agent/coordinator-openai-balanced/connect`,
  { data: { threadId, runId: reconnectRunId, messages: [], state: {}, tools: [], context: [], forwardedProps: {} } },
);
expect(await restored.text()).toContain("Process restart restore is working.");
```

- [ ] **Step 4: Re-run the focused restart suite to verify the new proof passes**

Run: `npm --prefix web exec playwright test --config playwright.process-restart.config.ts --grep "empty runtime store"`
Expected: PASS with the new browser proof green

- [ ] **Step 5: Commit**

```bash
git add web/tests/e2e/true-process-restart-persistence.spec.ts
git commit -m "test(v26): prove restart history-gap replay recovery"
```

### Task 2: Apply the minimal recovery fix if the new proof exposes a product gap

**Files:**
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/lib/thread-history-gap.ts`
- Modify: `web/src/lib/retry-run.ts`
- Modify: `web/src/lib/runtime-errors.ts`
- Test: `web/src/lib/__tests__/retry-run.test.ts`
- Test: `web/src/lib/__tests__/runtime-errors.test.ts`

**Interfaces:**
- Consumes: the failing browser proof from Task 1
- Produces: the smallest code change required so the same-thread replay completes after a restart-driven history gap

- [ ] **Step 1: Only if Task 1 fails for a real product reason, write the smallest focused failing unit test that reproduces that reason**

```ts
it("replays the persisted prompt when restored runtime history is empty after restart", () => {
  expect(
    resolvePendingRunPrompt({
      requestedPrompt: "Analyze the repository structure and summarize the major modules.",
      latestUserPrompt: null,
    }),
  ).toBe("Analyze the repository structure and summarize the major modules.");
});
```

- [ ] **Step 2: Run the focused unit test to verify it fails for the expected reason**

Run: `npm --prefix web run test -- retry-run.test.ts`
Expected: FAIL only if Task 1 exposed a real helper bug; otherwise skip Task 2 entirely

- [ ] **Step 3: Write the minimal production fix**

```ts
// Example only if needed:
setRecoverableError((previous) =>
  previous === "thread_history_unavailable" ? null : previous,
);
```

- [ ] **Step 4: Re-run the focused unit test and the focused restart proof**

Run: `npm --prefix web run test -- retry-run.test.ts`
Expected: PASS

Run: `npm --prefix web exec playwright test --config playwright.process-restart.config.ts --grep "empty runtime store"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/app/page.tsx web/src/lib/thread-history-gap.ts web/src/lib/retry-run.ts web/src/lib/runtime-errors.ts web/src/lib/__tests__/retry-run.test.ts web/src/lib/__tests__/runtime-errors.test.ts
git commit -m "fix(v26): recover restart history-gap replay in-thread"
```

### Task 3: Update docs and verification baselines

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: the green V26 restart proof and latest suite counts
- Produces: docs that record the new restart-to-history-gap replay coverage and narrow the remaining recovery gap wording

- [ ] **Step 1: Update the docs with the new V26 baseline**

```md
- `V26` 已补齐真实进程重启后的 history-gap replay proof：runtime SQLite 丢失后，产品仍会提示 `Thread history unavailable`，并能在 backend 恢复后于原线程内重放最后任务。
```

- [ ] **Step 2: Verify the docs mention the new baseline and remaining gap wording**

Run: `rg -n "V26|history-gap replay|Thread history unavailable|empty runtime store" README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md`
Expected: matches in all intended docs

- [ ] **Step 3: Run full verification**

Run: `npm --prefix web run typecheck`
Expected: PASS

Run: `npm --prefix web run test`
Expected: PASS with updated vitest totals

Run: `npm --prefix web run build`
Expected: PASS

Run: `npm --prefix web run e2e`
Expected: PASS with shared suite plus expanded process-restart suite all green

Run: `uv run --project agent pytest -v`
Expected: PASS in `agent/`

- [ ] **Step 4: Commit**

```bash
git add README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md docs/superpowers/specs/2026-06-27-v26-true-process-restart-history-gap-replay-design.md docs/superpowers/plans/2026-06-27-v26-true-process-restart-history-gap-replay.md
git commit -m "docs(v26): record restart history-gap replay coverage"
```

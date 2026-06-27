# V24 Coordinator True Process Restart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the process-managed restart proof so a completed coordinator thread is also proven restorable after a real web-process restart with the backend offline.

**Architecture:** Reuse the V23 process-restart harness instead of creating another startup model. Add one focused coordinator restore scenario against the real coordinator route, keep assertions limited to the runtime contract that survives `connect`, and update the docs/status baselines once the new proof is green.

**Tech Stack:** Next.js 16 production runtime, Playwright request API, deterministic AG-UI coordinator fixtures, SQLite thread persistence, cached preset catalog fallback

## Global Constraints

- Reuse the real `next start` production process, real `[[...slug]]` route, real SQLite thread store, and real cached preset catalog file.
- Keep the backend deterministic and offline-safe; do not call external model providers.
- Keep the coordinator restore assertions aligned with the runtime contract on `connect`; do not require replayed tool-call frames if the runtime only restores message history.
- Do not broaden this phase into full browser workbench continuity or unrelated E2E harness refactors.

---

### Task 1: Add the failing coordinator restart proof

**Files:**
- Modify: `web/tests/e2e/true-process-restart-persistence.spec.ts`

**Interfaces:**
- Consumes:
  - `spawnProcess(command: string, args: string[], options: SpawnOptions): ChildProcess`
  - `waitForHttp(url: string, timeoutMs?: number): Promise<void>`
  - `stopProcess(child: ChildProcess, label: string): Promise<void>`
- Produces:
  - a second scenario in the same spec that exercises `/api/copilotkit/agent/coordinator-openai-balanced/run`
  - restored assertions against `/api/copilotkit/agent/coordinator-openai-balanced/connect`

- [ ] **Step 1: Write the failing coordinator expectation**

```ts
expect(firstRunPayload).toContain("Reviewer confirmed the restart proof.");
expect(restoredPayload).toContain("Process restart restore is working.");
```

- [ ] **Step 2: Run the focused restart suite to verify the coordinator scenario fails before implementation**

Run: `npm --prefix web run e2e:process-restart`
Expected: FAIL because the spec only proves the single-agent restart path

- [ ] **Step 3: Write the minimal coordinator restart scenario**

```ts
test("restores a completed coordinator thread after a real web-process restart with backend offline", async ({ request }) => {
  // start backend + web with isolated SQLite/catalog files
  // POST /api/copilotkit/agent/coordinator-openai-balanced/run
  // assert tool-call stream finishes with the expected reviewer/final-summary text
  // stop backend + web
  // restart web with same persistence files
  // assert degraded diagnostics + coordinator connect restore payload
});
```

- [ ] **Step 4: Re-run the focused restart suite to verify both process-restart proofs pass**

Run: `npm --prefix web run e2e:process-restart`
Expected: PASS with the single-agent proof and the new coordinator proof both green

- [ ] **Step 5: Commit**

```bash
git add web/tests/e2e/true-process-restart-persistence.spec.ts
git commit -m "test(v24): 增加 coordinator 真实重启恢复证明"
```

### Task 2: Refresh docs and phase status

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: the new coordinator restart proof and the latest E2E count
- Produces: docs reflecting that true process-restart proof now covers both the main agent route and the coordinator route

- [ ] **Step 1: Write the failing documentation expectation**

```md
- V24 已补齐 coordinator 在真实 Web 进程重启后的恢复证明。
```

- [ ] **Step 2: Search to confirm V24 is not documented yet**

Run: `rg -n "V24|coordinator.*真实|process restart.*coordinator" README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md`
Expected: no V24 entry yet

- [ ] **Step 3: Update the baseline docs**

```md
- README current-limits bullet should say the process-restart suite now covers both single-agent and coordinator restore paths.
- SUMMARY.md should add a V24 completion entry and reflect the new baseline interpretation.
- STATUS.md should add a V24 section and update the top-line phase list.
- SPEC.md should narrow the remaining restart/resume gap wording so coordinator true-process restart is no longer missing.
```

- [ ] **Step 4: Re-run the search and confirm V24 now appears**

Run: `rg -n "V24|coordinator.*真实|process restart.*coordinator" README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md`
Expected: matches in the updated docs

- [ ] **Step 5: Commit**

```bash
git add README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md
git commit -m "docs(v24): 记录 coordinator 重启恢复基线"
```

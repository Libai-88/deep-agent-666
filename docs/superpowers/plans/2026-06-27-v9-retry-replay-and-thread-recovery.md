# V9 Retry Replay And Thread Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product's `Retry last task` recovery flow deterministic and restart-safe by persisting the last runnable user prompt per thread and replaying it when the runtime needs recovery.

**Architecture:** Keep the current CopilotKit runtime, local thread registry, and workbench state model. Add one small frontend replay helper plus one new persisted workbench field so recovery no longer depends on volatile in-memory agent state. Wire the page to save the latest user prompt, seed starter-thread prompts, and reuse that stored prompt when the user triggers recovery. Prove it with unit tests and a browser flow that starts from a restored thread and retries into a fresh assistant response.

**Tech Stack:** Next.js 16, React 19, TypeScript, CopilotKit React Core v2, Vitest, Playwright

## Global Constraints

- Reuse the existing local-first runtime and do not replace the CopilotKit stack.
- Preserve current `retry_last_task` UX copy and action ids unless a test proves a stronger change is required.
- Keep recovery deterministic across refresh/reload by persisting the replay prompt in local storage workbench state.
- Follow TDD: no production code before a failing test.
- Keep doc updates aligned with current shipped behavior and verification counts.

---

### Task 1: Persist Retryable Prompt State

**Files:**
- Create: `web/src/lib/retry-run.ts`
- Test: `web/src/lib/__tests__/retry-run.test.ts`
- Modify: `web/src/lib/workbench-state.ts`
- Modify: `web/src/lib/__tests__/workbench-state.test.ts`
- Modify: `web/src/lib/starter-templates.ts`
- Modify: `web/src/lib/__tests__/starter-templates.test.ts`

**Interfaces:**
- Consumes: `ThreadWorkbenchState`, CopilotKit `Message` shape with `role` and `content`
- Produces: `extractLatestUserPrompt(messages): string | null`
- Produces: `resolvePendingRunPrompt({ requestedPrompt, latestUserPrompt }): string | null`
- Produces: `ThreadWorkbenchState["lastUserPrompt"]: string | null`

- [ ] **Step 1: Write the failing helper and state tests**

```ts
import { describe, expect, it } from "vitest";

import {
  extractLatestUserPrompt,
  resolvePendingRunPrompt,
} from "../retry-run";

describe("retry-run", () => {
  it("extracts the latest user prompt from mixed agent messages", () => {
    expect(
      extractLatestUserPrompt([
        { role: "assistant", content: "Earlier answer" },
        { role: "user", content: ["Inspect", "SUMMARY.md"] },
      ]),
    ).toBe("Inspect SUMMARY.md");
  });

  it("does not inject a duplicate prompt when the latest user message already matches", () => {
    expect(
      resolvePendingRunPrompt({
        requestedPrompt: "Inspect SUMMARY.md",
        latestUserPrompt: "Inspect SUMMARY.md",
      }),
    ).toBeNull();
  });
});
```

```ts
it("persists the last runnable user prompt with the thread workbench state", () => {
  saveWorkbenchState(
    "thread-a",
    {
      ...createEmptyWorkbenchState(),
      lastUserPrompt: "Retry me later",
    },
    storage,
  );

  expect(loadWorkbenchState("thread-a", storage).lastUserPrompt).toBe(
    "Retry me later",
  );
});
```

```ts
it("seeds starter workbench state without dropping the retry prompt field", () => {
  const state = seedWorkbenchForStarterTemplate("research");
  expect(state.lastUserPrompt).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix web run test -- src/lib/__tests__/retry-run.test.ts src/lib/__tests__/workbench-state.test.ts src/lib/__tests__/starter-templates.test.ts`
Expected: FAIL because `retry-run.ts` and `lastUserPrompt` do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function extractLatestUserPrompt(messages: Array<{ role?: string; content?: unknown }>): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    const text = Array.isArray(message.content)
      ? message.content.join(" ")
      : typeof message.content === "string"
        ? message.content
        : String(message.content ?? "");
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized) return normalized;
  }
  return null;
}

export function resolvePendingRunPrompt(input: {
  requestedPrompt?: string | null;
  latestUserPrompt?: string | null;
}): string | null {
  const requestedPrompt = input.requestedPrompt?.replace(/\s+/g, " ").trim() ?? "";
  const latestUserPrompt = input.latestUserPrompt?.replace(/\s+/g, " ").trim() ?? "";
  if (!requestedPrompt || requestedPrompt === latestUserPrompt) {
    return null;
  }
  return requestedPrompt;
}
```

```ts
export type ThreadWorkbenchState = {
  taskKind: WorkbenchTaskKind;
  todos: WorkbenchTodo[];
  artifacts: WorkbenchArtifact[];
  finalSummary: string | null;
  lastUserPrompt: string | null;
  updatedAt: number;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix web run test -- src/lib/__tests__/retry-run.test.ts src/lib/__tests__/workbench-state.test.ts src/lib/__tests__/starter-templates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/retry-run.ts web/src/lib/__tests__/retry-run.test.ts web/src/lib/workbench-state.ts web/src/lib/__tests__/workbench-state.test.ts web/src/lib/starter-templates.ts web/src/lib/__tests__/starter-templates.test.ts
git commit -m "feat(v9): persist retry prompt context"
```

### Task 2: Wire Page-Level Recovery Replay

**Files:**
- Modify: `web/src/app/page.tsx`
- Test: `web/tests/e2e/retry-last-task-recovery.spec.ts`

**Interfaces:**
- Consumes: `extractLatestUserPrompt(messages)`, `resolvePendingRunPrompt({ requestedPrompt, latestUserPrompt })`
- Produces: `PendingThreadRun.prompt?: string`
- Produces: page-level behavior where `retry_last_task` reuses `workbenchState.lastUserPrompt`

- [ ] **Step 1: Write the failing browser regression**

```ts
test("retries the last stored task from a restored thread", async ({ page }) => {
  // seed localStorage with one valid thread and workbenchState.lastUserPrompt
  // dispatch runtime-error event
  // click Retry last task
  // assert the intercepted run request includes the stored prompt
  // assert a fresh assistant message renders
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run e2e -- retry-last-task-recovery.spec.ts`
Expected: FAIL because `retry_last_task` currently launches without a persisted replay prompt.

- [ ] **Step 3: Write minimal implementation**

```tsx
const retryPrompt = workbenchState.lastUserPrompt ?? undefined;

setPendingThreadRun({
  id: crypto.randomUUID(),
  threadId: activeThread.id,
  agentId: activeAgentId,
  prompt: retryPrompt,
});
```

```tsx
const latestUserPrompt = extractLatestUserPrompt(agent.messages ?? []);

if (latestUserPrompt) {
  setWorkbenchState((previous) =>
    previous.lastUserPrompt === latestUserPrompt
      ? previous
      : { ...previous, lastUserPrompt: latestUserPrompt, updatedAt: Date.now() },
  );
}
```

```tsx
const promptToInject = resolvePendingRunPrompt({
  requestedPrompt: run.prompt,
  latestUserPrompt: extractLatestUserPrompt(agent.messages ?? []),
});

if (promptToInject) {
  agent.addMessage({
    id: crypto.randomUUID(),
    role: "user",
    content: promptToInject,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix web run e2e -- retry-last-task-recovery.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/app/page.tsx web/tests/e2e/retry-last-task-recovery.spec.ts
git commit -m "feat(v9): replay last task after runtime recovery"
```

### Task 3: Verify, Document, And Push

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: shipped V9 behavior and fresh verification output
- Produces: updated product status and next-gap wording

- [ ] **Step 1: Run focused verification**

Run: `npm --prefix web run test -- src/lib/__tests__/retry-run.test.ts src/lib/__tests__/workbench-state.test.ts src/lib/__tests__/starter-templates.test.ts`
Expected: PASS

Run: `npm --prefix web run e2e -- retry-last-task-recovery.spec.ts`
Expected: PASS

- [ ] **Step 2: Run full verification**

Run: `npm --prefix web run typecheck`
Expected: PASS

Run: `npm --prefix web run test`
Expected: PASS

Run: `npm --prefix web run build`
Expected: PASS

Run: `npm --prefix web run e2e`
Expected: PASS

Run: `uv run --project agent pytest -v`
Expected: PASS

- [ ] **Step 3: Update docs with exact shipped behavior**

```md
- `Retry last task` now persists the last runnable user prompt in local workbench state and can replay it after refresh/reload.
- Recovery UX no longer depends on volatile in-memory chat state for the most common retry flow.
```

- [ ] **Step 4: Commit and push**

```bash
git add README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md
git commit -m "docs(v9): record retry replay recovery hardening"
git push origin feat/deepagents-foundation
```

## Self-Review

- Spec coverage: this plan targets the current P0 gap explicitly called out in `README.md`, `SUMMARY.md`, `STATUS.md`, and `SPEC.md` by hardening recovery UX and making retry survive refresh/reload.
- Placeholder scan: no `TODO` / `TBD` placeholders remain.
- Type consistency: `ThreadWorkbenchState.lastUserPrompt`, `extractLatestUserPrompt`, and `resolvePendingRunPrompt` are defined once and reused consistently.

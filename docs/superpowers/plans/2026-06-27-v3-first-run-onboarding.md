# V3 First-Run Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guided first-run onboarding path so a new user can configure the product, launch a first task, and recover from common runtime problems without guesswork.

**Architecture:** Keep the existing one-page workbench and add a thin onboarding decision layer in front of it. V3 stays frontend-local: a typed first-run state resolver decides whether to render configuration guidance, starter templates, recovery notices, or the existing workbench. Starter template clicks reuse the current thread/workbench model and trigger the existing agent runtime rather than introducing a second app flow.

**Tech Stack:** Next.js 16, React 19, TypeScript, @copilotkit/react-core v2, @ag-ui/client, Vitest, Playwright

## Global Constraints

- Preserve the current one-web + one-agent process topology; do not introduce new mandatory services in V3.
- Keep the current workspace-root contract and permission model intact.
- Do not replace the current workbench layout; layer onboarding on top of it.
- Keep V3 scoped to a single onboarding phase: first-run gate, starter templates, readable empty states, and recovery hooks.
- Do not add multi-workspace switching, account/login, cloud sync, or backend architecture changes in this phase.
- Every code change in this phase must end with runnable verification and a commit.

---

## File Map

### New Library Files

- Create: `web/src/lib/first-run-state.ts`
  - Resolve onboarding state from preset availability, thread availability, and recoverable error signals.
- Create: `web/src/lib/starter-templates.ts`
  - Centralize starter template definitions and helper utilities for mapping a template to a first task.
- Create: `web/src/lib/runtime-errors.ts`
  - Normalize runtime/configuration failures into typed recoverable error codes and actions.

### New Tests

- Create: `web/src/lib/__tests__/first-run-state.test.ts`
  - Verify state resolution for each launch condition.
- Create: `web/src/lib/__tests__/starter-templates.test.ts`
  - Verify template catalog shape and template-to-thread/task behavior.
- Create: `web/src/lib/__tests__/runtime-errors.test.ts`
  - Verify error normalization and action mapping.
- Create: `web/src/components/__tests__/FirstRunGate.test.tsx`
  - Verify unconfigured and recoverable-error rendering.
- Create: `web/src/components/__tests__/StarterTemplatePanel.test.tsx`
  - Verify template groups and click affordances.
- Create: `web/src/components/__tests__/WorkbenchStatusNotice.test.tsx`
  - Verify workbench notice messages and actions.

### New Components

- Create: `web/src/components/FirstRunGate.tsx`
  - Render onboarding guidance before the workbench when the user cannot yet start.
- Create: `web/src/components/StarterTemplatePanel.tsx`
  - Render engineering/research/general starter templates for the first task path.
- Create: `web/src/components/WorkbenchStatusNotice.tsx`
  - Render actionable recovery notices inside the workbench.

### Existing Files To Modify

- Modify: `web/src/app/page.tsx`
  - Add first-run state routing, starter template flow, and workbench notice integration.
- Modify: `web/src/app/providers.tsx`
  - Capture runtime errors into a UI-consumable channel instead of only logging to the console.
- Modify: `web/src/lib/thread-registry.ts`
  - Add a helper for creating a thread seeded with a starter template title if needed.
- Modify: `web/src/lib/workbench-state.ts`
  - Add a small helper to seed task kind and clear stale onboarding artifacts when a starter template launches.
- Modify: `web/tests/e2e/smoke.spec.ts`
  - Add first-run onboarding and recovery assertions.
- Modify: `web/tests/e2e/chat-smoke.spec.ts`
  - Update the shell smoke to remain compatible with the onboarding layer.

## Task 1: Add Typed First-Run State And Recovery Mapping

**Files:**
- Create: `web/src/lib/first-run-state.ts`
- Create: `web/src/lib/runtime-errors.ts`
- Create: `web/src/lib/__tests__/first-run-state.test.ts`
- Create: `web/src/lib/__tests__/runtime-errors.test.ts`

**Interfaces:**
- Consumes:
  - `type LocalThread` from `web/src/lib/thread-registry.ts`
  - `type AgentPresetCatalog` from `web/src/lib/agent-presets.ts`
  - `type CatalogSource` from `web/src/lib/preset-catalog.ts`
- Produces:
  - `export type FirstRunState = "checking" | "unconfigured" | "ready-no-thread" | "ready-active-thread" | "recoverable-error";`
  - `export type RecoverableErrorCode = "backend_unreachable" | "no_available_presets" | "configuration_failed" | "thread_missing_or_invalid" | "runtime_request_failed";`
  - `export type RecoverableAction = { label: string; action: "retry_connection" | "open_settings" | "configure_provider" | "retry_save" | "check_base_url" | "create_recommended_thread" | "retry_last_task"; };`
  - `export type FirstRunResolutionInput = { isChecking: boolean; catalog: AgentPresetCatalog; catalogSource: CatalogSource; threads: LocalThread[]; activeThreadId: string | null; recoverableError: RecoverableErrorCode | null; };`
  - `export function resolveFirstRunState(input: FirstRunResolutionInput): FirstRunState`
  - `export function resolveRecoverableActions(code: RecoverableErrorCode): RecoverableAction[]`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { resolveFirstRunState } from "../first-run-state";
import { resolveRecoverableActions } from "../runtime-errors";

describe("first-run-state", () => {
  it("returns unconfigured when no presets are available after checking", () => {
    expect(
      resolveFirstRunState({
        isChecking: false,
        catalog: { defaultPresetId: null, presets: [] },
        catalogSource: "fallback",
        threads: [],
        activeThreadId: null,
        recoverableError: null,
      }),
    ).toBe("unconfigured");
  });

  it("returns ready-no-thread when presets exist but no thread is active", () => {
    expect(
      resolveFirstRunState({
        isChecking: false,
        catalog: {
          defaultPresetId: "openai-balanced",
          presets: [
            {
              id: "openai-balanced",
              label: "OpenAI / Balanced",
              provider: "openai",
              permissionMode: "balanced",
            },
          ],
        },
        catalogSource: "live",
        threads: [],
        activeThreadId: null,
        recoverableError: null,
      }),
    ).toBe("ready-no-thread");
  });

  it("returns recoverable-error when a runtime failure is present", () => {
    expect(
      resolveFirstRunState({
        isChecking: false,
        catalog: {
          defaultPresetId: "openai-balanced",
          presets: [
            {
              id: "openai-balanced",
              label: "OpenAI / Balanced",
              provider: "openai",
              permissionMode: "balanced",
            },
          ],
        },
        catalogSource: "live",
        threads: [],
        activeThreadId: null,
        recoverableError: "runtime_request_failed",
      }),
    ).toBe("recoverable-error");
  });
});

describe("runtime-errors", () => {
  it("maps backend_unreachable to retry and settings actions", () => {
    expect(resolveRecoverableActions("backend_unreachable")).toEqual([
      { label: "Retry connection", action: "retry_connection" },
      { label: "Open settings", action: "open_settings" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix web run test -- --run src/lib/__tests__/first-run-state.test.ts src/lib/__tests__/runtime-errors.test.ts`

Expected: FAIL with module-not-found errors for `../first-run-state` and `../runtime-errors`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/lib/runtime-errors.ts
export type RecoverableErrorCode =
  | "backend_unreachable"
  | "no_available_presets"
  | "configuration_failed"
  | "thread_missing_or_invalid"
  | "runtime_request_failed";

export type RecoverableAction = {
  label: string;
  action:
    | "retry_connection"
    | "open_settings"
    | "configure_provider"
    | "retry_save"
    | "check_base_url"
    | "create_recommended_thread"
    | "retry_last_task";
};

export function resolveRecoverableActions(
  code: RecoverableErrorCode,
): RecoverableAction[] {
  switch (code) {
    case "backend_unreachable":
      return [
        { label: "Retry connection", action: "retry_connection" },
        { label: "Open settings", action: "open_settings" },
      ];
    case "no_available_presets":
      return [{ label: "Configure provider", action: "configure_provider" }];
    case "configuration_failed":
      return [
        { label: "Retry save", action: "retry_save" },
        { label: "Check base URL", action: "check_base_url" },
      ];
    case "thread_missing_or_invalid":
      return [{ label: "Create recommended thread", action: "create_recommended_thread" }];
    case "runtime_request_failed":
      return [{ label: "Retry last task", action: "retry_last_task" }];
  }
}
```

```ts
// web/src/lib/first-run-state.ts
import type { AgentPresetCatalog } from "./agent-presets";
import type { CatalogSource } from "./preset-catalog";
import type { LocalThread } from "./thread-registry";
import type { RecoverableErrorCode } from "./runtime-errors";

export type FirstRunState =
  | "checking"
  | "unconfigured"
  | "ready-no-thread"
  | "ready-active-thread"
  | "recoverable-error";

export type FirstRunResolutionInput = {
  isChecking: boolean;
  catalog: AgentPresetCatalog;
  catalogSource: CatalogSource;
  threads: LocalThread[];
  activeThreadId: string | null;
  recoverableError: RecoverableErrorCode | null;
};

export function resolveFirstRunState(
  input: FirstRunResolutionInput,
): FirstRunState {
  if (input.isChecking) {
    return "checking";
  }

  if (input.recoverableError) {
    return "recoverable-error";
  }

  if (input.catalog.presets.length === 0) {
    return "unconfigured";
  }

  if (!input.activeThreadId) {
    return "ready-no-thread";
  }

  const hasActiveThread = input.threads.some((thread) => thread.id === input.activeThreadId);
  return hasActiveThread ? "ready-active-thread" : "recoverable-error";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix web run test -- --run src/lib/__tests__/first-run-state.test.ts src/lib/__tests__/runtime-errors.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/first-run-state.ts web/src/lib/runtime-errors.ts web/src/lib/__tests__/first-run-state.test.ts web/src/lib/__tests__/runtime-errors.test.ts
git commit -m "feat(v3): add first-run state resolver"
```

## Task 2: Add Starter Template Catalog And Launch Helpers

**Files:**
- Create: `web/src/lib/starter-templates.ts`
- Create: `web/src/lib/__tests__/starter-templates.test.ts`
- Modify: `web/src/lib/thread-registry.ts`
- Modify: `web/src/lib/workbench-state.ts`

**Interfaces:**
- Consumes:
  - `type WorkbenchTaskKind` and `createEmptyWorkbenchState` from `web/src/lib/workbench-state.ts`
  - `type AgentPresetId` and `resolveDefaultPresetId` from `web/src/lib/agent-presets.ts`
  - `createLocalThread` from `web/src/lib/thread-registry.ts`
- Produces:
  - `export type StarterTemplateCategory = "engineering" | "research" | "general";`
  - `export type StarterTemplate = { id: string; category: StarterTemplateCategory; title: string; prompt: string; suggestedThreadTitle: string; };`
  - `export const STARTER_TEMPLATES: readonly StarterTemplate[]`
  - `export function groupStarterTemplates(templates: readonly StarterTemplate[]): Record<StarterTemplateCategory, StarterTemplate[]>`
  - `export function createStarterThread(presetId: AgentPresetId, template: StarterTemplate): LocalThread`
  - `export function seedWorkbenchForStarterTemplate(taskKind: WorkbenchTaskKind): ThreadWorkbenchState`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import {
  STARTER_TEMPLATES,
  createStarterThread,
  groupStarterTemplates,
  seedWorkbenchForStarterTemplate,
} from "../starter-templates";

describe("starter-templates", () => {
  it("groups templates by category", () => {
    const grouped = groupStarterTemplates(STARTER_TEMPLATES);

    expect(grouped.engineering.length).toBeGreaterThan(0);
    expect(grouped.research.length).toBeGreaterThan(0);
    expect(grouped.general.length).toBeGreaterThan(0);
  });

  it("creates a starter thread title from the chosen template", () => {
    const template = STARTER_TEMPLATES[0];
    const thread = createStarterThread("openai-balanced", template);

    expect(thread.presetId).toBe("openai-balanced");
    expect(thread.title).toBe(template.suggestedThreadTitle);
  });

  it("seeds a clean workbench state for the selected task kind", () => {
    const state = seedWorkbenchForStarterTemplate("research");

    expect(state.taskKind).toBe("research");
    expect(state.todos).toEqual([]);
    expect(state.artifacts).toEqual([]);
    expect(state.finalSummary).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run test -- --run src/lib/__tests__/starter-templates.test.ts`

Expected: FAIL with `Cannot find module '../starter-templates'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/lib/starter-templates.ts
import type { AgentPresetId } from "./agent-presets";
import { createLocalThread, type LocalThread } from "./thread-registry";
import {
  createEmptyWorkbenchState,
  type ThreadWorkbenchState,
  type WorkbenchTaskKind,
} from "./workbench-state";

export type StarterTemplateCategory = "engineering" | "research" | "general";

export type StarterTemplate = {
  id: string;
  category: StarterTemplateCategory;
  title: string;
  prompt: string;
  suggestedThreadTitle: string;
};

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id: "engineering-analyze-repo",
    category: "engineering",
    title: "Analyze the repository structure",
    prompt: "Analyze this repository structure and summarize the major modules.",
    suggestedThreadTitle: "Analyze repository structure",
  },
  {
    id: "engineering-find-risks",
    category: "engineering",
    title: "Find risky files and TODOs",
    prompt: "Find risky files or TODOs and propose the next engineering tasks.",
    suggestedThreadTitle: "Find risky files and TODOs",
  },
  {
    id: "research-read-docs",
    category: "research",
    title: "Summarize project docs",
    prompt: "Read the workspace docs and summarize the current project direction.",
    suggestedThreadTitle: "Summarize project docs",
  },
  {
    id: "research-compare-examples",
    category: "research",
    title: "Compare against official examples",
    prompt: "Compare the current implementation against official CopilotKit examples.",
    suggestedThreadTitle: "Compare against official examples",
  },
  {
    id: "general-explain-workspace",
    category: "general",
    title: "Explain this workspace",
    prompt: "Explain what this workspace is and how the agent can help me here.",
    suggestedThreadTitle: "Explain this workspace",
  },
  {
    id: "general-next-step",
    category: "general",
    title: "Show the next recommended step",
    prompt: "Inspect the current thread and show the next recommended step.",
    suggestedThreadTitle: "Show next step",
  },
];

export function groupStarterTemplates(
  templates: readonly StarterTemplate[],
): Record<StarterTemplateCategory, StarterTemplate[]> {
  return {
    engineering: templates.filter((template) => template.category === "engineering"),
    research: templates.filter((template) => template.category === "research"),
    general: templates.filter((template) => template.category === "general"),
  };
}

export function createStarterThread(
  presetId: AgentPresetId,
  template: StarterTemplate,
): LocalThread {
  return {
    ...createLocalThread(presetId),
    title: template.suggestedThreadTitle,
  };
}

export function seedWorkbenchForStarterTemplate(
  taskKind: WorkbenchTaskKind,
): ThreadWorkbenchState {
  return {
    ...createEmptyWorkbenchState(),
    taskKind,
  };
}
```

```ts
// web/src/lib/thread-registry.ts
export function renameThread(
  thread: LocalThread,
  title: string,
): LocalThread {
  return {
    ...thread,
    title,
    updatedAt: Date.now(),
  };
}
```

```ts
// web/src/lib/workbench-state.ts
export function resetWorkbenchStateForTaskKind(
  taskKind: WorkbenchTaskKind,
): ThreadWorkbenchState {
  return {
    ...createEmptyWorkbenchState(),
    taskKind,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix web run test -- --run src/lib/__tests__/starter-templates.test.ts src/lib/__tests__/thread-registry.test.ts src/lib/__tests__/workbench-state.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/starter-templates.ts web/src/lib/__tests__/starter-templates.test.ts web/src/lib/thread-registry.ts web/src/lib/workbench-state.ts
git commit -m "feat(v3): add starter template helpers"
```

## Task 3: Build The First-Run Gate, Starter Panel, And Workbench Notice

**Files:**
- Create: `web/src/components/FirstRunGate.tsx`
- Create: `web/src/components/StarterTemplatePanel.tsx`
- Create: `web/src/components/WorkbenchStatusNotice.tsx`
- Create: `web/src/components/__tests__/FirstRunGate.test.tsx`
- Create: `web/src/components/__tests__/StarterTemplatePanel.test.tsx`
- Create: `web/src/components/__tests__/WorkbenchStatusNotice.test.tsx`

**Interfaces:**
- Consumes:
  - `type FirstRunState` from `web/src/lib/first-run-state.ts`
  - `type RecoverableAction` from `web/src/lib/runtime-errors.ts`
  - `type StarterTemplate` from `web/src/lib/starter-templates.ts`
- Produces:
  - `export function FirstRunGate(props: { title: string; description: string; actions: RecoverableAction[]; onAction: (action: RecoverableAction["action"]) => void; }): JSX.Element`
  - `export function StarterTemplatePanel(props: { templates: readonly StarterTemplate[]; onSelect: (template: StarterTemplate) => void; }): JSX.Element`
  - `export function WorkbenchStatusNotice(props: { title: string; description: string; actions: RecoverableAction[]; onAction: (action: RecoverableAction["action"]) => void; }): JSX.Element`

- [ ] **Step 1: Write the failing component tests**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FirstRunGate } from "../FirstRunGate";
import { StarterTemplatePanel } from "../StarterTemplatePanel";
import { WorkbenchStatusNotice } from "../WorkbenchStatusNotice";
import { STARTER_TEMPLATES } from "@/lib/starter-templates";

describe("FirstRunGate", () => {
  it("renders recovery actions", () => {
    const html = renderToStaticMarkup(
      <FirstRunGate
        title="Configure your providers"
        description="No launchable presets are available yet."
        actions={[{ label: "Configure provider", action: "configure_provider" }]}
        onAction={() => {}}
      />,
    );

    expect(html).toContain("Configure your providers");
    expect(html).toContain("Configure provider");
  });
});

describe("StarterTemplatePanel", () => {
  it("renders grouped starter templates", () => {
    const html = renderToStaticMarkup(
      <StarterTemplatePanel
        templates={STARTER_TEMPLATES}
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain("Engineering");
    expect(html).toContain("Research");
    expect(html).toContain("General");
  });
});

describe("WorkbenchStatusNotice", () => {
  it("renders a recoverable runtime message", () => {
    const html = renderToStaticMarkup(
      <WorkbenchStatusNotice
        title="Backend unavailable"
        description="The agent backend could not be reached."
        actions={[{ label: "Retry connection", action: "retry_connection" }]}
        onAction={() => {}}
      />,
    );

    expect(html).toContain("Backend unavailable");
    expect(html).toContain("Retry connection");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix web run test -- --run src/components/__tests__/FirstRunGate.test.tsx src/components/__tests__/StarterTemplatePanel.test.tsx src/components/__tests__/WorkbenchStatusNotice.test.tsx`

Expected: FAIL with module-not-found errors for the new components.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/components/FirstRunGate.tsx
import type { RecoverableAction } from "@/lib/runtime-errors";

export function FirstRunGate({
  title,
  description,
  actions,
  onAction,
}: {
  title: string;
  description: string;
  actions: RecoverableAction[];
  onAction: (action: RecoverableAction["action"]) => void;
}) {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {actions.map((action) => (
          <button
            key={action.action}
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm"
            onClick={() => onAction(action.action)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// web/src/components/StarterTemplatePanel.tsx
import type { StarterTemplate } from "@/lib/starter-templates";
import { groupStarterTemplates } from "@/lib/starter-templates";

const LABELS = {
  engineering: "Engineering",
  research: "Research",
  general: "General",
} as const;

export function StarterTemplatePanel({
  templates,
  onSelect,
}: {
  templates: readonly StarterTemplate[];
  onSelect: (template: StarterTemplate) => void;
}) {
  const grouped = groupStarterTemplates(templates);

  return (
    <section className="flex h-full flex-col gap-6 px-6 py-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Start with a guided task</h2>
        <p className="text-sm text-muted-foreground">
          Pick a starter task to see how the agent works in this workspace.
        </p>
      </div>
      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((key) => (
        <div key={key} className="space-y-2">
          <h3 className="text-sm font-semibold">{LABELS[key]}</h3>
          <div className="grid gap-2">
            {grouped[key].map((template) => (
              <button
                key={template.id}
                type="button"
                className="rounded-lg border border-border px-4 py-3 text-left"
                onClick={() => onSelect(template)}
              >
                <div className="font-medium">{template.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{template.prompt}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
```

```tsx
// web/src/components/WorkbenchStatusNotice.tsx
import type { RecoverableAction } from "@/lib/runtime-errors";

export function WorkbenchStatusNotice({
  title,
  description,
  actions,
  onAction,
}: {
  title: string;
  description: string;
  actions: RecoverableAction[];
  onAction: (action: RecoverableAction["action"]) => void;
}) {
  return (
    <div className="border-b border-border bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.action}
              type="button"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
              onClick={() => onAction(action.action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix web run test -- --run src/components/__tests__/FirstRunGate.test.tsx src/components/__tests__/StarterTemplatePanel.test.tsx src/components/__tests__/WorkbenchStatusNotice.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/components/FirstRunGate.tsx web/src/components/StarterTemplatePanel.tsx web/src/components/WorkbenchStatusNotice.tsx web/src/components/__tests__/FirstRunGate.test.tsx web/src/components/__tests__/StarterTemplatePanel.test.tsx web/src/components/__tests__/WorkbenchStatusNotice.test.tsx
git commit -m "feat(v3): add onboarding UI surfaces"
```

## Task 4: Wire Onboarding Into The Page Shell And Runtime Error Flow

**Files:**
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/providers.tsx`

**Interfaces:**
- Consumes:
  - `resolveFirstRunState` from `web/src/lib/first-run-state.ts`
  - `resolveRecoverableActions` from `web/src/lib/runtime-errors.ts`
  - `STARTER_TEMPLATES`, `createStarterThread`, and `seedWorkbenchForStarterTemplate` from `web/src/lib/starter-templates.ts`
  - `type Message` from `@ag-ui/core`
  - `useAgent` from `@copilotkit/react-core/v2`
  - `runAgent(parameters?: RunAgentParameters)` from `AbstractAgent`
- Produces:
  - top-level first-run routing in `HomePageContent`
  - starter template click behavior that seeds thread/workbench state and runs the first task
  - providers-level runtime error capture exposed via `window` event dispatch

- [ ] **Step 1: Write the failing verification expectation**

Add a targeted integration-style test near existing page behavior checks:

```ts
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage onboarding shell", () => {
  it("renders starter template copy when the product is ready without an active thread", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("Start with a guided task");
  });
});
```

If server rendering `HomePage` is too coupled to `next/navigation`, instead add a more local page-shell test around a newly extracted pure helper component in the implementation.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run test -- --run src/components/__tests__/StarterTemplatePanel.test.tsx`

Expected: FAIL or no coverage of the page shell, proving the page does not yet route into onboarding.

- [ ] **Step 3: Write minimal implementation**

Use a providers-level event bridge for runtime failures:

```tsx
// web/src/app/providers.tsx
onError={(event) => {
  console.error("[copilotkit]", event);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("deep-agent-666.runtime-error", {
        detail: { source: "copilotkit", event },
      }),
    );
  }
}}
```

In `page.tsx`, add onboarding state and starter flow:

```tsx
const [catalogState, setCatalogState] = useState<CatalogState>({
  catalog: { defaultPresetId: null, presets: [] },
  source: "fallback",
});
const [catalogChecking, setCatalogChecking] = useState(true);
const [recoverableError, setRecoverableError] = useState<RecoverableErrorCode | null>(null);

useEffect(() => {
  let cancelled = false;
  setCatalogChecking(true);
  fetchCatalogStateFromUrl("/api/copilotkit/info")
    .then((state) => {
      if (cancelled) return;
      setCatalogState(state);
      setRecoverableError(
        state.catalog.presets.length === 0 ? "no_available_presets" : null,
      );
    })
    .catch(() => {
      if (cancelled) return;
      setRecoverableError("backend_unreachable");
    })
    .finally(() => {
      if (!cancelled) setCatalogChecking(false);
    });
  return () => {
    cancelled = true;
  };
}, []);

useEffect(() => {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.source === "copilotkit") {
      setRecoverableError("runtime_request_failed");
    }
  };

  window.addEventListener("deep-agent-666.runtime-error", handler);
  return () => window.removeEventListener("deep-agent-666.runtime-error", handler);
}, []);

const firstRunState = resolveFirstRunState({
  isChecking: catalogChecking,
  catalog: catalogState.catalog,
  catalogSource: catalogState.source,
  threads,
  activeThreadId: activeThread?.id ?? null,
  recoverableError,
});
```

When a starter template is selected, seed the thread, workbench state, and run the agent:

```tsx
const handleSelectStarterTemplate = useCallback(
  async (template: StarterTemplate) => {
    const presetId =
      currentPreset?.id ??
      resolveDefaultPresetId(catalogState.catalog) ??
      "openai-balanced";

    const thread = createStarterThread(presetId, template);
    const seededWorkbench = seedWorkbenchForStarterTemplate(template.category);

    setThreads((previous) => [thread, ...previous]);
    saveWorkbenchState(thread.id, seededWorkbench);
    setWorkbenchState(seededWorkbench);
    setThreadId(thread.id);
    setRecoverableError(null);

    if (!agent) {
      return;
    }

    agent.setMessages([
      {
        id: crypto.randomUUID(),
        role: "user",
        content: template.prompt,
      },
    ]);

    await agent.runAgent();
  },
  [agent, catalogState.catalog, currentPreset, setThreadId],
);
```

Render rules:

- `checking` -> simple loading shell
- `unconfigured` -> `FirstRunGate`
- `ready-no-thread` -> `StarterTemplatePanel`
- `recoverable-error` with no active thread -> `FirstRunGate`
- otherwise render the existing workbench, with `WorkbenchStatusNotice` above the chat area when `recoverableError` is non-null

- [ ] **Step 4: Run verification**

Run:
- `npm --prefix web run test -- --run src/lib/__tests__/first-run-state.test.ts src/lib/__tests__/starter-templates.test.ts src/lib/__tests__/runtime-errors.test.ts`
- `npm --prefix web run test -- --run src/components/__tests__/FirstRunGate.test.tsx src/components/__tests__/StarterTemplatePanel.test.tsx src/components/__tests__/WorkbenchStatusNotice.test.tsx`
- `npm --prefix web run typecheck`

Expected:
- all targeted unit/component tests PASS
- typecheck PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/app/page.tsx web/src/app/providers.tsx
git commit -m "feat(v3): wire onboarding flow into workbench shell"
```

## Task 5: Prove The First-Run Path With E2E

**Files:**
- Modify: `web/tests/e2e/smoke.spec.ts`
- Modify: `web/tests/e2e/chat-smoke.spec.ts`

**Interfaces:**
- Consumes:
  - onboarding copy from `FirstRunGate` and `StarterTemplatePanel`
  - thread storage key `deep-agent-666.threads`
  - workbench storage key prefix `deep-agent-666.workbench`
- Produces:
  - E2E evidence for unconfigured, ready-no-thread, and starter-template launch paths

- [ ] **Step 1: Write the failing E2E expectations**

Add two new tests:

```ts
test("unconfigured launch shows the first-run gate", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("deep-agent-666.threads");
  });

  await page.route("**/api/copilotkit/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "fallback",
        defaultPresetId: null,
        presets: [],
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByText("Configure your providers")).toBeVisible();
});

test("configured launch without a thread shows starter templates", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("deep-agent-666.threads");
  });

  await page.route("**/api/copilotkit/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "live",
        defaultPresetId: "openai-balanced",
        presets: [
          {
            id: "openai-balanced",
            label: "OpenAI / Balanced",
            permission_mode: "balanced",
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByText("Start with a guided task")).toBeVisible();
});
```

- [ ] **Step 2: Run E2E to verify they fail**

Run: `npm --prefix web run e2e -- --grep "first-run gate|starter templates"`

Expected: FAIL because the onboarding UI does not yet exist in the page shell.

- [ ] **Step 3: Complete the E2E coverage**

Extend `smoke.spec.ts` with a starter-template launch assertion after the page wiring from Task 4:

```ts
test("starter template click creates a thread and opens the workbench", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("deep-agent-666.threads");
  });

  await page.route("**/api/copilotkit/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "live",
        defaultPresetId: "openai-balanced",
        presets: [
          {
            id: "openai-balanced",
            label: "OpenAI / Balanced",
            permission_mode: "balanced",
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Analyze the repository structure" }).click();

  await expect(page.getByRole("heading", { name: "Deep Agent 666" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Engineering" })).toBeVisible();
});
```

Keep `chat-smoke.spec.ts` aligned by allowing either the starter panel or the active workbench shell:

```ts
await expect(
  page.getByRole("heading", {
    name: /Deep Agent 666|Start with a guided task|Configure your providers/,
  }),
).toBeVisible();
```

- [ ] **Step 4: Run full verification**

Run:
- `npm --prefix web run test`
- `npm --prefix web run typecheck`
- `npm --prefix web run build`
- `npm --prefix web run e2e`

Expected:
- vitest PASS
- typecheck PASS
- build PASS
- e2e PASS including first-run onboarding scenarios

- [ ] **Step 5: Commit**

```bash
git add web/tests/e2e/smoke.spec.ts web/tests/e2e/chat-smoke.spec.ts
git commit -m "test(v3): cover onboarding launch path"
```

## Self-Review

### Spec coverage

- First-run gate: covered by Tasks 1, 3, and 4
- Starter task templates: covered by Tasks 2, 3, and 4
- Readable empty states: covered by Tasks 3 and 4
- Recovery hooks: covered by Tasks 1, 3, and 4
- E2E proof of onboarding path: covered by Task 5

No spec requirement is left without a task.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task names exact files, interfaces, commands, and expected results.

### Type consistency

- `FirstRunState`, `RecoverableErrorCode`, `RecoverableAction`, and `StarterTemplate` are introduced once and referenced consistently.
- The runtime launch path consistently uses `agent.runAgent()` after seeding the agent message state.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-27-v3-first-run-onboarding.md`.

Given the updated thread objective, proceed with inline execution in this session using `superpowers:executing-plans`. No additional user choice gate is required.

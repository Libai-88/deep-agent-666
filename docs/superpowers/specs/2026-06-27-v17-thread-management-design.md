# V17 Thread Management Design

## Goal

Make local threads manageable for beginners by adding in-product rename and delete actions, plus predictable fallback behavior when the active thread is removed.

## Why This Matters

The product now supports:

- durable local threads
- starter-task creation
- restored-thread continuity
- workbench persistence

But a long-lived general-purpose agent still feels incomplete because thread management stops at selection. Once a beginner accumulates threads, they cannot:

- rename vague auto-generated titles
- delete obsolete threads
- recover gracefully after deleting the currently active thread

That is a product usability gap, not just an internal tooling issue.

## Scope

V17 covers four concrete improvements:

1. Thread list items get rename and delete actions.
2. Renaming a thread updates its local title and bumps it to the top of the recency order.
3. Deleting a thread removes both the local thread entry and its persisted workbench state.
4. If the deleted thread is active, the app automatically falls back to the next most recent thread, or to the starter gate when none remain.

## Non-Goals

- No remote thread APIs or CopilotKit Intelligence thread management.
- No multi-select, archive, or search yet.
- No server persistence for threads; V17 stays local-first.
- No redesign of the broader shell layout.

## Approach Options

### Option A: Thread actions only in the page state layer

Pros:

- Fast to implement
- Minimal file changes

Cons:

- Harder to unit test ordering and fallback behavior
- More stateful logic stays trapped in the already-large page file

### Option B: Extract small pure helpers for local thread operations

Pros:

- Lets us unit test sorting and active-thread fallback
- Keeps interaction logic clearer
- Matches the existing repo pattern of pushing storage/state rules into `lib/`

Cons:

- Slightly more upfront code

### Recommendation

Choose Option B.

This keeps the user-facing behavior straightforward while avoiding more fragile page-only logic.

## Data Model Design

The current `LocalThread` shape is sufficient:

- `id`
- `title`
- `presetId`
- `updatedAt`

V17 does not add fields. Instead, it adds helper behavior:

- stable sorting by `updatedAt` descending
- thread-title normalization for rename input
- next-thread resolution after delete

## UI Design

### Thread List Actions

Each thread row gets:

- rename action
- delete action

Rename should be inline:

- click rename
- replace title with an input
- `Enter` saves
- `Escape` cancels
- blank-only titles are rejected by falling back to the current title

Delete can use a lightweight confirmation step; the key requirement is to avoid silent accidental loss.

### Active-Thread Fallback

When deleting:

- if the deleted thread is not active, keep the current thread
- if the deleted thread is active and another thread exists, switch to the most recent remaining thread
- if the deleted thread is the last one, clear `threadId` and return to the starter-template gate

### Persistence Rules

Deleting a thread must also delete:

- `deep-agent-666.workbench.<threadId>`

Otherwise, local storage accumulates stale workbench state and future restored-thread logic becomes harder to reason about.

## Testing Strategy

### Unit

Add pure tests for:

- thread sorting by `updatedAt`
- rename helper preserving valid titles
- next-thread resolution after delete

### Browser

Add one Playwright regression that proves:

1. rename an older thread and watch it move to the top
2. delete the active thread and fall back to the remaining thread
3. delete the last thread and return to the starter gate

This should run against the real shell state with mocked preset/runtime info, not just component rendering.

## Risks

- Inline rename controls can accidentally trigger thread selection if click handling is sloppy.
- Delete fallback must stay aligned with the query-param router state; otherwise the URL can point to a deleted thread.
- Sorting should remain deterministic even after multiple rapid updates.

## Verification

- Focused:
  - `npm --prefix web run test -- src/lib/__tests__/thread-registry.test.ts`
  - `npm --prefix web run e2e -- thread-management.spec.ts`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`

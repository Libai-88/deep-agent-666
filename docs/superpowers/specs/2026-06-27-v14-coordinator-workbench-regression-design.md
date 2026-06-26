# V14 Coordinator Workbench Regression Design

## Problem

The product already renders coordinator sub-agent cards and syncs delegation state into the workbench, but there is still no browser-level proof that a real coordinator run produces the expected beginner-facing surfaces together: starter launch, planner/executor/reviewer cards, timeline tasks, and results summary.

At the same time, the timeline still exposes raw internal status values like `in_progress`, which is not ideal for beginners.

## Goal

Add a deterministic coordinator browser regression and polish the workbench timeline copy so the coordinator experience is both tested and easier for beginners to understand.

## Constraints

- Reuse the existing starter-template launch path instead of inventing a hidden test-only entry.
- Keep the regression deterministic with mocked AG-UI SSE streams.
- Do not change the coordinator protocol shape; only improve presentation and coverage.
- Preserve the current workbench state model.

## Design

1. Add human-readable timeline labels for `pending`, `in_progress`, and `completed`.
2. Add a new Playwright scenario that:
   - boots from the normal starter template panel
   - runs against the coordinator agent id
   - streams planner, executor, and reviewer tool calls
   - streams coordinator state snapshots with delegation tasks and a final summary
3. Assert the user-facing outcome across the three main surfaces:
   - chat area: planner/executor/reviewer activity cards
   - timeline panel: delegation tasks with readable statuses
   - results panel: final summary and delegation-derived findings

## Expected Outcome

- The most important mixed-scene coordinator path now has a deterministic browser regression.
- Beginner-facing workbench copy becomes clearer without changing runtime behavior.
- The next remaining stability gap moves further away from core user flow correctness and closer to broader restart/resume depth and real-backend variance.

# V4 Local Durable Thread Runtime Implementation Plan

> **For agentic workers:** Execute inline in this session with TDD. Steps use checkbox syntax for tracking.

**Goal:** Wire the real CopilotKit runtime route to a file-backed SQLite runner so local thread runtime state is durable by default.

**Architecture:** Reuse the existing runtime catalog and agent wiring, but replace the route-level in-memory runner with `SqliteAgentRunner`. Keep `a2ui`, `openGenerativeUI`, and MCP wiring unchanged.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Playwright, `@copilotkit/runtime` v2, `@copilotkit/sqlite-runner`

## Global Constraints

- Do not change the single-web + single-agent topology.
- Do not introduce cloud-only Intelligence mode.
- Do not remove existing runtime features while adding durability.
- Keep the runtime DB path configurable via environment variable.
- End with verification, commit, push, and process cleanup.

## Task 1: Prove The Live Route Is Still Ephemeral

**Files:**
- Create: `web/src/app/api/copilotkit/[[...slug]]/route.test.ts`

- [x] Write route-level tests that require `SqliteAgentRunner`.
- [x] Run `npm --prefix web run test -- --run src/app/api/copilotkit/[[...slug]]/route.test.ts`
- [x] Confirm the failure points at the current `InMemoryAgentRunner` wiring.

## Task 2: Switch The Live Route To SQLite Durability

**Files:**
- Modify: `web/src/app/api/copilotkit/[[...slug]]/route.ts`
- Modify: `web/src/lib/copilotkit-runtime-v2.ts`

- [ ] Export the runtime pieces needed for durable route wiring.
- [ ] Replace the route-level `InMemoryAgentRunner` with `SqliteAgentRunner`.
- [ ] Honor `COPILOTKIT_THREADS_DB_PATH`, defaulting to `./data/threads.db`.
- [ ] Preserve existing cached handler behavior, A2UI config, MCP config, and runtime catalog loading.
- [ ] Run `npm --prefix web run test -- --run src/app/api/copilotkit/[[...slug]]/route.test.ts`

## Task 3: Keep Helper Coverage Green

**Files:**
- Reuse: `web/src/lib/__tests__/copilot-runtime.test.ts`

- [ ] Run `npm --prefix web run test -- --run src/lib/__tests__/copilot-runtime.test.ts src/lib/__tests__/runtime-agents.test.ts src/app/api/preset-state/route.test.ts`
- [ ] Fix any regressions caused by the route/runtime alignment.

## Task 4: Update Product Docs

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/ADR/003-runner-choice.md`
- Modify: `docs/superpowers/SPEC.md`

- [ ] Remove stale claims that backend runtime state cannot survive restart.
- [ ] Record SQLite durability as the current default runner choice.
- [ ] Update architecture summaries that still mention `InMemoryAgentRunner`.

## Task 5: Full Verification And Version Control

- [ ] Run:
  - `npm --prefix web run test`
  - `npm --prefix web run typecheck`
  - `npm --prefix web run build`
- [ ] If feasible without destabilizing the environment, run:
  - `npm --prefix web run e2e`
- [ ] Commit with a conventional message.
- [ ] Push `feat/deepagents-foundation`.
- [ ] Stop any unnecessary `node`, `python`, or `git` processes started during verification.


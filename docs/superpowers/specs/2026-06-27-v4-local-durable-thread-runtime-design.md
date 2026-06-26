# V4 Local Durable Thread Runtime Design

> Status: Approved for implementation
> Date: 2026-06-27
> Scope: V4 `本地持久化线程运行时`

## Goal

Replace the current in-memory CopilotKit runtime runner with a file-backed local runner so thread execution state survives routine web and agent restarts in the default single-machine deployment.

The V4 success path is:

`启动产品 -> 发起任务 -> 刷新页面或重启 Web/FastAPI -> 重新打开线程 -> 运行时线程状态仍可继续`

This phase closes the biggest remaining product gap after V3 onboarding: durability.

## Why This Phase Exists

The product is already usable:

- V1 completed the mixed engineering and research workbench.
- V2 hardened release startup and deployment.
- V3 made first launch understandable.

The remaining weakness is continuity:

- the frontend persists local thread metadata
- the active backend runtime still uses `InMemoryAgentRunner`
- the README still states backend graph state does not survive restart

For a Codex-like local agent, this is below the expected baseline. A user must be able to come back to a thread without silently losing runtime state.

## Official Reference Basis

This phase follows the official CopilotKit runtime guidance already present in the local runtime skill references:

- `agent-runners.md`
  - `InMemoryAgentRunner` is development-only and ephemeral
  - `SqliteAgentRunner` is the supported local durable runner
- `agent-runners-sqlite.md`
  - recommended shape: `new SqliteAgentRunner({ dbPath: "./data/threads.db" })`
  - suitable for single-node or shared-volume local deployments

This phase does **not** adopt CopilotKit Intelligence mode because that is a managed cloud service and does not match the current local-first product direction.

## In Scope

V4 introduces four concrete changes:

1. `Runtime route durability`
   - the live `[[...slug]]` route uses `SqliteAgentRunner`

2. `Stable local database path`
   - the runtime writes thread state to a file path controlled by `COPILOTKIT_THREADS_DB_PATH`

3. `Durability verification`
   - unit and E2E coverage prove the live route is no longer ephemeral

4. `Documentation correction`
   - status, README, summary, and ADR text reflect the new reality

## Out Of Scope

This phase intentionally avoids unrelated platform expansion:

- cloud sync
- multi-node distributed execution
- retention policies
- auth and rate limiting
- replacing local thread metadata storage in the browser
- full chat round-trip persistence guarantees beyond the runtime runner boundary

## Product Success Criteria

V4 is successful when all of the following are true:

1. The live runtime route no longer instantiates `InMemoryAgentRunner`.
2. The live runtime route uses a file-backed SQLite path by default.
3. The path can be overridden with `COPILOTKIT_THREADS_DB_PATH`.
4. Existing runtime wiring stays intact:
   - A2UI enabled
   - MCP app wiring preserved
   - runtime catalog and agent registration preserved
5. Documentation no longer claims runtime state is inherently ephemeral.

## Current Baseline

Current code state:

- `web/src/app/api/copilotkit/[[...slug]]/route.ts`
  - uses `new InMemoryAgentRunner()`
- `web/src/lib/copilot-runtime.ts`
  - already contains a valid SQLite-backed runtime helper
- `web/package.json`
  - already depends on `@copilotkit/sqlite-runner` and `better-sqlite3`
- `.env.example`
  - already exposes `COPILOTKIT_THREADS_DB_PATH=./data/threads.db`

This means the missing piece is not dependency setup. The missing piece is wiring the actual production runtime route to the durable runner.

## Architecture Direction

The implementation should keep one runtime stack and remove the split-brain between helper code and live route code.

### Desired runtime shape

```ts
new CopilotRuntime({
  agents: buildRuntimeAgents(catalog, baseUrl),
  runner: new SqliteAgentRunner({ dbPath }),
  a2ui: {},
  openGenerativeUI: true,
  mcpApps: resolveMcpAppsConfig(process.env.MCP_SERVER_URL),
});
```

### Path policy

- default path: `./data/threads.db`
- override path: `process.env.COPILOTKIT_THREADS_DB_PATH`
- file-backed path must be explicit, not implicit `":memory:"`

## Decision Update

ADR-003 currently records `InMemoryAgentRunner` as a temporary safety choice. V4 updates that decision:

- the temporary decision has served its purpose
- the live route must now move to SQLite durability
- the ADR should record that the active architecture is SQLite-backed, with the earlier in-memory phase preserved only as historical context

## Testing Strategy

Testing must prove the live route changed, not just the helper library.

### Unit tests

- route-level test that the live route constructs `SqliteAgentRunner`
- route-level test that explicit `COPILOTKIT_THREADS_DB_PATH` is honored
- route-level test that the default `./data/threads.db` path is used when unset

### Existing helper tests

- keep `web/src/lib/__tests__/copilot-runtime.test.ts`
- ensure helper-level coverage still passes after route alignment

### End-to-end evidence

- keep current shell and thread boot flow passing
- if feasible in this phase, add one assertion that a durable DB file is created after runtime activity

## Risks And Tradeoffs

### Risk: historical `INCOMPLETE_STREAM` concern resurfaces

This product previously moved away from SQLite runner because of event finalization concerns.

Mitigation:

- switch only the official runtime route first
- keep route tests focused on wiring correctness
- verify browser smoke and runtime info flows after the change

### Risk: documentation drift

The repository already contains stale statements about runtime persistence.

Mitigation:

- update README, STATUS, SUMMARY, and ADR in the same phase as the code change

## Exit Criteria

This phase is complete when:

1. the live route uses `SqliteAgentRunner`
2. the runner path is explicitly file-backed
3. tests covering the route pass
4. documentation matches the implemented runtime architecture


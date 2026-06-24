# Task 4 Report: Next.js Runtime Bridge and App Shell

## Status

Implemented the Task 4 Next.js App Router frontend/runtime shell in the allowed `web/` scope, including:

- CopilotKit v2 client provider mounted from a client-only `providers.tsx`
- Next.js App Router multi-route runtime endpoint using `createCopilotRuntimeHandler`
- `LangGraphHttpAgent` bridge wiring for all backend preset IDs from `agent/app/presets.py`
- local thread persistence via `SqliteAgentRunner`
- a basic app shell with preset switching and `CopilotChat`

## TDD Evidence

### Red

Created the failing tests first:

- `web/src/lib/__tests__/agent-presets.test.ts`
- `web/src/lib/__tests__/copilot-runtime.test.ts`

Initial focused run:

```powershell
npm --prefix web run test -- --run src/lib/__tests__/agent-presets.test.ts src/lib/__tests__/copilot-runtime.test.ts
```

Observed failure:

- `ENOENT: no such file or directory, open '...\\web\\package.json'`

This was the expected pre-implementation failure.

Before production code, I extended the test surface slightly to also lock down:

- default preset alignment to `openai-balanced`
- backend URL trailing-slash normalization

### Green

Implemented the minimum runtime/helper code and app shell needed to satisfy the tests and task requirements, then ran the focused tests:

```powershell
npm run test -- --run src/lib/__tests__/agent-presets.test.ts src/lib/__tests__/copilot-runtime.test.ts
```

Observed result:

- `2` test files passed
- `5` tests passed

### Fixes During Verification

Broader verification exposed a few real integration issues, which were fixed immediately:

1. TypeScript 6 deprecation error for `baseUrl`
   - Added `"ignoreDeprecations": "6.0"` to `web/tsconfig.json`

2. `CopilotChat` does not accept the `instructions` prop in the installed CopilotKit version
   - Removed the invalid prop from `web/src/app/page.tsx`

3. Provider `onError` callback shape differs from the referenced skill text
   - Aligned `web/src/app/providers.tsx` to the installed `CopilotErrorEvent` shape (`type`, `error`, `context`)

4. Next build eagerly evaluated the API route and tried to open SQLite before the DB directory existed
   - Switched the route to lazy handler initialization
   - Ensured the SQLite parent directory is created inside `createRuntime()`

## Verification

Fresh successful verification commands:

```powershell
npm run test
npm run typecheck
npm run build
```

Observed results:

- `npm run test`: passed, `2` files / `5` tests green
- `npm run typecheck`: passed
- `npm run build`: passed, `/api/copilotkit/[...slug]` emitted as a dynamic route

## Files Changed

- `web/package.json`
- `web/tsconfig.json`
- `web/next.config.ts`
- `web/vitest.config.ts`
- `web/src/app/globals.css`
- `web/src/app/layout.tsx`
- `web/src/app/providers.tsx`
- `web/src/app/page.tsx`
- `web/src/app/api/copilotkit/[...slug]/route.ts`
- `web/src/lib/agent-presets.ts`
- `web/src/lib/copilot-runtime.ts`
- `web/src/lib/__tests__/agent-presets.test.ts`
- `web/src/lib/__tests__/copilot-runtime.test.ts`

## Concern

The task brief required the `web/package.json` lint script value verbatim:

```json
"lint": "next lint"
```

With the installed `next@16.2.9`, that command does not run successfully in this environment. The observed failure was:

- `Invalid project directory provided, no such directory: ...\\web\\lint`

I left the script as specified by the task brief rather than silently changing the required verbatim value. Tests, typecheck, and production build all pass.

## Task 4 Lint Fix

Follow-up scope was intentionally limited to the official Next 16 lint migration:

- replaced `web/package.json` script from `next lint` to `eslint .`
- added `eslint` and `eslint-config-next` to `web/package.json` dev dependencies
- added `web/eslint.config.mjs` using the official flat-config style for Next.js + TypeScript:
  - `eslint-config-next/core-web-vitals`
  - `eslint-config-next/typescript`
  - `globalIgnores(...)` for build artifacts

### Lint Fix TDD Evidence

#### Red

Added a narrow failing test in:

- `web/src/lib/__tests__/copilot-runtime.test.ts`

Focused red command:

```powershell
npm run test -- --run src/lib/__tests__/copilot-runtime.test.ts
```

Observed failure:

- expected lint script `eslint .`
- received `next lint`

#### Green

Applied the minimal official Next 16 ESLint CLI setup and reran the focused test:

```powershell
npm run test -- --run src/lib/__tests__/copilot-runtime.test.ts
```

Observed result:

- `1` file passed
- `3` tests passed

### Lint Fix Verification

Fresh successful commands after the fix:

```powershell
npm run lint
npm run test
npm run typecheck
npm run build
```

Observed results:

- `npm run lint`: passed with `eslint .`
- `npm run test`: passed, `2` files / `6` tests green
- `npm run typecheck`: passed
- `npm run build`: passed

### Updated Concern

The original Task 4 lint concern is resolved. The `web` project now uses the official Next 16 ESLint CLI setup and `npm run lint` succeeds.

# Task 1 Report: Repository Foundation

## Scope

Implemented the minimal root repository foundation in `D:/AgentBuild/.worktrees/deepagents-foundation` for Task 1 only.

Files changed:

- `package.json`
- `.env.example`
- `.gitignore`
- `tests/smoke/test_repo_layout.py`
- `agent/.gitkeep`
- `web/.gitkeep`

Directories created:

- `agent/`
- `web/`

## TDD Record

### Red

Created `tests/smoke/test_repo_layout.py` exactly as specified in the brief, then ran:

```bash
python -m pytest tests/smoke/test_repo_layout.py -v
```

Observed the expected failure:

- `missing repository paths: ['package.json', '.env.example', 'agent', 'web']`

This confirmed the test was failing for the intended missing-foundation behavior.

### Green

Added the minimal scaffolding required by the brief:

- root `package.json` with the exact required scripts and `concurrently` dev dependency
- root `.env.example` with the exact required environment keys and values
- appended the required root ignore entries to `.gitignore`
- created empty `agent/` and `web/` directories to satisfy the required smoke test behavior

Re-ran:

```bash
python -m pytest tests/smoke/test_repo_layout.py -v
```

Result:

- `1 passed`

## Follow-up Durability Fix

### Red

Identified that the original Task 1 result was not durable across fresh checkouts because Git does not track empty directories.

Updated the focused smoke test to require tracked placeholders:

- `agent/.gitkeep`
- `web/.gitkeep`

Then ran:

```bash
python -m pytest tests/smoke/test_repo_layout.py -v
```

Observed the expected failure:

- `missing repository paths: ['agent\\.gitkeep', 'web\\.gitkeep']`

This confirmed the durability gap with the original empty-directory-only approach.

### Green

Added the smallest tracked placeholders needed to make the repository layout durable in Git:

- `agent/.gitkeep`
- `web/.gitkeep`

Re-ran:

```bash
python -m pytest tests/smoke/test_repo_layout.py -v
```

Result:

- `1 passed`

## Verification

Focused verification run:

```bash
python -m pytest tests/smoke/test_repo_layout.py -v
```

Result:

- pass

Additional verification:

```bash
npm run
```

Result:

- succeeded
- listed the expected root scripts:
  - `dev:web`
  - `dev:agent`
  - `dev`
  - `test:web`
  - `test:agent`
  - `test`
  - `typecheck:web`
  - `lint:web`

## Notes / Concerns

- `agent/` and `web/` now contain tracked `.gitkeep` placeholders so the Task 1 repository layout survives fresh checkouts.

## Reviewer Fix: PowerShell Entry Points And Layout Contract

### Red

Reviewer finding 1 identified that the required root scripts were still relying on npm's default Windows shell behavior instead of explicitly executing through PowerShell.

Ran this focused check before editing `package.json`:

```bash
@'
const pkg = require('./package.json');
const required = ['dev:web','dev:agent','dev','test:web','test:agent','test'];
const missing = required.filter((name) => !pkg.scripts[name].startsWith('powershell -NoProfile -Command '));
if (missing.length) {
  console.error(`scripts missing explicit PowerShell wrapper: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('all required scripts use explicit PowerShell wrappers');
'@ | node -
```

Observed expected failure:

- `scripts missing explicit PowerShell wrapper: dev:web, dev:agent, dev, test:web, test:agent, test`

Reviewer finding 2 identified that the smoke test had been broadened beyond the public Task 1 contract by asserting `.gitkeep` placeholders.

### Green

Made the minimal Task 1-only corrections:

- restored `tests/smoke/test_repo_layout.py` to assert only the intended repository layout contract:
  - `package.json`
  - `.env.example`
  - `agent/`
  - `web/`
- kept `agent/.gitkeep` and `web/.gitkeep` as internal durability files, without exposing them through the smoke-test contract
- updated the root required scripts in `package.json` so they explicitly invoke `powershell -NoProfile -Command`

Re-ran the required focused smoke test:

```bash
python -m pytest tests/smoke/test_repo_layout.py -v
```

Result:

- `1 passed`

Ran the focused script-wrapper verification again:

```bash
@'
const pkg = require('./package.json');
const required = ['dev:web','dev:agent','dev','test:web','test:agent','test'];
const missing = required.filter((name) => !pkg.scripts[name].startsWith('powershell -NoProfile -Command '));
if (missing.length) {
  console.error(`scripts missing explicit PowerShell wrapper: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('all required scripts use explicit PowerShell wrappers');
'@ | node -
```

Result:

- `all required scripts use explicit PowerShell wrappers`

Ran a focused command to demonstrate that the root script surface still resolves after the `package.json` change:

```bash
npm run
```

Relevant output:

- `Lifecycle scripts included in deep-agent-666:`
- `test` resolves to the explicit PowerShell command wrapper
- available scripts include:
  - `dev:web`
  - `dev:agent`
  - `dev`
  - `test:web`
  - `test:agent`
- each of those required Task 1 entrypoints now resolves to a `powershell -NoProfile -Command ...` script

## Second Follow-up Fix: Remaining PowerShell Entry Points

### Red

The remaining Task 1 gap was that `typecheck:web` and `lint:web` were still root developer entrypoints that bypassed the explicit PowerShell wrapper.

Ran the expanded focused check before editing `package.json`:

```bash
@'
const pkg = require('./package.json');
const required = ['dev:web','dev:agent','dev','test:web','test:agent','test','typecheck:web','lint:web'];
const missing = required.filter((name) => !pkg.scripts[name].startsWith('powershell -NoProfile -Command '));
if (missing.length) {
  console.error(`scripts missing explicit PowerShell wrapper: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('all required scripts use explicit PowerShell wrappers');
'@ | node -
```

Observed expected failure:

- `scripts missing explicit PowerShell wrapper: typecheck:web, lint:web`

### Green

Made the smallest Task 1 fix in `package.json`:

- wrapped `typecheck:web` in `powershell -NoProfile -Command`
- wrapped `lint:web` in `powershell -NoProfile -Command`

Re-ran the required focused smoke test:

```bash
python -m pytest tests/smoke/test_repo_layout.py -v
```

Result:

- `1 passed`

Re-ran the expanded eight-script wrapper verification:

```bash
@'
const pkg = require('./package.json');
const required = ['dev:web','dev:agent','dev','test:web','test:agent','test','typecheck:web','lint:web'];
const missing = required.filter((name) => !pkg.scripts[name].startsWith('powershell -NoProfile -Command '));
if (missing.length) {
  console.error(`scripts missing explicit PowerShell wrapper: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('all required scripts use explicit PowerShell wrappers');
'@ | node -
```

Result:

- `all required scripts use explicit PowerShell wrappers`

Confirmed the root script surface still resolves:

```bash
npm run
```

Relevant output:

- `typecheck:web` resolves to `powershell -NoProfile -Command "npm --prefix web run typecheck"`
- `lint:web` resolves to `powershell -NoProfile -Command "npm --prefix web run lint"`

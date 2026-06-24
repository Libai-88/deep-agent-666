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

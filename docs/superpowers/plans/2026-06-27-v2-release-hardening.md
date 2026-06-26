# V2 Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the V1 mixed-scenario agent into a stable, repeatable V2 release candidate with deterministic CI, production startup, and Docker delivery.

**Architecture:** Keep the current split architecture: one FastAPI backend and one Next.js frontend. V2 hardens the runtime around production-mode startup (`next build` + `next start`), removes dev-only assumptions from CI/E2E, and adds a Docker stack that mirrors the real product topology instead of requiring ad-hoc local commands.

**Tech Stack:** Next.js 16, React 19, TypeScript, CopilotKit Runtime v2, FastAPI, uv, Playwright, GitHub Actions, Docker, Docker Compose

## Global Constraints

- Preserve the current one-web + one-agent process topology; do not introduce new mandatory services in V2.
- Keep the current workspace-root contract (`AGENT_WORKSPACE_ROOT`) and permission model intact.
- CI must validate the same production startup path that users rely on, not a weaker dev-only fallback.
- Docker delivery must boot the web app and agent together with environment variables only; no manual in-container edits.
- Reuse official CopilotKit patterns from `D:\AgentBuild\copilotkit-repo`, especially `examples/integrations/langgraph-fastapi` and showcase runtime guidance.
- Every code change in this phase must end with runnable verification and a commit.

---

## File Map

### Runtime / Scripts

- Modify: `package.json`
  - Add root production start/build scripts for the two-process topology.
- Modify: `web/playwright.config.ts`
  - Point the local E2E harness at the hardened startup path.
- Modify: `web/src/app/api/copilotkit/[[...slug]]/route.ts`
  - Keep runtime route compatible with production startup assumptions.

### CI

- Modify: `.github/workflows/ci.yml`
  - Run frontend build once, use production `next start` in E2E, and persist Playwright artifacts on failure.

### Docker

- Create: `docker/Dockerfile.web`
  - Build and run the Next.js frontend in production mode.
- Create: `docker/Dockerfile.agent`
  - Build and run the FastAPI/uv backend.
- Create: `docker-compose.yml`
  - Provide a production-like two-service stack.
- Create: `.env.example`
  - Document runtime environment variables for local/prod deployment.

### Docs / Verification

- Modify: `README.md` or create `README.md`
  - Add stable run, CI, and Docker usage instructions if missing.
- Create: `docs/releases/v2-release-hardening.md`
  - Capture V2 scope, commands, and known operational constraints.

## Task 1: Harden Production Startup And Local E2E Path

**Files:**
- Modify: `package.json`
- Modify: `web/playwright.config.ts`
- Test: `web/tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes:
  - root scripts in `package.json`
  - existing backend entrypoint `uv run --project agent uvicorn app.main:app`
- Produces:
  - `npm run build:web`
  - `npm run start:web`
  - `npm run start:agent`
  - `npm run start`
  - Playwright `webServer.command` aligned to production startup

- [ ] **Step 1: Write the failing verification expectation**

Add or update a config-focused test so the repo asserts production startup is part of the supported workflow:

```ts
expect(rootPackage.scripts?.["build:web"]).toBe(
  'powershell -NoProfile -Command "npm --prefix web run build"',
);
expect(rootPackage.scripts?.["start:web"]).toBe(
  'powershell -NoProfile -Command "npm --prefix web run start"',
);
expect(rootPackage.scripts?.start).toContain("concurrently");
expect(playwrightConfig).toContain('command: "npm run start"');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run test -- --run src/lib/__tests__/copilot-runtime.test.ts`

Expected: FAIL because the scripts/config assertions do not match the current repo.

- [ ] **Step 3: Write minimal implementation**

Update the root scripts so production startup is first-class:

```json
{
  "scripts": {
    "build:web": "powershell -NoProfile -Command \"npm --prefix web run build\"",
    "start:web": "powershell -NoProfile -Command \"npm --prefix web run start\"",
    "start:agent": "powershell -NoProfile -Command \"uv run --project agent uvicorn app.main:app --host 127.0.0.1 --port 8123\"",
    "start": "powershell -NoProfile -Command \"concurrently -n web,agent -c cyan,green 'npm run start:web' 'npm run start:agent'\""
  }
}
```

Point Playwright at:

```ts
webServer: {
  command: "npm run start",
  cwd: "..",
  reuseExistingServer: true,
  url: "http://127.0.0.1:3000",
}
```

- [ ] **Step 4: Run verification**

Run:
- `npm --prefix web run test -- --run src/lib/__tests__/copilot-runtime.test.ts`
- `npm --prefix web run build`
- `npm --prefix web run e2e`

Expected:
- targeted config test PASS
- Next build PASS
- Playwright smoke PASS against production startup

- [ ] **Step 5: Commit**

```bash
git add package.json web/playwright.config.ts web/src/lib/__tests__/copilot-runtime.test.ts
git commit -m "feat(v2): harden production startup path"
```

## Task 2: Make CI Use The Real Release Path

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes:
  - `npm run start`
  - `npm --prefix web run build`
  - `uv run --project agent pytest`
- Produces:
  - CI e2e job that builds once, starts web in production mode, and uploads artifacts/logs on failure

- [ ] **Step 1: Write the failing verification expectation**

Add a lightweight repo-config test or inspect the workflow directly in review:

```ts
expect(ciWorkflow).toContain("npm --prefix web run build");
expect(ciWorkflow).toContain("npm --prefix web run start");
expect(ciWorkflow).toContain("actions/upload-artifact");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run test -- --run src/lib/__tests__/copilot-runtime.test.ts`

Expected: FAIL until the workflow assertions match.

- [ ] **Step 3: Write minimal implementation**

Adjust `.github/workflows/ci.yml` so:
- frontend build happens before E2E
- E2E starts backend with uv and frontend with `npm --prefix web run start`
- readiness checks use `curl --retry`
- Playwright report and traces upload on failure

- [ ] **Step 4: Run verification**

Run:
- `npm --prefix web run test -- --run src/lib/__tests__/copilot-runtime.test.ts`
- `python - <<'PY'\nfrom pathlib import Path\ntext = Path('.github/workflows/ci.yml').read_text(encoding='utf-8')\nassert 'upload-artifact' in text\nassert 'npm --prefix web run start' in text\nassert 'npm --prefix web run build' in text\nPY`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml web/src/lib/__tests__/copilot-runtime.test.ts
git commit -m "ci(v2): run e2e against production startup"
```

## Task 3: Add Docker Delivery For Web + Agent

**Files:**
- Create: `docker/Dockerfile.web`
- Create: `docker/Dockerfile.agent`
- Create: `docker-compose.yml`
- Create: `.env.example`

**Interfaces:**
- Consumes:
  - backend module path `app.main:app`
  - frontend production build/start commands
  - env vars `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `AGENT_WORKSPACE_ROOT`, `AGENT_BASE_URL`
- Produces:
  - `docker compose up --build` booting `agent` and `web`

- [ ] **Step 1: Write the failing verification expectation**

Add a smoke-style repository layout assertion:

```py
assert Path("docker/Dockerfile.web").exists()
assert Path("docker/Dockerfile.agent").exists()
assert Path("docker-compose.yml").exists()
assert Path(".env.example").exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/smoke/test_repo_layout.py -v`

Expected: FAIL because the Docker artifacts do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Use the official `langgraph-fastapi` example as the reference shape:
- `docker/Dockerfile.web`: Node 20 image, install `web/`, run `npm run build`, start with `npm run start`
- `docker/Dockerfile.agent`: Python 3.11/3.12 slim, install `uv`, sync/install `agent/`, run uvicorn on `8123`
- `docker-compose.yml`: services `agent` and `web`, `web` depends on `agent`, publish `3000:3000` and `8123:8123`
- `.env.example`: document all required provider/base-url/workspace variables

- [ ] **Step 4: Run verification**

Run:
- `python -m pytest tests/smoke/test_repo_layout.py -v`
- `docker compose config`

Expected:
- repo smoke PASS
- compose config renders successfully

- [ ] **Step 5: Commit**

```bash
git add docker/Dockerfile.web docker/Dockerfile.agent docker-compose.yml .env.example tests/smoke/test_repo_layout.py
git commit -m "feat(v2): add docker delivery stack"
```

## Task 4: Document The V2 Operating Model

**Files:**
- Create or Modify: `README.md`
- Create: `docs/releases/v2-release-hardening.md`

**Interfaces:**
- Consumes:
  - verified commands from Tasks 1-3
- Produces:
  - operator-facing instructions for local run, production start, CI expectations, and Docker boot

- [ ] **Step 1: Write the failing verification expectation**

Document tests should be able to assert the repo now describes:
- local dev
- production run
- Docker run

```py
readme = Path("README.md").read_text(encoding="utf-8")
assert "npm run start" in readme
assert "docker compose up --build" in readme
assert "uv run --project agent pytest -v" in readme
```

- [ ] **Step 2: Run test to verify it fails**

Run a small Python assertion script or pytest target against the README.

- [ ] **Step 3: Write minimal implementation**

Add concise operating docs:
- how to start dev (`npm run dev`)
- how to start prod-like (`npm run build:web` + `npm run start`)
- how to run tests
- how to boot Docker
- what V2 changed versus V1

- [ ] **Step 4: Run verification**

Run:
- `python - <<'PY'\nfrom pathlib import Path\nreadme = Path('README.md').read_text(encoding='utf-8')\nassert 'npm run start' in readme\nassert 'docker compose up --build' in readme\nassert 'uv run --project agent pytest -v' in readme\nPY`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md docs/releases/v2-release-hardening.md
git commit -m "docs(v2): document release hardening workflow"
```

## Self-Review

### Spec coverage

- Stable usable product path: covered by Tasks 1, 2, and 3.
- Official-pattern reuse from CopilotKit: covered by Docker/runtime choices in Tasks 1 and 3.
- Timely version retention: every task ends with a commit and final push can follow execution.
- No extra mandatory services: preserved by the two-service architecture in Tasks 1 and 3.

### Placeholder scan

- No `TODO`/`TBD` placeholders remain.
- Each task has explicit files, commands, and expected verification.
- Docker/CI instructions are concrete and tied to repository paths.

### Type consistency

- Script names are introduced once in Task 1 and reused later.
- Docker environment variable names match current repo conventions.
- CI commands mirror the root/web/agent script layout defined in Task 1.

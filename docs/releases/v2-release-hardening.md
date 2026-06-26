# V2 Release Hardening

## Goal

Move the project from a V1 feature-complete prototype to a V2 release candidate that is:

- stable to start
- easy for beginners to run
- reproducible in CI
- deployable as a two-service container stack

## Supported Run Modes

### Development

```powershell
npm run dev
```

### Production-like local run

```powershell
npm run start
```

### Docker

```powershell
docker compose up --build
```

## Verification Commands

```powershell
python -m pytest tests/smoke/test_repo_layout.py -v
uv run --project agent pytest -v
npm --prefix web run test
npm --prefix web run typecheck
npm --prefix web run build
npm --prefix web run e2e
docker compose config
```

## Notes

- V2 keeps the same one-web + one-agent topology as V1.
- Coordinator remains the main path for balanced/full-access threads.
- A2A research is now opt-in via `ENABLE_A2A_RESEARCH=true` so it does not destabilize the default beginner experience.

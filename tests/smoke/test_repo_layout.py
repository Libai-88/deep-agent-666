from pathlib import Path


REQUIRED_PATHS = [
    Path("package.json"),
    Path(".env.example"),
    Path("agent"),
    Path("web"),
    Path("docker/Dockerfile.web"),
    Path("docker/Dockerfile.agent"),
    Path("docker-compose.yml"),
    Path("docs/releases/v2-release-hardening.md"),
]


def test_required_repository_paths_exist() -> None:
    missing = [str(path) for path in REQUIRED_PATHS if not path.exists()]
    assert missing == [], f"missing repository paths: {missing}"


def test_readme_documents_beginner_run_paths() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")
    assert "npm run dev" in readme
    assert "npm run start" in readme
    assert "docker compose up --build" in readme
    assert "uv run --project agent pytest -v" in readme

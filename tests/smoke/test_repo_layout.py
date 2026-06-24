from pathlib import Path


REQUIRED_PATHS = [
    Path("package.json"),
    Path(".env.example"),
    Path("agent"),
    Path("web"),
    Path("agent/.gitkeep"),
    Path("web/.gitkeep"),
]


def test_required_repository_paths_exist() -> None:
    missing = [str(path) for path in REQUIRED_PATHS if not path.exists()]
    assert missing == [], f"missing repository paths: {missing}"

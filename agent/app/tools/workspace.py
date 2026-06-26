from __future__ import annotations

from pathlib import Path
import subprocess


def resolve_workspace_path(workspace_root: Path, relative_path: str) -> Path:
    root = workspace_root.resolve()
    candidate = (root / relative_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"path is outside the workspace root: {relative_path}")
    return candidate


def list_workspace(workspace_root: Path, relative_path: str = ".") -> str:
    target = resolve_workspace_path(workspace_root, relative_path)
    lines: list[str] = []
    for entry in sorted(target.iterdir(), key=lambda item: (item.is_file(), item.name.lower())):
        suffix = "/" if entry.is_dir() else ""
        lines.append(f"{entry.name}{suffix}")
    return "\n".join(lines)


def search_workspace(workspace_root: Path, query: str, glob: str = "*") -> str:
    matches: list[str] = []
    for path in workspace_root.rglob(glob):
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for line_number, line in enumerate(text.splitlines(), start=1):
            if query.lower() in line.lower():
                relative = path.relative_to(workspace_root)
                matches.append(f"{relative}:{line_number}:{line.strip()}")
    return "\n".join(matches[:200]) or "No matches found."


def read_text_file(workspace_root: Path, path: str) -> str:
    target = resolve_workspace_path(workspace_root, path)
    return target.read_text(encoding="utf-8")


def write_text_file(workspace_root: Path, path: str, content: str) -> str:
    target = resolve_workspace_path(workspace_root, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return f"wrote {target.relative_to(workspace_root)}"


def replace_text_in_file(workspace_root: Path, path: str, old_text: str, new_text: str) -> str:
    target = resolve_workspace_path(workspace_root, path)
    content = target.read_text(encoding="utf-8")
    if old_text not in content:
        raise ValueError("old_text not found in file")
    target.write_text(content.replace(old_text, new_text, 1), encoding="utf-8")
    return f"updated {target.relative_to(workspace_root)}"


def run_command(workspace_root: Path, command: str, cwd: str = ".") -> str:
    target_cwd = resolve_workspace_path(workspace_root, cwd)
    completed = subprocess.run(
        [
            "powershell",
            "-NoLogo",
            "-NoProfile",
            "-Command",
            command,
        ],
        capture_output=True,
        check=False,
        cwd=target_cwd,
        text=True,
        timeout=60,
    )
    stdout = completed.stdout[-8000:] if completed.stdout else ""
    stderr = completed.stderr[-8000:] if completed.stderr else ""
    parts = [f"cwd: {target_cwd}"]
    if stdout:
        parts.append(f"stdout: {stdout}")
    if stderr:
        parts.append(f"stderr: {stderr}")
    parts.append(f"exit_code: {completed.returncode}")
    return "\n".join(parts)

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import re
from typing import Any


# Skip files larger than this when searching (prevents OOM)
_MAX_SEARCH_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Binary extensions to skip when searching
_BINARY_EXTENSIONS = frozenset({
    ".exe", ".dll", ".so", ".dylib", ".bin", ".dat",
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
    ".woff", ".woff2", ".ttf", ".eot",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
    ".pyc", ".pyo", ".pyd",
    ".o", ".a", ".lib",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
})

_A2UI_CATALOG_ID = "deepagent://a2ui-catalog"


def _diff_surface_id(path: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", path).strip("-").lower()
    return f"diff-preview-{slug or 'file'}"


def _diff_preview_payload(
    *,
    path: str,
    summary: str,
    change_type: str,
    before: str,
    after: str,
) -> dict[str, Any]:
    normalized_path = path.replace("\\", "/")
    surface_id = _diff_surface_id(normalized_path)
    return {
        "summary": summary,
        "path": normalized_path,
        "change_type": change_type,
        "before": before,
        "after": after,
        "a2ui_operations": [
            {
                "version": "v0.9",
                "createSurface": {
                    "surfaceId": surface_id,
                    "catalogId": _A2UI_CATALOG_ID,
                },
            },
            {
                "version": "v0.9",
                "updateComponents": {
                    "surfaceId": surface_id,
                    "components": [
                        {
                            "id": "root",
                            "component": "DiffPreview",
                            "filePath": normalized_path,
                            "before": before,
                            "after": after,
                        },
                    ],
                },
            },
        ],
    }


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

        # Skip binary files and files larger than 10 MB
        if path.suffix.lower() in _BINARY_EXTENSIONS:
            continue
        try:
            size = path.stat().st_size
            if size > _MAX_SEARCH_FILE_SIZE:
                continue
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        except OSError:
            continue

        for line_number, line in enumerate(text.splitlines(), start=1):
            if query.lower() in line.lower():
                relative = path.relative_to(workspace_root)
                matches.append(f"{relative}:{line_number}:{line.strip()}")
    return "\n".join(matches[:200]) or "No matches found."


def read_text_file(workspace_root: Path, path: str) -> str:
    target = resolve_workspace_path(workspace_root, path)
    return target.read_text(encoding="utf-8")


def write_text_file(workspace_root: Path, path: str, content: str) -> dict[str, Any]:
    target = resolve_workspace_path(workspace_root, path)
    before = target.read_text(encoding="utf-8") if target.exists() else ""
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    relative = str(target.relative_to(workspace_root)).replace("\\", "/")
    return _diff_preview_payload(
        path=relative,
        summary=f"wrote {relative}",
        change_type="created" if before == "" else "modified",
        before=before,
        after=content,
    )


def replace_text_in_file(workspace_root: Path, path: str, old_text: str, new_text: str) -> dict[str, Any]:
    target = resolve_workspace_path(workspace_root, path)
    content = target.read_text(encoding="utf-8")
    if old_text not in content:
        raise ValueError("old_text not found in file")
    updated = content.replace(old_text, new_text, 1)
    target.write_text(updated, encoding="utf-8")
    relative = str(target.relative_to(workspace_root)).replace("\\", "/")
    return _diff_preview_payload(
        path=relative,
        summary=f"updated {relative}",
        change_type="modified",
        before=content,
        after=updated,
    )


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

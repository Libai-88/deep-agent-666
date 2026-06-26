from __future__ import annotations

from pathlib import Path

from docx import Document
from pypdf import PdfReader

from app.tools.workspace import resolve_workspace_path


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}\n[TRUNCATED]"


def read_document(workspace_root: Path, path: str, max_chars: int = 12000) -> str:
    target = resolve_workspace_path(workspace_root, path)
    suffix = target.suffix.lower()
    if suffix in {".txt", ".md", ".py", ".json", ".yaml", ".yml"}:
        return _truncate(target.read_text(encoding="utf-8"), max_chars)
    if suffix == ".docx":
        document = Document(target)
        text = "\n".join(
            paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()
        )
        return _truncate(text, max_chars)
    if suffix == ".pdf":
        reader = PdfReader(str(target))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return _truncate(text, max_chars)
    raise ValueError(f"unsupported document type: {suffix}")


def inspect_document(
    workspace_root: Path,
    path: str,
    max_excerpt_chars: int = 4000,
) -> str:
    target = resolve_workspace_path(workspace_root, path)
    content = read_document(workspace_root, path, max_excerpt_chars)
    return (
        f"Path: {path}\n"
        f"Type: {target.suffix.lower() or '[none]'}\n"
        f"Size: {target.stat().st_size} bytes\n"
        f"Excerpt:\n{content}"
    )

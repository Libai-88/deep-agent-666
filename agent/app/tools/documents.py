from __future__ import annotations

from pathlib import Path

from docx import Document
from pypdf import PdfReader

from app.tools.workspace import resolve_workspace_path


def read_document(workspace_root: Path, path: str) -> str:
    target = resolve_workspace_path(workspace_root, path)
    suffix = target.suffix.lower()
    if suffix in {".txt", ".md", ".py", ".json", ".yaml", ".yml"}:
        return target.read_text(encoding="utf-8")
    if suffix == ".docx":
        document = Document(target)
        return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
    if suffix == ".pdf":
        reader = PdfReader(str(target))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    raise ValueError(f"unsupported document type: {suffix}")

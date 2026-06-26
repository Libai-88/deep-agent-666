from pathlib import Path

from app.tools.documents import inspect_document, read_document


def test_inspect_document_formats_metadata_and_excerpt(tmp_path: Path):
    workspace = tmp_path
    target = workspace / "notes.md"
    target.write_text("# Title\n\nParagraph one.\nParagraph two.\n", encoding="utf-8")

    result = inspect_document(workspace, "notes.md", max_excerpt_chars=20)

    assert "Path: notes.md" in result
    assert "Type: .md" in result
    assert "Excerpt:" in result


def test_read_document_truncates_large_text(tmp_path: Path):
    workspace = tmp_path
    target = workspace / "long.md"
    target.write_text("A" * 20000, encoding="utf-8")

    result = read_document(workspace, "long.md", max_chars=120)

    assert len(result) <= 160
    assert "[TRUNCATED]" in result

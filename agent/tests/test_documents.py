from pathlib import Path

from app.tools.documents import read_document


def test_read_document_reads_plain_text(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    file_path = workspace / "memo.md"
    file_path.write_text("# Heading\n\nParagraph", encoding="utf-8")

    content = read_document(workspace, "memo.md")

    assert "Heading" in content
    assert "Paragraph" in content

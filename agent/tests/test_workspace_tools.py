from pathlib import Path

from app.tools.workspace import (
    replace_text_in_file,
    resolve_workspace_path,
    run_command,
    write_text_file,
)


def test_resolve_workspace_path_blocks_escape(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    try:
        resolve_workspace_path(workspace, "../outside.txt")
    except ValueError as error:
        assert "outside the workspace root" in str(error)
    else:
        raise AssertionError("expected ValueError for path escape")


def test_replace_text_in_file_edits_in_place(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    file_path = workspace / "note.txt"
    file_path.write_text("hello world", encoding="utf-8")

    result = replace_text_in_file(workspace, "note.txt", "world", "team")

    assert result["summary"] == "updated note.txt"
    assert result["path"] == "note.txt"
    assert result["change_type"] == "modified"
    assert result["before"] == "hello world"
    assert result["after"] == "hello team"
    assert result["a2ui_operations"][0]["createSurface"]["catalogId"] == "deepagent://a2ui-catalog"
    assert result["a2ui_operations"][1]["updateComponents"]["components"][0]["after"] == "hello team"
    assert file_path.read_text(encoding="utf-8") == "hello team"


def test_write_text_file_returns_diff_preview_payload(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    result = write_text_file(workspace, "docs/note.txt", "hello team")

    assert result["summary"] == "wrote docs/note.txt"
    assert result["path"] == "docs/note.txt"
    assert result["change_type"] == "created"
    assert result["before"] == ""
    assert result["after"] == "hello team"
    assert result["a2ui_operations"][0]["createSurface"]["surfaceId"] == "diff-preview-docs-note-txt"
    assert result["a2ui_operations"][1]["updateComponents"]["components"][0]["component"] == "DiffPreview"
    assert result["a2ui_operations"][1]["updateComponents"]["components"][0]["filePath"] == "docs/note.txt"


def test_run_command_returns_stdout(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    result = run_command(workspace, "$PSVersionTable.PSVersion.ToString()", ".")

    assert "exit_code: 0" in result
    assert "stdout:" in result

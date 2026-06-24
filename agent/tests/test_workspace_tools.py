from pathlib import Path

from app.tools.workspace import replace_text_in_file, resolve_workspace_path, run_command


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

    assert "updated" in result
    assert file_path.read_text(encoding="utf-8") == "hello team"


def test_run_command_returns_stdout(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    result = run_command(workspace, "$PSVersionTable.PSVersion.ToString()", ".")

    assert result["exit_code"] == 0
    assert result["stdout"]

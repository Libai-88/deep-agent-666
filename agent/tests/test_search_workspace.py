"""Tests for the newly refactored _build_model_kwargs and search_workspace improvements."""

from pathlib import Path

from app.tools.workspace import search_workspace, _MAX_SEARCH_FILE_SIZE, _BINARY_EXTENSIONS


def test_binary_extension_skipped(tmp_path: Path) -> None:
    """search_workspace skips files with binary extensions."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    bin_file = workspace / "data.bin"
    bin_file.write_bytes(b"\x00\x01\x02\x03")
    txt_file = workspace / "data.txt"
    txt_file.write_text("searchable content")

    result = search_workspace(workspace, "searchable")
    assert "searchable" in result
    # .bin extension should not cause errors
    assert "data.bin" not in result


def test_large_file_skipped(tmp_path: Path) -> None:
    """search_workspace skips files larger than _MAX_SEARCH_FILE_SIZE."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    big_file = workspace / "huge.txt"
    big_file.write_text("x" * (_MAX_SEARCH_FILE_SIZE + 1))
    small_file = workspace / "small.txt"
    small_file.write_text("query")

    result = search_workspace(workspace, "query")
    assert "query" in result
    assert "huge.txt" not in result


def test_search_no_matches(tmp_path: Path) -> None:
    """search_workspace returns 'No matches found.' when nothing matches."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "a.txt").write_text("hello world")

    result = search_workspace(workspace, "nonexistent")
    assert result == "No matches found."


def test_search_case_insensitive(tmp_path: Path) -> None:
    """search_workspace matches case-insensitively."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "test.txt").write_text("Hello World")

    result = search_workspace(workspace, "hello")
    assert "Hello" in result

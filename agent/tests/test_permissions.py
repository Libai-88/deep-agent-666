from app.permissions import PermissionMode, interrupt_config_for_mode, mutable_tool_names


def test_read_only_exposes_no_mutating_tools() -> None:
    assert mutable_tool_names(PermissionMode.READ_ONLY) == set()


def test_balanced_interrupts_mutating_tools() -> None:
    interrupt_map = interrupt_config_for_mode(PermissionMode.BALANCED)
    assert interrupt_map == {
        "replace_text_in_file": True,
        "write_text_file": True,
        "run_command": True,
    }


def test_full_access_has_no_interrupts() -> None:
    assert interrupt_config_for_mode(PermissionMode.FULL_ACCESS) == {}

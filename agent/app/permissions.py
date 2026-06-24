from enum import Enum


class PermissionMode(str, Enum):
    READ_ONLY = "read-only"
    BALANCED = "balanced"
    FULL_ACCESS = "full-access"


def mutable_tool_names(mode: PermissionMode) -> set[str]:
    if mode == PermissionMode.READ_ONLY:
        return set()
    return {"replace_text_in_file", "write_text_file", "run_command"}


def interrupt_config_for_mode(mode: PermissionMode) -> dict[str, bool]:
    if mode == PermissionMode.BALANCED:
        return {
            "replace_text_in_file": True,
            "write_text_file": True,
            "run_command": True,
        }
    return {}

from typing import Literal


TaskKind = Literal["engineering", "research", "general"]


def infer_task_kind(message: str) -> TaskKind:
    lower = message.lower()
    if any(
        word in lower
        for word in (
            "research",
            "report",
            "brief",
            "summarize",
            "summary",
            "document",
            "调研",
            "简报",
            "总结",
            "文档",
        )
    ):
        return "research"
    if any(
        word in lower
        for word in (
            "fix",
            "implement",
            "refactor",
            "test",
            "bug",
            "code",
            "修复",
            "测试",
            "代码",
        )
    ):
        return "engineering"
    return "general"


def task_prompt_fragment(task_kind: TaskKind) -> str:
    if task_kind == "research":
        return (
            "Focus on document understanding, concise findings, and structured summaries. "
            "When possible, cite workspace documents and produce a written result artifact."
        )
    if task_kind == "engineering":
        return (
            "Focus on code changes, verification, and clear change summaries. "
            "Read before editing and verify through commands or tests."
        )
    return "Choose the smallest set of workspace actions required to complete the task."

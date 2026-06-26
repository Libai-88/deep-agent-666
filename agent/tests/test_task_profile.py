from app.task_profile import infer_task_kind, task_prompt_fragment


def test_infer_task_kind_for_research_queries():
    assert (
        infer_task_kind("Read these docs and write a research brief")
        == "research"
    )


def test_infer_task_kind_for_engineering_queries():
    assert infer_task_kind("Fix the failing test and update the file") == "engineering"


def test_infer_task_kind_for_chinese_queries():
    assert infer_task_kind("请调研这些文档并输出简报") == "research"
    assert infer_task_kind("修复失败测试并更新代码") == "engineering"


def test_prompt_fragment_mentions_expected_behavior():
    fragment = task_prompt_fragment("research")
    assert "cite workspace documents" in fragment

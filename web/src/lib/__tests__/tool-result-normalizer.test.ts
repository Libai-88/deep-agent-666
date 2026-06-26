import { describe, expect, it } from "vitest";

import {
  extractFinalSummary,
  inferTaskKindFromMessage,
  normalizeDelegationArtifacts,
  normalizeDelegationsToTodos,
  normalizeToolCallToArtifacts,
  normalizeToolCallToTodos,
} from "../tool-result-normalizer";

describe("tool-result-normalizer", () => {
  it("converts write_todos payloads into workbench todos", () => {
    const todos = normalizeToolCallToTodos({
      name: "write_todos",
      status: "complete",
      args: {
        todos: [
          { content: "Read SUMMARY.md", status: "completed" },
          { content: "Draft report", status: "pending" },
        ],
      },
    });

    expect(todos.map((todo) => todo.content)).toEqual([
      "Read SUMMARY.md",
      "Draft report",
    ]);
  });

  it("converts write_file and read_document results into artifacts", () => {
    const fileArtifacts = normalizeToolCallToArtifacts({
      name: "write_text_file_tool",
      status: "complete",
      args: { path: "docs/output.md" },
      result: "# Output",
    });
    const findingArtifacts = normalizeToolCallToArtifacts({
      name: "read_document_tool",
      status: "complete",
      args: { path: "SUMMARY.md" },
      result: "Document: SUMMARY.md\nExcerpt: product summary",
    });

    expect(fileArtifacts[0]?.kind).toBe("file");
    expect(findingArtifacts[0]?.kind).toBe("finding");
  });

  it("maps coordinator delegations into timeline todos and result artifacts", () => {
    const delegations = [
      {
        id: "planner-1",
        sub_agent: "planner",
        task: "Read SUMMARY.md",
        status: "completed",
        result: "Plan ready",
      },
      {
        id: "reviewer-1",
        sub_agent: "reviewer",
        task: "Verify the brief",
        status: "running",
        result: "",
      },
    ] as const;

    const todos = normalizeDelegationsToTodos(delegations);
    const artifacts = normalizeDelegationArtifacts(delegations);

    expect(todos).toEqual([
      {
        id: "planner-1",
        content: "Read SUMMARY.md",
        status: "completed",
        source: "agent",
      },
      {
        id: "reviewer-1",
        content: "Verify the brief",
        status: "in_progress",
        source: "agent",
      },
    ]);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      id: "delegation-planner-1",
      kind: "finding",
      title: "Planner result",
      content: "Plan ready",
      source: "delegation",
    });
  });

  it("infers task kind for English and Chinese prompts", () => {
    expect(inferTaskKindFromMessage("Research SUMMARY.md and write a brief")).toBe("research");
    expect(inferTaskKindFromMessage("请调研 SUMMARY.md 并输出简报")).toBe("research");
    expect(inferTaskKindFromMessage("修复 failing test 并更新代码")).toBe("engineering");
  });

  it("extracts a final summary from string or object tool results", () => {
    expect(extractFinalSummary("All checks passed")).toBe("All checks passed");
    expect(extractFinalSummary({ summary: "Research complete" })).toBe(
      "Research complete",
    );
    expect(extractFinalSummary({ final_summary: "Coordinator complete" })).toBe(
      "Coordinator complete",
    );
  });
});

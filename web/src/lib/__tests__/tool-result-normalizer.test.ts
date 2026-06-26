import { describe, expect, it } from "vitest";

import {
  extractFinalSummary,
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
      name: "write_file",
      status: "complete",
      args: { file_path: "docs/output.md" },
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

  it("extracts a final summary from string or object tool results", () => {
    expect(extractFinalSummary("All checks passed")).toBe("All checks passed");
    expect(extractFinalSummary({ summary: "Research complete" })).toBe(
      "Research complete",
    );
  });
});

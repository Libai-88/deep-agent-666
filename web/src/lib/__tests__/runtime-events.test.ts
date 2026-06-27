import { describe, expect, it } from "vitest";

import {
  normalizeSnapshotEvents,
  normalizeToolPayloadToEvents,
} from "../runtime-events";

describe("runtime-events", () => {
  it("normalizes coordinator snapshot events into stable workbench events", () => {
    const events = normalizeSnapshotEvents([
      {
        id: "e-1",
        kind: "delegation",
        status: "completed",
        title: "Planner finished",
        message: "Inspect the repository architecture.",
        source: "planner",
        artifact_path: null,
        artifact_kind: null,
      },
    ]);

    expect(events[0]).toMatchObject({
      id: "e-1",
      kind: "delegation",
      status: "completed",
      title: "Planner finished",
      message: "Inspect the repository architecture.",
      source: "planner",
    });
  });

  it("creates tool events for completed structured file edits", () => {
    const events = normalizeToolPayloadToEvents({
      name: "replace_text_in_file_tool",
      status: "complete",
      args: { path: "docs/plan.md" },
      result: {
        summary: "updated docs/plan.md",
        path: "docs/plan.md",
        a2ui_operations: [],
      },
    });

    expect(events[0]).toMatchObject({
      kind: "artifact",
      status: "completed",
      title: "updated docs/plan.md",
      artifactPath: "docs/plan.md",
      artifactKind: "file",
    });
  });
});

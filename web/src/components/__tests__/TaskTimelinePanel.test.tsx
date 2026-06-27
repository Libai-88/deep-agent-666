import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TaskTimelinePanel } from "../TaskTimelinePanel";

describe("TaskTimelinePanel", () => {
  it("renders task kind with human-readable statuses", () => {
    const html = renderToStaticMarkup(
      <TaskTimelinePanel
        taskKind="research"
        todos={[
          {
            id: "1",
            content: "Read docs",
            status: "completed",
            source: "agent",
          },
          {
            id: "2",
            content: "Draft brief",
            status: "in_progress",
            source: "agent",
          },
        ]}
      />,
    );

    expect(html).toContain("Research");
    expect(html).toContain("Read docs");
    expect(html).toContain("Draft brief");
    expect(html).toContain("Completed");
    expect(html).toContain("In progress");
    expect(html).not.toContain("in_progress");
  });

  it("renders event labels before falling back to todo-only cards", () => {
    const html = renderToStaticMarkup(
      <TaskTimelinePanel
        taskKind="engineering"
        events={[
          {
            id: "event-1",
            kind: "delegation",
            status: "running",
            title: "Executor started",
            message: "Inspect risky files and TODOs.",
            source: "executor",
            createdAt: 1,
          },
        ]}
        todos={[]}
      />,
    );

    expect(html).toContain("Executor started");
    expect(html).toContain("Inspect risky files and TODOs.");
    expect(html).toContain("In progress");
  });
});

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
});

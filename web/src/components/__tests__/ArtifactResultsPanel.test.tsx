import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ArtifactResultsPanel } from "../ArtifactResultsPanel";

describe("ArtifactResultsPanel", () => {
  it("renders summaries and file artifacts", () => {
    const onOpenFile = vi.fn();
    const html = renderToStaticMarkup(
      <ArtifactResultsPanel
        finalSummary="Research complete"
        artifacts={[
          {
            id: "a1",
            kind: "file",
            title: "report.md",
            path: "report.md",
            content: "# Report",
            createdAt: 1,
          },
          {
            id: "a2",
            kind: "finding",
            title: "SUMMARY.md",
            content: "Key finding",
            createdAt: 2,
          },
        ]}
        onOpenFile={onOpenFile}
      />,
    );

    expect(html).toContain("Research complete");
    expect(html).toContain("report.md");
    expect(html).toContain("SUMMARY.md");
    expect(onOpenFile).not.toHaveBeenCalled();
  });
});

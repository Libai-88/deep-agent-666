import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkbenchStatusNotice } from "../WorkbenchStatusNotice";

describe("WorkbenchStatusNotice", () => {
  it("renders a recoverable runtime message", () => {
    const html = renderToStaticMarkup(
      <WorkbenchStatusNotice
        title="Backend unavailable"
        description="The agent backend could not be reached."
        actions={[{ label: "Retry connection", action: "retry_connection" }]}
        onAction={() => {}}
      />,
    );

    expect(html).toContain("Backend unavailable");
    expect(html).toContain("Retry connection");
  });

  it("applies approval tone styling", () => {
    const html = renderToStaticMarkup(
      <WorkbenchStatusNotice
        title="Plan approved"
        description="The supervisor has approved your plan."
        actions={[]}
        onAction={() => {}}
        tone="approval"
      />,
    );

    expect(html).toContain("Plan approved");
    expect(html).toContain("--surface-approval");
  });
});

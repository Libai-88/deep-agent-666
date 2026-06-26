import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FirstRunGate } from "../FirstRunGate";

describe("FirstRunGate", () => {
  it("renders recovery actions", () => {
    const html = renderToStaticMarkup(
      <FirstRunGate
        title="Configure your providers"
        description="No launchable presets are available yet."
        actions={[{ label: "Configure provider", action: "configure_provider" }]}
        onAction={() => {}}
      />,
    );

    expect(html).toContain("Configure your providers");
    expect(html).toContain("Configure provider");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { STARTER_TEMPLATES } from "@/lib/starter-templates";
import { StarterTemplatePanel } from "../StarterTemplatePanel";

describe("StarterTemplatePanel", () => {
  it("renders grouped starter templates", () => {
    const html = renderToStaticMarkup(
      <StarterTemplatePanel
        templates={STARTER_TEMPLATES}
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain("Engineering");
    expect(html).toContain("Research");
    expect(html).toContain("General");
  });
});

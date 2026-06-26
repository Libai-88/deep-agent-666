import { describe, expect, it } from "vitest";

import {
  STARTER_TEMPLATES,
  createStarterThread,
  groupStarterTemplates,
  seedWorkbenchForStarterTemplate,
} from "../starter-templates";

describe("starter-templates", () => {
  it("groups templates by category", () => {
    const grouped = groupStarterTemplates(STARTER_TEMPLATES);

    expect(grouped.engineering.length).toBeGreaterThan(0);
    expect(grouped.research.length).toBeGreaterThan(0);
    expect(grouped.general.length).toBeGreaterThan(0);
  });

  it("creates a starter thread title from the chosen template", () => {
    const template = STARTER_TEMPLATES[0];
    const thread = createStarterThread("openai-balanced", template);

    expect(thread.presetId).toBe("openai-balanced");
    expect(thread.title).toBe(template.suggestedThreadTitle);
  });

  it("seeds a clean workbench state for the selected task kind", () => {
    const state = seedWorkbenchForStarterTemplate(
      "research",
      "Read the workspace docs and summarize them.",
    );

    expect(state.taskKind).toBe("research");
    expect(state.todos).toEqual([]);
    expect(state.artifacts).toEqual([]);
    expect(state.finalSummary).toBeNull();
    expect(state.lastUserPrompt).toBe(
      "Read the workspace docs and summarize them.",
    );
  });
});

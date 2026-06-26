import type { AgentPresetId } from "./agent-presets";
import { createLocalThread, type LocalThread } from "./thread-registry";
import {
  createEmptyWorkbenchState,
  type ThreadWorkbenchState,
  type WorkbenchTaskKind,
} from "./workbench-state";

export type StarterTemplateCategory = "engineering" | "research" | "general";

export type StarterTemplate = {
  id: string;
  category: StarterTemplateCategory;
  title: string;
  prompt: string;
  suggestedThreadTitle: string;
};

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id: "engineering-analyze-repo",
    category: "engineering",
    title: "Analyze the repository structure",
    prompt: "Analyze this repository structure and summarize the major modules.",
    suggestedThreadTitle: "Analyze repository structure",
  },
  {
    id: "engineering-find-risks",
    category: "engineering",
    title: "Find risky files and TODOs",
    prompt: "Find risky files or TODOs and propose the next engineering tasks.",
    suggestedThreadTitle: "Find risky files and TODOs",
  },
  {
    id: "research-read-docs",
    category: "research",
    title: "Summarize project docs",
    prompt: "Read the workspace docs and summarize the current project direction.",
    suggestedThreadTitle: "Summarize project docs",
  },
  {
    id: "research-compare-examples",
    category: "research",
    title: "Compare against official examples",
    prompt: "Compare the current implementation against official CopilotKit examples.",
    suggestedThreadTitle: "Compare against official examples",
  },
  {
    id: "general-explain-workspace",
    category: "general",
    title: "Explain this workspace",
    prompt: "Explain what this workspace is and how the agent can help me here.",
    suggestedThreadTitle: "Explain this workspace",
  },
  {
    id: "general-next-step",
    category: "general",
    title: "Show the next recommended step",
    prompt: "Inspect the current thread and show the next recommended step.",
    suggestedThreadTitle: "Show next step",
  },
];

export function groupStarterTemplates(
  templates: readonly StarterTemplate[],
): Record<StarterTemplateCategory, StarterTemplate[]> {
  return {
    engineering: templates.filter(
      (template) => template.category === "engineering",
    ),
    research: templates.filter((template) => template.category === "research"),
    general: templates.filter((template) => template.category === "general"),
  };
}

export function createStarterThread(
  presetId: AgentPresetId,
  template: StarterTemplate,
): LocalThread {
  return {
    ...createLocalThread(presetId),
    title: template.suggestedThreadTitle,
  };
}

export function seedWorkbenchForStarterTemplate(
  taskKind: WorkbenchTaskKind,
  lastUserPrompt: string | null = null,
): ThreadWorkbenchState {
  return {
    ...createEmptyWorkbenchState(),
    taskKind,
    lastUserPrompt,
  };
}

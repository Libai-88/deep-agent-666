import { randomUUID } from "@copilotkit/shared";

import {
  ALL_AGENT_PRESETS,
  type AgentPresetDefinition,
  type AgentPresetId,
} from "./agent-presets";

export type LocalThread = {
  id: string;
  title: string;
  presetId: AgentPresetId;
  updatedAt: number;
};

const STORAGE_KEY = "deep-agent-666.threads";
const VALID_PRESET_IDS = new Set(
  ALL_AGENT_PRESETS.map((preset) => preset.id),
);

function isLocalThread(value: unknown): value is LocalThread {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.updatedAt === "number" &&
    typeof candidate.presetId === "string" &&
    VALID_PRESET_IDS.has(candidate.presetId as AgentPresetId)
  );
}

export function loadThreads(
  storage: Storage = window.localStorage,
): LocalThread[] {
  const rawThreads = storage.getItem(STORAGE_KEY);

  if (!rawThreads) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawThreads) as unknown;

    return Array.isArray(parsed) ? parsed.filter(isLocalThread) : [];
  } catch {
    return [];
  }
}

export function saveThreads(
  threads: LocalThread[],
  storage: Storage = window.localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

export function sanitizeThreads(
  threads: LocalThread[],
  presets: readonly AgentPresetDefinition[],
): LocalThread[] {
  const availablePresetIds = new Set(presets.map((preset) => preset.id));

  return threads.filter((thread) => availablePresetIds.has(thread.presetId));
}

export function createLocalThread(presetId: AgentPresetId): LocalThread {
  return {
    id: randomUUID(),
    title: "New thread",
    presetId,
    updatedAt: Date.now(),
  };
}

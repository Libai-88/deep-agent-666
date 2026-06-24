import { randomUUID } from "@copilotkit/shared";

import type { AgentPresetId } from "./agent-presets";

export type LocalThread = {
  id: string;
  title: string;
  presetId: AgentPresetId;
  updatedAt: number;
};

const STORAGE_KEY = "deep-agent-666.threads";

export function loadThreads(
  storage: Storage = window.localStorage,
): LocalThread[] {
  const rawThreads = storage.getItem(STORAGE_KEY);

  return rawThreads ? (JSON.parse(rawThreads) as LocalThread[]) : [];
}

export function saveThreads(
  threads: LocalThread[],
  storage: Storage = window.localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

export function createLocalThread(presetId: AgentPresetId): LocalThread {
  return {
    id: randomUUID(),
    title: "New thread",
    presetId,
    updatedAt: Date.now(),
  };
}

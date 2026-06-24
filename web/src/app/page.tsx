"use client";

import { useState } from "react";

import { CopilotChat } from "@copilotkit/react-core/v2";

import {
  ALL_AGENT_PRESETS,
  DEFAULT_AGENT_PRESET_ID,
  type AgentPresetId,
} from "@/lib/agent-presets";

export default function Page() {
  const [selectedPresetId, setSelectedPresetId] =
    useState<AgentPresetId>(DEFAULT_AGENT_PRESET_ID);
  const selectedPreset =
    ALL_AGENT_PRESETS.find((preset) => preset.id === selectedPresetId) ??
    ALL_AGENT_PRESETS[0];

  return (
    <main className="shell">
      <div className="shell__frame">
        <aside className="shell__rail">
          <p className="shell__eyebrow">Deep Agents</p>
          <h1 className="shell__title">Runtime Bridge</h1>
          <p className="shell__copy">
            This shell routes CopilotKit through the local Next.js runtime and
            persists thread history in SQLite while delegating model execution to
            the Python LangGraph backend.
          </p>

          <div className="shell__meta">
            <div className="shell__metaCard">
              <span className="shell__metaLabel">Transport</span>
              <span className="shell__metaValue">Multi-route runtime</span>
            </div>
            <div className="shell__metaCard">
              <span className="shell__metaLabel">Persistence</span>
              <span className="shell__metaValue">SqliteAgentRunner</span>
            </div>
            <div className="shell__metaCard">
              <span className="shell__metaLabel">Backend</span>
              <span className="shell__metaValue">LangGraphHttpAgent</span>
            </div>
          </div>

          <div className="shell__presetList">
            {ALL_AGENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className="shell__presetButton"
                data-active={preset.id === selectedPresetId}
                onClick={() => setSelectedPresetId(preset.id)}
                type="button"
              >
                <span className="shell__presetLabel">{preset.label}</span>
                <span className="shell__presetHint">
                  {preset.provider} · {preset.permissionMode}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="shell__main">
          <header className="shell__mainHeader">
            <div>
              <p className="shell__eyebrow">Active Preset</p>
              <h2 style={{ margin: 0 }}>{selectedPreset.label}</h2>
              <p className="shell__copy" style={{ marginTop: 8 }}>
                Agent ID: <code>{selectedPreset.id}</code>
              </p>
            </div>
            <div className="shell__badge">SQLite-backed local threads</div>
          </header>

          <div className="shell__chatFrame">
            <CopilotChat key={selectedPreset.id} agentId={selectedPreset.id} />
          </div>
        </section>
      </div>
    </main>
  );
}

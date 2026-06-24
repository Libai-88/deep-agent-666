"use client";

import { useInterrupt } from "@copilotkit/react-core/v2";

function renderInterruptBody(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function InterruptApproval() {
  useInterrupt({
    enabled: (event) => event.name === "on_interrupt",
    render: ({ event, resolve }) => (
      <div
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 16,
          padding: 16,
          background: "#f7fff8",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Approval required</h3>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
          {renderInterruptBody(event.value)}
        </pre>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => resolve({ decisions: [{ type: "approve" }] })}
            type="button"
          >
            Approve
          </button>
          <button
            onClick={() =>
              resolve({
                decisions: [
                  {
                    type: "reject",
                    message:
                      "User rejected this action. Do not retry without asking again.",
                  },
                ],
              })
            }
            type="button"
          >
            Reject
          </button>
        </div>
      </div>
    ),
  });

  return null;
}

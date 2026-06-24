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
      <div className="wb-approval">
        <h3 className="wb-approval__title">Approval required</h3>
        <pre className="wb-approval__body">{renderInterruptBody(event.value)}</pre>
        <div className="wb-approval__actions">
          <button
            className="wb-approval__btn wb-approval__btn--approve"
            onClick={() => resolve({ decisions: [{ type: "approve" }] })}
            type="button"
          >
            Approve
          </button>
          <button
            className="wb-approval__btn wb-approval__btn--reject"
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

import { describe, expect, it } from "vitest";

import { resolveRecoverableActions } from "../runtime-errors";

describe("runtime-errors", () => {
  it("maps backend_unreachable to retry and settings actions", () => {
    expect(resolveRecoverableActions("backend_unreachable")).toEqual([
      { label: "Retry connection", action: "retry_connection" },
      { label: "Open settings", action: "open_settings" },
    ]);
  });
});

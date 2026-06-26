import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const runtimeV2 = require("@copilotkit/runtime/v2") as typeof import("@copilotkit/runtime/v2");

export const CopilotRuntime = runtimeV2.CopilotRuntime;
export const InMemoryAgentRunner = runtimeV2.InMemoryAgentRunner;
export const createCopilotRuntimeHandler = runtimeV2.createCopilotRuntimeHandler;

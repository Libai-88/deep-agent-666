# Deep Agents + CopilotKit Agent Tool Design

Date: 2026-06-24
Status: Draft for user review
Scope: First design spec for a new local-first general-purpose agent tool built from scratch on Deep Agents + CopilotKit

## Goal

Design a new general-purpose agent tool for knowledge workers and some researchers. The product should feel closer to Codex, Hermes, or Claude Cowork than to a narrow task bot. It should support web-first development for rapid iteration, while keeping the architecture suitable for a later Windows desktop shell.

The first version should be:

- local-first
- web + future Windows desktop compatible
- single-agent from a product perspective
- balanced across code, terminal, file, and office-document workflows
- strong enough in full local task execution to prove product value

## Confirmed Facts

The following statements are treated as confirmed facts because they come from official CopilotKit or LangChain/LangGraph documentation, or from direct inspection of the current CopilotKit CLI package.

### Deep Agents and LangGraph

- Deep Agents is not a separate orchestration runtime that replaces LangGraph.
- Deep Agents builds on top of LangGraph and uses the LangGraph runtime for execution features such as streaming, durable execution, and human-in-the-loop patterns.
- Therefore, choosing Deep Agents still means adopting the LangGraph execution model underneath.

Sources:

- https://docs.langchain.com/oss/python/langgraph/overview
- https://docs.langchain.com/oss/python/deepagents/overview
- https://docs.langchain.com/oss/python/concepts/products

### CopilotKit Support for Deep Agents

- CopilotKit officially documents Deep Agents integration.
- CopilotKit provides a dedicated Deep Agents documentation area and quickstart.
- The documented integration path uses CopilotKit on the frontend and a LangGraph-compatible Deep Agent on the backend.

Sources:

- https://docs.copilotkit.ai/deepagents
- https://docs.copilotkit.ai/integrations/deepagents/quickstart

### Frontend Support Maturity

- CopilotKit supports multiple frontend environments, including React/Next.js, Vue, Angular, and React Native.
- React/Next.js is the primary GA path in the official repository status messaging.
- Vue and Angular are supported, but not positioned as the primary path.
- React Native is supported but headless, meaning it provides hooks rather than a prebuilt chat UI path comparable to the web React stack.

Sources:

- https://github.com/CopilotKit/CopilotKit
- https://docs.copilotkit.ai/frontends/vue
- https://docs.copilotkit.ai/frontends/react-native

### Deep Agents Frontend Guidance

- The official Deep Agents quickstart uses Next.js as the frontend example.
- The official docs describe CopilotKit as working with React-based frontends and present Next.js as the example implementation path.

Source:

- https://docs.copilotkit.ai/integrations/deepagents/quickstart

### CopilotKit CLI Limitations Relevant to This Project

- `npx copilotkit@latest create` exists and supports non-interactive flags such as `--name` and `--framework`.
- As of `copilotkit@4.0.1`, `deepagents` is not one of the supported framework values for the CLI scaffold.
- Supported values include `langgraph-py` and `langgraph-js`, but not a dedicated Deep Agents template.

Local evidence:

- `D:\AgentBuild\.tmp-copilotkit-cli\package\README.md`
- `D:\AgentBuild\.tmp-copilotkit-cli\package\index.js`

## Engineering Decisions

The following are not official framework requirements. They are deliberate product and architecture decisions for this project.

### Product Positioning

- The product will be a general-purpose agent tool rather than a narrow workflow app.
- Target users are knowledge workers first, with secondary support for lightweight research workflows.
- The default experience should be strongest for local code, terminal, file, and office-style knowledge work.

### Delivery Strategy

- Development starts with a web application for speed, observability, and easier debugging.
- The long-term product direction still assumes a Windows desktop shell.
- The web app is not throwaway scaffolding. It becomes the development surface and the future desktop UI foundation.

### Runtime Strategy

- The system is local-first.
- The first version should run the core agent and tool execution locally.
- Cloud services may be added later for optional model access, sync, or telemetry, but should not be required for the primary product loop.

### Agent Strategy

- The first version exposes one primary agent to the user.
- Internally, the system should avoid design choices that block later evolution into planner + subagent patterns.
- Multi-agent orchestration is explicitly postponed until the single-agent path is stable and valuable.

### Security and Permissions

- The product will use switchable permission modes rather than a single trust model.
- The default mode should be a standard middle ground.
- Higher-risk operations such as command execution, filesystem writes, and network access should be separable from lower-risk read-only operations.

### Model Strategy

- The system should support multiple model providers.
- Model routing must be an internal abstraction layer, not hardcoded into agent logic.
- The first version should keep routing policy simple even if provider support is broad.

## Recommended Technical Direction

Use Deep Agents + CopilotKit from scratch rather than starting from the CopilotKit `langgraph-py` starter and reshaping it afterward.

### Why this direction

- It keeps the problem boundary clean.
- It avoids confusion between starter-template assumptions and the actual target architecture.
- It makes debugging easier because failures can be isolated across the agent layer, the CopilotKit bridge layer, and the frontend layer.
- It aligns with the official Deep Agents integration docs rather than approximating them through a nearby template.

## Architecture

The first version should be designed as four layers.

### 1. Agent Core

Purpose:

- Host the main Deep Agent.
- Manage model usage, planning, execution flow, task state, and tool orchestration.

Responsibilities:

- run the single primary agent
- maintain task execution state
- call tools
- manage long-running task progress
- expose structured task status to the UI layer

Notes:

- Deep Agents provides the high-level agent harness.
- LangGraph runtime behavior is inherited underneath.

### 2. Copilot Bridge

Purpose:

- Connect the frontend to the agent runtime using official CopilotKit integration patterns.

Responsibilities:

- expose the CopilotKit runtime route
- translate between frontend interactions and the local agent service
- handle streaming, tool rendering hooks, and human-in-the-loop interruption flows

Notes:

- This layer should stay thin.
- Product logic belongs in the agent core or tool runtime, not here.

### 3. Web Client

Purpose:

- Provide the main development and validation surface.

Responsibilities:

- chat-first UI
- thread list
- current task status
- tool result rendering
- permission confirmation surfaces
- future reusable UI basis for desktop

Framework choice:

- React + Next.js

Why:

- strongest official path for Deep Agents + CopilotKit
- highest documentation maturity
- easiest debugging path
- best fit for later Windows shell reuse

### 4. Future Windows Shell

Purpose:

- Wrap the proven web UI and local-first runtime for beginner-friendly desktop use.

Responsibilities later:

- app packaging
- Windows-specific permissions and integration
- local service lifecycle management

Notes:

- Not part of the first implementation phase.
- Must not force a rewrite of the frontend or agent interfaces.

## Core Components for V1

The first version should contain six core modules.

### Deep Agent

First version workload focus:

- code and terminal tasks
- local files and directories
- office-style document reading and summarization

This is the main unit of user-facing intelligence and task execution.

### Tool Runtime

Purpose:

- centralize tool registration, validation, execution, and permissions

Risk tiers:

- read-only
- moderate-risk mutations
- high-risk execution or external access

The permission model depends on this module being explicit and auditable.

### Session Memory

Purpose:

- persist thread context, recent task state, checkpoints, and user preferences

V1 scope:

- local persistence only

Non-goal:

- full cloud sync

### CopilotKit Frontend Layer

Purpose:

- render chat and related UI using official CopilotKit patterns

Expected feature usage:

- provider setup
- runtime route
- frontend tools
- render tool calls
- human-in-the-loop interactions

### Workspace Context Layer

Purpose:

- make current workspace state explicit and consumable by the agent

Examples:

- active workspace path
- known files
- recent file changes
- recent command outputs
- current task objective

Without this layer, the system behaves more like a chatbot than a work agent.

### Model Router

Purpose:

- separate model-provider concerns from agent logic

V1 scope:

- multiple providers supported
- simple selection policy

Non-goal:

- advanced dynamic optimization on day one

## User Experience Direction

The UI should follow a Claude/Codex-like shape rather than an IDE-style permanent multi-pane layout.

### Primary layout

- chat-first main surface
- side or drawer access for threads
- side or drawer access for tool results and task progress
- explicit confirmation UI for higher-risk operations

### Why this layout

- matches target user expectations
- reduces first-use complexity for non-technical users
- still supports deeper work through progressive disclosure

## Data Flow

The first-version execution flow should be:

1. User submits a message or task in the web client.
2. CopilotKit frontend sends conversation context and interaction data to the runtime layer.
3. CopilotKit runtime forwards the request to the local Deep Agent integration path.
4. The agent evaluates the request and either:
   - answers directly
   - reads local context
   - requests permission for higher-risk actions
   - enters a multi-step task flow
5. Tool results, state changes, interruptions, and final messages stream back through CopilotKit.
6. The frontend renders:
   - messages
   - current task status
   - tool activity and outputs
   - human approval or response requests

## Error Handling

Errors should be separated into four categories.

### Agent Errors

Examples:

- planning failure
- reasoning loop failure
- task state transition failure

Handling:

- keep the thread alive
- explain the failure in user terms
- offer retry or narrower next action

### Tool Errors

Examples:

- missing file
- invalid parameters
- command failure
- document parse failure

Handling:

- isolate tool failure from total thread failure
- preserve logs and structured result details

### Runtime or Protocol Errors

Examples:

- streaming failure
- CopilotKit runtime misconfiguration
- AG-UI transport issues

Handling:

- show system-level failure clearly
- avoid presenting transport failures as agent reasoning failures

### User-Action Conflicts

Examples:

- denied permission
- changed workspace during task execution
- invalid resumed task context

Handling:

- stop dangerous execution cleanly
- let the agent re-plan from updated constraints

## Testing Strategy

The first implementation should validate four layers.

### Tool Tests

Validate:

- parameter handling
- permission boundaries
- expected outputs for file, command, and document tools

### Agent Flow Tests

Validate:

- end-to-end task completion for representative local workflows

Representative cases:

- inspect a directory and summarize a project
- modify a file and explain the change
- run a command and recover from failure
- summarize a local office document into structured output

### Runtime Integration Tests

Validate:

- CopilotKit to local agent connectivity
- streaming behavior
- human-in-the-loop round trips

### UI Smoke Tests

Validate:

- basic chat loop
- task state rendering
- approval UI
- thread recovery basics

## MVP Definition

V1 succeeds if a user can complete this loop:

1. open a local workspace
2. assign a meaningful task
3. let the agent plan and execute multiple steps
4. read and modify files where permitted
5. run commands where permitted
6. receive a structured final result
7. pause and later resume the thread with usable context

## Explicit Non-Goals for V1

- plugin marketplace
- user-visible multi-agent orchestration
- cloud-first team collaboration
- complex enterprise RAG platform
- cross-platform desktop support

## Risks and Constraints

### Main Risk

The project can easily expand into a general AI workspace platform before the single-agent local workflow is proven.

Mitigation:

- keep V1 scoped to one strong agent loop
- prioritize stability over breadth

### Integration Risk

Because Deep Agents relies on LangGraph and CopilotKit adds its own runtime and frontend layers, debugging can span multiple systems.

Mitigation:

- keep the bridge thin
- test each layer separately
- prefer official integration patterns before customization

### UX Risk

A local-first agent with real tools can become either too noisy or too dangerous.

Mitigation:

- use permission tiers
- expose tool intent clearly
- provide visible task state rather than hiding all work inside the chat transcript

## Recommendation Summary

Build the first version from scratch using:

- Deep Agents as the agent harness
- LangGraph as the underlying execution runtime
- CopilotKit as the frontend/runtime bridge
- React + Next.js as the first frontend
- a local-first execution model

Do not start from the CLI scaffold for this product. The official CopilotKit starter is useful nearby context, but this project benefits more from direct alignment with the official Deep Agents integration path.

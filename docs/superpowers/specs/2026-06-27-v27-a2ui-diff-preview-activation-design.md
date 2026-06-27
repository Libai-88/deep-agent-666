# V27 A2UI Diff Preview Activation Design

## Problem

The product already ships the CopilotKit A2UI runtime hook-up and a local `DiffPreview` catalog entry, but no real agent workflow emits A2UI operations yet. As a result, file edits still land as plain text tool results such as `updated foo.ts`, which is functional but weak for a general-purpose coding agent.

For a Codex-like product, edit actions need to be inspectable at the moment they happen. Users should not have to infer what changed from a one-line success string or jump straight into the file browser for every write.

## Goal

Activate A2UI in the real editing path so that workspace write tools emit a structured result with:

1. a human-readable summary
2. stable file metadata
3. before/after content for small text edits
4. `a2ui_operations` that render the existing `DiffPreview` surface inline in chat

The work must preserve current workbench behavior, avoid polluting final summaries, and remain safe for coordinator-driven execution.

## Non-Goals

- No large redesign of the chat surface or workbench layout
- No attempt to build a full patch viewer with syntax-aware line diffing in this phase
- No A2UI activation for every tool category; this phase is only for text file write/replace flows
- No support for binary files, huge files, or multi-file transaction previews beyond simple single-file results

## Options

### Option A: Keep plain strings and add a separate frontend post-processor

Let backend tools keep returning `wrote path` / `updated path`, then have the frontend infer before/after state from tool args or by re-reading the file.

Pros:

- Small backend delta
- Keeps tool return types unchanged

Cons:

- Frontend cannot reliably reconstruct `before`
- Requires extra reads and more race conditions
- Pushes edit semantics away from the source of truth

### Option B: Return structured tool payloads with embedded A2UI operations

Change `write_text_file` and `replace_text_in_file` to return a JSON-like object containing summary, file path, before/after content, and `a2ui_operations`. Update the frontend normalizers so artifacts still work while summary extraction ignores A2UI noise.

Pros:

- Single source of truth from the tool that performed the edit
- Reuses the existing `DiffPreview` catalog immediately
- Works for direct tools and coordinator-executed tools

Cons:

- Requires careful compatibility updates in normalizers and tests
- Structured results will flow into more UI surfaces than plain strings did

### Option C: Emit A2UI only from higher-level coordinator logic

Keep low-level workspace tools simple and generate diff previews in a coordinator wrapper after tool completion.

Pros:

- Limits payload changes in low-level utilities

Cons:

- Misses direct tool use
- Splits file-edit semantics across layers
- Makes the system harder to reason about

## Recommendation

Choose Option B.

The diff preview belongs to the edit operation itself. Returning structured tool payloads from the workspace tools keeps the contract explicit, enables immediate A2UI rendering, and still allows the frontend to derive file artifacts and summaries without inventing extra reads or coordinator-only logic.

## Design

### Backend contract

`write_text_file` and `replace_text_in_file` should return an object shaped like:

```python
{
  "summary": "updated src/app.ts",
  "path": "src/app.ts",
  "change_type": "modified",
  "before": "old text",
  "after": "new text",
  "a2ui_operations": [
    {
      "type": "render",
      "catalogId": "deepagent://a2ui-catalog",
      "component": "DiffPreview",
      "props": {
        "filePath": "src/app.ts",
        "before": "old text",
        "after": "new text"
      }
    }
  ]
}
```

For a brand new file, `before` is an empty string and `change_type` is `created`.

This phase should only emit diff previews for text content already loaded in memory by the tool. No extra disk re-reads beyond the existing write flow are needed.

### Frontend contract

The frontend already mounts CopilotKit with `a2ui={{ catalog }}`. Once tool results include `a2ui_operations`, CopilotKit should render the inline surface automatically.

The local workbench adapters still need to understand structured tool results:

- `normalizeToolCallToArtifacts` should keep producing a file artifact for write/replace tools
- artifact content should prefer `summary`, falling back to a serialized object only if needed
- `extractFinalSummary` must ignore A2UI-only structured edit payloads unless they carry a clear user-facing summary
- no edit-tool payload should replace the coordinator final summary with raw diff JSON

### Scope boundaries

This phase covers:

- `write_text_file`
- `replace_text_in_file`
- direct rendering in the chat transcript
- continued artifact creation in the workbench

This phase does not cover:

- `run_command`
- read-only tools
- batch edits across multiple files
- advanced visual diffing

### Error handling

- If `old_text` is missing, `replace_text_in_file` should keep raising the existing error.
- If a file path escapes the workspace, path validation remains unchanged.
- If an edit payload has no meaningful `summary`, the frontend must not manufacture a misleading final summary.
- If the A2UI surface fails to render, the structured result should still degrade to a readable artifact and tool card.

## Likely Code Impact

- Backend:
  - `agent/app/tools/workspace.py`
  - `agent/tests/test_workspace_tools.py`
- Frontend:
  - `web/src/lib/tool-result-normalizer.ts`
  - `web/src/lib/__tests__/tool-result-normalizer.test.ts`
  - `web/tests/e2e/coordinator-workbench-regression.spec.ts` or a nearby browser integration test

## Risks

- Structured edit results may accidentally appear as final summaries in the workbench if `extractFinalSummary` stays too permissive.
- Large `before` / `after` payloads can make tool cards noisy; this phase accepts that risk for correctness and can add truncation later if needed.
- The exact `a2ui_operations` shape must match what CopilotKit expects; a malformed payload would silently fall back to plain text.

## Test Plan

- `uv run --project agent pytest -v agent/tests/test_workspace_tools.py`
- `npm --prefix web run test -- tool-result-normalizer.test.ts`
- `npm --prefix web exec playwright test coordinator-workbench-regression.spec.ts`
- Final full verification:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`

## Why This Phase Matters

This is the first real A2UI product feature in the stack, not a placeholder integration. It moves the agent closer to a general-purpose coding experience where actions are visible, inspectable, and trustworthy at the point of execution.

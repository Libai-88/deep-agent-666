# V27 A2UI Diff Preview Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the existing A2UI catalog in the real file-edit workflow so write and replace tool results render an inline diff preview while preserving workbench artifacts and summary behavior.

**Architecture:** Return structured edit payloads from backend workspace tools, including `summary`, `before`, `after`, and `a2ui_operations`, then update frontend normalization so CopilotKit renders the `DiffPreview` surface while the workbench still stores clean file artifacts.

**Tech Stack:** Python workspace tools, Next.js 16, React 19, CopilotKit v2 runtime, Vitest, Playwright

## Global Constraints

- Keep scope limited to text file write/replace flows.
- Reuse the existing `deepagent://a2ui-catalog` and `DiffPreview` component.
- Follow TDD strictly: test first, verify failure, then minimal implementation.
- Do not regress existing workbench timeline, artifact, or final-summary behavior.
- Clean up any unnecessary processes after verification commands.

---

### Task 1: Add failing backend tests for structured diff-preview tool results

**Files:**
- Modify: `agent/tests/test_workspace_tools.py`

**Interfaces:**
- Consumes: `write_text_file(workspace_root, path, content)`, `replace_text_in_file(workspace_root, path, old_text, new_text)`
- Produces: failing assertions for `summary`, `before`, `after`, `change_type`, and `a2ui_operations`

- [ ] **Step 1: Write failing tests for create and replace payloads**

```python
result = write_text_file(workspace, "docs/note.txt", "hello")
assert result["summary"] == "wrote docs/note.txt"
assert result["before"] == ""
assert result["after"] == "hello"
assert result["a2ui_operations"][0]["component"] == "DiffPreview"
```

```python
result = replace_text_in_file(workspace, "note.txt", "world", "team")
assert result["change_type"] == "modified"
assert result["before"] == "hello world"
assert result["after"] == "hello team"
```

- [ ] **Step 2: Run the focused pytest file and verify it fails for the expected contract mismatch**

Run: `uv run --project agent pytest -v agent/tests/test_workspace_tools.py`
Expected: FAIL because the tools still return plain strings

- [ ] **Step 3: Implement the minimal backend payload contract**

- [ ] **Step 4: Re-run the focused pytest file and verify it passes**

Run: `uv run --project agent pytest -v agent/tests/test_workspace_tools.py`
Expected: PASS

---

### Task 2: Add failing frontend unit tests for artifact and final-summary handling

**Files:**
- Modify: `web/src/lib/__tests__/tool-result-normalizer.test.ts`
- Modify: `web/src/lib/tool-result-normalizer.ts`

**Interfaces:**
- Consumes: structured edit payloads from backend tools
- Produces: stable artifact content plus guarded `extractFinalSummary` behavior

- [ ] **Step 1: Write failing tests for structured edit payload normalization**

```ts
const result = {
  summary: "updated src/app.ts",
  path: "src/app.ts",
  before: "old",
  after: "new",
  a2ui_operations: [{ type: "render", component: "DiffPreview" }],
};

expect(normalizeToolCallToArtifacts(...)[0]?.content).toBe("updated src/app.ts");
expect(extractFinalSummary(result)).toBeNull();
```

- [ ] **Step 2: Run the focused Vitest file and verify it fails**

Run: `npm --prefix web run test -- tool-result-normalizer.test.ts`
Expected: FAIL because current normalization serializes the object and summary extraction is too permissive

- [ ] **Step 3: Implement the minimal frontend normalization changes**

- [ ] **Step 4: Re-run the focused Vitest file and verify it passes**

Run: `npm --prefix web run test -- tool-result-normalizer.test.ts`
Expected: PASS

---

### Task 3: Add a failing browser proof that edit results render the diff preview

**Files:**
- Modify: `web/tests/e2e/coordinator-workbench-regression.spec.ts`

**Interfaces:**
- Consumes: mocked tool result content for `write_text_file_tool` or `replace_text_in_file_tool`
- Produces: one browser assertion that the A2UI `DiffPreview` surface appears inline and workbench artifact behavior remains intact

- [ ] **Step 1: Extend the browser regression scenario with a structured edit result**

```ts
content: {
  summary: "updated docs/plan.md",
  path: "docs/plan.md",
  before: "draft",
  after: "final",
  a2ui_operations: [...]
}
```

- [ ] **Step 2: Run the focused Playwright spec and verify it fails before implementation**

Run: `npm --prefix web exec playwright test coordinator-workbench-regression.spec.ts`
Expected: FAIL because no inline diff preview is rendered yet or assertions cannot find it

- [ ] **Step 3: Implement the smallest supporting production changes if the unit-level work was insufficient**

- [ ] **Step 4: Re-run the focused Playwright spec and verify it passes**

Run: `npm --prefix web exec playwright test coordinator-workbench-regression.spec.ts`
Expected: PASS

---

### Task 4: Update product docs and verification baselines

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: green backend, unit, and browser tests for V27
- Produces: recorded A2UI activation baseline and updated suite counts

- [ ] **Step 1: Document the new V27 capability**

```md
- `V27` 已激活 A2UI diff preview：文本文件写入与替换现在会返回结构化编辑结果，并在聊天流中内联渲染 `DiffPreview`。
```

- [ ] **Step 2: Run full verification**

Run: `npm --prefix web run typecheck`
Expected: PASS

Run: `npm --prefix web run test`
Expected: PASS

Run: `npm --prefix web run build`
Expected: PASS

Run: `npm --prefix web run e2e`
Expected: PASS

Run: `uv run --project agent pytest -v`
Expected: PASS

- [ ] **Step 3: Commit and push**

```bash
git add .
git commit -m "feat(v27): activate a2ui diff previews for file edits"
git push
```

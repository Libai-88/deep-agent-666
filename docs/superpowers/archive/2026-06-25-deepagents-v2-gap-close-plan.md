# V2 差距分析与收尾计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Identify gaps between the V2 design spec and current implementation, then close them with minimal, focused tasks.

**Architecture:** The V2 design spec defines 6 components (coordinator, GenUI middleware, SubAgentProgress, DiffViewer, DataChart, FileBrowser) plus the full data flow. Current implementation covers ~85% of spec. Remaining gaps are in UI polish (file changed indicator, FileViewDialog integration) and missing E2E validation.

**Tech Stack:** Python 3.11+, Deep Agents 0.6.11+, CopilotKit Python 0.1.94+, Next.js 16.2.9+, React 19.2.7+, `@copilotkit/react-core` v2, shadcn/ui, Tailwind v4.

---
**Design Spec:** `docs/superpowers/specs/2026-06-25-deepagents-v2-subagent-genui-design.md`

## 差距分析

### ✅ 已实现的（设计规格覆盖率 ~85%）

| 设计规格要求 | 当前状态 | 文件 |
|-------------|---------|------|
| `build_v2_coordinator` 含 3 子 agent | ✅ 已实现 | `agent/app/agent_factory.py` |
| planner/reviewer 仅只读工具 | ✅ 已实现 | 同上 |
| executor 全工具集 | ✅ 已实现 | 同上 |
| V2AgentState 状态定义 | ✅ 已实现 | `agent/app/state.py` |
| GenUI 中间件 | ✅ 已实现 | `agent/app/middleware/genui.py` |
| `copilotkit_emit_state` 推阶段/plan/diff/review | ✅ 已实现 | 同上 |
| Coordinator 端点注册 | ✅ 已实现 | `agent/app/main.py` |
| SubAgentProgress 前端组件 | ✅ 已实现 | `web/src/components/SubAgentProgress.tsx` |
| DiffViewer 行级 diff | ✅ 已实现 | `web/src/components/DiffViewer.tsx` |
| DataChart 表格+图表 | ✅ 已实现 | `web/src/components/DataChart.tsx` |
| Workspace 端点 (GET /workspace/files + /workspace/file) | ✅ 已实现 | `agent/app/main.py` |
| FileBrowser 目录树 | ✅ 已实现 | `web/src/components/FileBrowser.tsx` |
| GenUIRenderer 订阅 coordinator 状态 | ✅ 已实现 | `web/src/app/page.tsx` |
| Tasks / Workspace 标签切换 | ✅ 已实现 | `web/src/app/page.tsx` |
| SubAgentProgress 动态 agentId | ✅ 已实现 | 同上 + SubAgentProgress.tsx |
| Build & 测试通过 | ✅ 34 + 15 tests pass | |

### ❌ 设计规格差异（需要修复）

| 编号 | 设计规格要求 | 当前问题 | 严重度 |
|------|-------------|---------|--------|
| GAP-1 | V2AgentState 应继承 CopilotKitState | 实际使用 pydantic BaseModel — **CopilotKitState 是 TypedDict，有元类冲突无法直接继承**。这是合理的架构决策，但设计规格需要更新以反映实际情况 | 🟡 文档级 |
| GAP-2 | 前端应使用 `useCoAgentStateRender` hook | 当前安装的 `@copilotkit/react-core` 版本不支持此 hook。改为 `useAgent().subscribe()` — 这是该版本实际可用的 API，功能等价 | 🟡 文档级 |
| GAP-3 | 工作区文件点击后应在 FileViewDialog 打开预览 | FileBrowser 的 `onOpenFile` 回调已传，但 page.tsx 未挂载 FileViewDialog 接收 workspace 文件路径 | 🔴 功能缺失 |
| GAP-4 | Agent 修改过的文件应有"changed"指示标记 | FileBrowser 目前仅显示目录结构，未标记 agent 改过的文件 | 🟡 体验缺失 |
| GAP-5 | 完整数据流 E2E 验证 | 没有启动后端+前端做真实 chat 验证的流程。coordinator 是否真正按 plan→do→review 流转未经过实战检验 | 🔴 验证缺失 |

### ⚠️ 已知但接受的技术偏差（不修复）

| 设计规格提到 | 实际使用 | 原因 |
|-------------|---------|------|
| `create_deep_agent(middleware=[...])` | GenUI 中间件通过 `AgentMiddleware` 类的 `aafter_model` 钩子集成 | `create_deep_agent` 的 middleware 参数在已安装版本中行为不同，改用类包装更稳定 |
| subagents 含 `tools` 字段 | subagents 含 `name` + `description` + `system_prompt` + `tools` | `create_deep_agent` 要求 subagents 必须有 `system_prompt` 字段 |

---

## 收尾任务

### Task F-1: 文件"changed"标记

**设计规格要求：** "Agent-modified files get a small 'changed' indicator"

**分析：** FileBrowser 是一个纯粹的前端文件浏览器，它不知道 agent 改了什么文件。需要从 page.tsx 的 `files` 状态（agent 通过 `write_file` 产生的文件列表）传递一个"已修改文件路径集合"给 FileBrowser。

**Files:**
- Modify: `web/src/components/FileBrowser.tsx` — 添加 `changedPaths` prop
- Modify: `web/src/app/page.tsx` — 传递 `files` 中的路径

**Step 1: 修改 FileBrowser**

在 FileTreeItem 中，如果当前文件路径在 `changedPaths` 中，在文件名后添加一个紫色小圆点指示标记。

```tsx
interface FileBrowserProps {
  onOpenFile: (path: string) => void;
  changedPaths?: Set<string>;  // New
  className?: string;
}
```

FileTreeItem 渲染：
```tsx
{changedPaths?.has(path) && (
  <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-purple-500" title="Modified by agent" />
)}
```

**Step 2: 修改 page.tsx**

```tsx
<FileBrowser
  onOpenFile={(path) => { ... }}
  changedPaths={new Set(files.map((f) => f.path))}
  className="py-2"
/>
```

**Step 3: Build 验证**

```bash
cd /d/AgentBuild/.worktrees/deepagents-foundation/web && npx next build 2>&1 | tail -5
```
Expected: Build passes.

**Step 4: Commit**

```bash
cd /d/AgentBuild/.worktrees/deepagents-foundation
git add web/src/components/FileBrowser.tsx web/src/app/page.tsx
git commit -m "fix(v2): add agent-modified file indicator to FileBrowser"
```

---

### Task F-2: FileViewDialog 集成工作区文件预览

**设计规格要求：** "Click a file → preview in the existing FileViewDialog"

**分析：** 当前 FileViewDialog 只支持从 agent 创建的 `FileItem` 列表（含 path + content）。工作区文件浏览需要：
1. 点击文件时获取文件内容
2. 将 `{ path, content }` 传给 FileViewDialog
3. FileViewDialog 本身不需要修改（它接受 `FileItem | null`，含 `path` + `content`）

**Files:**
- Modify: `web/src/app/page.tsx` — 添加 previewFile state + 异步获取内容 + FileViewDialog 渲染

**Step 1: 在 page.tsx 添加文件预览逻辑**

当前已有的 state 变量：
```tsx
const [previewFile, setPreviewFile] = useState<string | null>(null);
const [previewOpen, setPreviewOpen] = useState(false);
```

添加异步内容获取：
```tsx
const [previewContent, setPreviewContent] = useState<string>("");
const [previewLoading, setPreviewLoading] = useState(false);

const handleOpenWorkspaceFile = useCallback(async (path: string) => {
  setPreviewFile(path);
  setPreviewOpen(true);
  setPreviewLoading(true);
  try {
    const res = await fetch(`/workspace/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setPreviewContent(data.content ?? "");
  } catch {
    setPreviewContent("// Failed to load file");
  } finally {
    setPreviewLoading(false);
  }
}, []);
```

FileBrowser 的 onOpenFile 改为调用 `handleOpenWorkspaceFile`。

在 JSX 末尾添加 FileViewDialog：
```tsx
{previewOpen && previewFile && (
  <FileViewDialog
    file={{ path: previewFile, content: previewContent }}
    onClose={() => setPreviewOpen(false)}
  />
)}
```

**Step 2: 添加 import**

```tsx
import { FileViewDialog } from "@/components/FileViewDialog";
```

**Step 3: Build 验证**

```bash
cd /d/AgentBuild/.worktrees/deepagents-foundation/web && npx next build 2>&1 | tail -5
```
Expected: Build passes.

**Step 4: Commit**

```bash
cd /d/AgentBuild/.worktrees/deepagents-foundation
git add web/src/app/page.tsx
git commit -m "feat(v2): integrate FileViewDialog with workspace file browser"
```

---

### Task F-3: E2E 验证流程

**设计规格要求：** 完整数据流需要通过真实环境验证

**分析：** 需要同时启动前端和后端，验证 chat 全流程。这需要明确的手动验证步骤。

**Step 1: 启动后端**

```bash
cd /d/AgentBuild/.worktrees/deepagents-foundation
uv run --project agent uvicorn app.main:app --host 127.0.0.1 --port 8123 --reload
```

验证：`curl http://127.0.0.1:8123/health` → `{"status":"ok"}`

**Step 2: 启动前端**

```bash
cd /d/AgentBuild/.worktrees/deepagents-foundation/web
npm run dev
```

验证：浏览器打开 `http://localhost:3000`

**Step 3: 验证清单**

```
[ ] 页面加载无 404/500 错误
[ ] SubAgentProgress 不在 idle 态时显示
[ ] 发送消息后 coordinator 返回回答
[ ] 工作区文件浏览器能列出文件和目录
[ ] 点击文件能打开文件查看
[ ] agent 创建文件后有"changed"指示标记
[ ] npm run build 通过
[ ] npm run test 全部通过
```

---

## 文件变更汇总

| Task | 文件 | 操作 |
|------|------|------|
| F-1 | `web/src/components/FileBrowser.tsx` | MODIFY — 添加 `changedPaths` prop |
| F-1 | `web/src/app/page.tsx` | MODIFY — 传递 `changedPaths` |
| F-2 | `web/src/app/page.tsx` | MODIFY — 添加异步文件加载 + FileViewDialog |
| F-3 | 无代码变更 | 纯验证流程 |

## 执行顺序

```
F-1: 文件 changed 标记    → ~10 min
F-2: FileViewDialog 集成  → ~15 min
F-3: E2E 验证流程          → ~20 min
────────────────────────────────
总计                       → ~45 min
```

**验证清单 (最终)：**
- [ ] `npm run build` 无错误
- [ ] 后端 34 测试通过
- [ ] 前端 15 测试通过
- [ ] FileBrowser 显示紫色圆点标记 agent 修改过的文件
- [ ] 工作区文件点击后能在 FileViewDialog 预览
- [ ] 文档差距已记录（GAP-1, GAP-2 为已知接受的偏差）

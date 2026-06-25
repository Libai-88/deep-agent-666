# Deep Agent 666 — 设计规格文档（合并版）

> 合并日期：2026-06-25
> 合并来源：`2026-06-24-deepagents-copilotkit-agent-design.md` + `2026-06-25-deepagents-v2-subagent-genui-design.md`

---

## 产品定位

本地优先的通用型 AI Agent 工具，面向知识工作者。单 agent 主循环 + V2 可选 coordinator 多子 agent 模式。Web 前端（Next.js + shadcn），架构预留 Windows 桌面壳。

## 架构总览

```
┌─────────────────────────────────────────────────────┐
│  Web Client (Next.js 16 + React 19 + shadcn/ui)     │
│  CopilotChat · SubAgentProgress · DiffViewer        │
│  FileBrowser · GenUIRenderer · 主题系统              │
├─────────────────────────────────────────────────────┤
│  Copilot Bridge (HttpAgent 直连 + CORS)              │
│  Original: CopilotKit Runtime → LangGraphHttpAgent   │
│  Current:  @ag-ui/client → HttpAgent → 后端 CORS    │
│  Reason: Runtime 不转发 RUN_FINISHED                │
├─────────────────────────────────────────────────────┤
│  Agent Core (FastAPI + Deep Agents + LangGraph)      │
│  V1: 单 agent (9 presets × 3 providers × 3 modes)   │
│  V2: Coordinator (Plan→Do→Review) + GenUI middleware │
└─────────────────────────────────────────────────────┘
```

## 后端

| 组件 | 技术选型 |
|------|---------|
| 框架 | FastAPI (Python 3.11+) |
| Agent 运行时 | Deep Agents (`deepagents==0.6.11`) + LangGraph (`langgraph==1.2.6`) |
| CopilotKit SDK | `copilotkit==0.1.94` |
| AG-UI 协议 | `ag-ui-langgraph==0.0.42` |
| 模型供应商 | OpenAI / Anthropic / Google（通过 `.env` 或 `/configure` 热配） |
| 权限模式 | read-only / balanced / full-access |
| 工作区工具 | `list_workspace`, `search_workspace`, `read_text_file`, `read_document`, `edit_text_file`, `run_command`, `task` (subagent spawner) |

### 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 + agent 列表 |
| `/presets` | GET | 可用 preset 列表 |
| `/configure` | POST | 运行时配置 API Key 和 Base URL |
| `/{preset_id}` | POST | V1 单 agent 执行（`add_langgraph_fastapi_endpoint`） |
| `/coordinator-{preset_id}` | POST | V2 coordinator 执行（同上） |
| `/copilotkit/{path:path}` | ALL | CopilotKitRemoteEndpoint 现代协议（可选） |
| `/workspace/files` | GET | 列出工作区目录 |
| `/workspace/file` | GET | 读取工作区文件内容 |

### V2 状态模型 (`V2AgentState`)

```python
class V2AgentState(CopilotKitState):
    phase: str = "idle"            # idle | planning | executing | reviewing | done
    plan_steps: list[dict] = []
    completed_steps: list[dict] = []
    file_changes: list[dict] = []
    review_result: str | None = None
```

### GenUI Middleware

挂载在 coordinator agent 上，执行后通过 `copilotkit_emit_state` 推送：
- `{"phase": "planning"}` — 阶段切换
- `{"genui_plan": [...]}` — 规划步骤
- `{"genui_diff": {file_path, before, after}}` — 文件变更
- `{"genui_review": "..."}` — 审查结果

## 前端

| 组件 | 技术选型 |
|------|---------|
| 框架 | Next.js 16.2.9 + React 19.2.7 |
| UI 库 | shadcn/ui (Tailwind v4) |
| 聊天 | `@copilotkit/react-core/v2` (`CopilotKit`, `CopilotChat`, `useAgent`) |
| Agent 连接 | `@ag-ui/client` (`HttpAgent`) 直连后端 |
| 主题 | `next-themes` Provider + `ThemeToggle` |
| 图标 | `lucide-react` |

### 页面结构

```
┌─ ResizablePanelGroup ─────────────────────────────────┐
│ [ThreadList] || [Chat Panel] || [Tasks & Files]        │
│              ┌─────────────────┐                       │
│              │ SubAgentProgress│                       │
│              ├─────────────────┤                       │
│              │   CopilotChat   │                       │
│              │   + ToolCallCard│                       │
│              ├─────────────────┤                       │
│              │  GenUIRenderer  │                       │
│              └─────────────────┘                       │
│ [SettingsDialog overlay]                               │
│ [FileViewDialog overlay]                               │
└────────────────────────────────────────────────────────┘
```

### 已注册的 Agent

| Agent ID | 后端端点 | 说明 |
|----------|---------|------|
| `default` | `/openai-balanced` | CopilotChat 默认 agent |
| `openai-read-only` | `/openai-read-only` | V1 只读模式 |
| `openai-balanced` | `/openai-balanced` | V1 平衡模式 |
| `openai-full-access` | `/openai-full-access` | V1 完全访问 |
| `coordinator-openai-balanced` | `/coordinator-openai-balanced` | V2 coordinator |
| `coordinator-openai-full-access` | `/coordinator-openai-full-access` | V2 coordinator |

## 权限模型

| 权限模式 | 读文件 | 写文件 | 执行命令 |
|---------|--------|--------|---------|
| read-only | ✅ | ❌ | ❌ |
| balanced | ✅ | ✅ (需审批) | ✅ (需审批) |
| full-access | ✅ | ✅ | ✅ |

## 已知技术债

| 问题 | P级 | 状态 |
|------|-----|------|
| Python VS JS SDK 协议不匹配 → Chat 全链路不通 | P0 | 需要专项攻关 |
| DataChart 组件 | P1 | 未实现 |
| 前端外观细节（暗色主题一致性、弹窗样式） | P2 | 部分已修 |
| 持久化 thread 存储 (SqliteAgentRunner) | P1 | Runtime route 已准备，但未使用 |
| V1/V2 plan 文档过时 | P2 | 已合并为本文档 |

# Deep Agent 666 — 开发进展全总结

> 生成于 2026-06-27 | Git Tag: `v1-foundation`, `v1-complete`, `gaps-complete` | 分支: `feat/deepagents-foundation`

## 2026-06-27 更新

- `Phase A` 已完成统一 runtime protocol 基线：coordinator `workbench_events`、tool 结果和 A2UI artifact 现在共享同一套 workbench event 语义，timeline / results / final summary 不再只靠 delegation 特判。
- `V27` 已完成 A2UI diff preview 激活：文本文件写入与替换现在会返回结构化编辑结果，并在聊天流中内联渲染 `DiffPreview`。
- `V1` 已在 `6a33da3 feat(v1): complete coordinator workbench runtime` 完成。
- `V2` 已在 `69d6d96 feat(v2): add release hardening baseline` 完成并推送远端。
- `V3` 已在 `380b84c test(v3): cover onboarding launch path` 收口并推送远端。
- `V4` 已在 `6788bd5 feat(v4): add durable local thread runtime` 完成并推送远端。
- `V5` 已完成 live provider activation，当前主分支状态不应再解读为 “V1 未完成”。
- `V6` 已补齐同页配置后的首条响应闭环。
- `V7` 已修正 OpenAI preset/provider 不一致，并补齐基础运行时错误分型。
- `V8` 已把真实 provider 异常收敛为协议合法的 `RUN_ERROR` 终止流。
- `V9` 已把 `Retry last task` 做成可持久化重放，恢复线程在刷新后也能重试上一个任务。
- `V10` 已能识别“线程本地仍在，但 runtime 历史已丢失”的漂移场景，并给出明确恢复入口。
- `V11` 已能识别“runtime 恢复出部分旧消息，但缺了最后一条本地任务”的部分历史漂移场景。
- `V12` 已补齐真实 CopilotKit runtime handler + SQLite thread store 的跨实例恢复证明。
- `V13` 已为主 `[[...slug]]` 路由补齐 preset catalog 本地缓存回退，`/presets` 临时不可达时仍可恢复已持久化线程。
- `V14` 已补齐 coordinator starter flow 的浏览器回归，并把 timeline 状态文案改为更适合新手理解的形式。
- `V15` 已把 runtime 配置收口到同源 `/api/runtime-config`，并让新手可在 Settings 中直接查看和切换 workspace root。
- `V16` 已补齐 coordinator 完成线程在页面刷新后的健康恢复浏览器回归，证明 restored chat 与本地 workbench 面板可以连续对齐。
- `V17` 已把线程管理产品化：支持直接重命名/删除线程，并在删除当前线程后自动回退到下一个可用线程或 starter gate。
- `V18` 已把 runtime diagnostics 产品化：支持显示运行时状态徽标，并在产品内直接查看 backend reachability、preset source、provider 配置和 workspace root。
- `V19` 已补齐 runtime bootstrap reconnect：backend 恢复后，同一标签页无需手动刷新也能重新挂载 CopilotKit 并启动首个任务。
- `V20` 已补齐 active-thread recovery shell：可恢复故障下保留当前线程工作台，不再直接把用户踢回 gate。
- `V21` 已补齐 contextual recovery actions：active-thread 在 backend 不可达且本地存有最后任务时，会直接给出 `Retry last task`，恢复后仍可在原线程内重试。
- `V22` 已补齐 coordinator recovery replay proof：coordinator 恢复线程在 reconnect 后可继续同线程重放，并避免把已有 live activity 误判成 `thread_history_unavailable`。
- `V23` 已补齐 true process restart persistence proof：真实 `next start` 进程在 backend 离线后重启，仍可通过 SQLite 线程存储和 cached preset catalog 恢复已完成线程。
- `V24` 已补齐 coordinator true process restart proof：真实 `next start` 进程在 backend 离线后重启，仍可通过 SQLite 线程存储和 cached preset catalog 恢复已完成的 coordinator 线程。
- `V25` 已补齐 coordinator browser restart continuity proof：真实 `next start` 进程在 backend 离线后重启，浏览器中的同一 coordinator 线程仍可恢复聊天、timeline、results 和 degraded 状态提示。
- `V26` 已补齐 coordinator restart history-gap replay proof：真实 `next start` 进程在 backend 离线后重启且切换到空 SQLite thread store 时，产品会明确提示 `Thread history unavailable`，并能在 backend 恢复后于原线程内重放最后任务并重新写回 runtime 历史。

---

## 一、产品是什么

本地优先的通用型 AI Agent，基于 CopilotKit + LangGraph + FastAPI。支持：

- **V1 单 agent**: 9 个预设（3 家模型提供商 × 3 种权限模式）
- **V2 Coordinator**: 子 agent 编排（Planner → Executor → Reviewer），官方 supervisor+@tool+Command 模式
- **A2A 跨语言**: A2AMiddlewareAgent 多进程编排
- **A2UI 动态渲染**: DiffPreview 组件目录
- **MCP 工具扩展**: 外部工具服务器集成

### 架构

```
Web Client (Next.js 16 + React 19 + shadcn)
  └─ CopilotChat · DelegationLog · SubAgentActivityCard · A2UI DiffPreview · ThreadList
       │
Copilot Bridge ([[...slug]] runtime handler)
  ├─ POST /agent/:id/run → 透传 SSE
  ├─ GET  /info → agent 列表
  └─ connect/stop → CopilotRuntime
       │
Agent Core (FastAPI + LangGraph + Deep Agents)
  ├─ V1: 9 presets (3 providers × 3 permission modes)
  ├─ V2: Coordinator (Planner → Executor → Reviewer)
  ├─ GenUI middleware (delegations emit)
  └─ Workspace tools (list/search/read/write/replace/run/doc)
       │
CopilotRuntime (Next.js route handler)
  ├─ A2UI: {}, openGenerativeUI: true
  ├─ MCP Apps: workspace-tools server
  └─ A2A: a2a-research middleware agent
```

---

## 二、测试状态

| 套件 | 数量 | 状态 |
|------|------|------|
| 后端 pytest | **63** | ✅ 全通过 |
| 前端 vitest | **96** | ✅ 全通过 |
| Next.js build | — | ✅ 无错误 |
| E2E (playwright) | **25** | ✅ 全通过 |
| Docker Compose 配置校验 | — | ⚠️ 当前机器未安装 `docker`，未执行命令级验证 |

---

## 三、开发历程

### 阶段 A：基础功能搭建（7 个 Phase）

目标：从零搭起完整的前后端 + CopilotKit 集成框架。

| Phase | 核心变更 | 关键问题 | 如何解决 |
|-------|---------|---------|---------|
| **P1 底座** | ADR、CI、E2E smoke、回滚脚本 | 初始项目无工程化规范 | 按官方最佳实践补充 ADR/ONBOARDING/CI，打基线 |
| **P2 Subagent** | coordinator → supervisor+@tool+Command | Deep Agents 内置子 agent 不符合官方推荐 | 参考 `subagents.py`，每个子 agent 为独立 `@tool` + `Command(update={...})` |
| **P3 A2UI** | Runtime `a2ui: {}` | A2UI 需前端目录 + Python render | 配置 runtime 启用，前端 catalog 后补 |
| **P4 A2A** | `A2AMiddlewareAgent` 注册 | 需独立子 agent 服务 | 注册 a2a-research agent 指向现有 coordinator |
| **P5 MCP** | `mcpApps` 配置 | — | `CopilotRuntime({ mcpApps: { servers: [...] } })` |
| **P6 生产就绪** | 路由清理、env 校验 | `InMemoryAgentRunner` 与 `finalizeRunEvents` 冲突 | 清理 route.ts 去重 A2A，env-check 模块；后续已继续推进 SQLite 持久化 |
| **P7 桌面+E2E** | Playwright smoke、git tag | — | Tag `v1-foundation` |

### 阶段 B：差距补齐（4 个 Phase）

代码审计发现与官方 Showcase 的差距。

| Phase | 官方参考 | 我们修复 | 之前的问题 |
|-------|---------|---------|-----------|
| **P1 布局+同步** | `demos/subagents/page.tsx`, `demo-layout.tsx` | 精确 `useRenderTool`（3 个子 agent 独立卡片 + Zod schema）、suggestion `"always"`、DelegationLog、SupervisorBanner | 通配符 `name: "*"` 一把梭、suggestion 发消息后消失 |
| **P2 A2UI** | `a2ui_fixed.py`, `a2ui/catalog.ts` | `a2ui/` 组件目录（DiffPreview）、`providers.tsx` 配置 `a2ui={{ catalog }}` | A2UI 组件从未注册过 |
| **P3 状态流** | 多处 showcase demo | 移除 `GenUIMiddleware`/`GenUIRenderer` | 旧状态流与 CoordinatorState 不兼容（读错字段） |
| **P4 打磨** | 各处小改进 | 主题对比度调优、死代码清理 | UI 太浅看不清 |

**里程碑: Tag `gaps-complete`**

### 阶段 C：代码审计修复（6 个 P）

全量代码审查后按严重度排期修复。

| # | 问题 | 严重度 | 根因 | 解决方式 | 文件 |
|---|------|--------|------|---------|------|
| 1 | Coordinator 端点不存在 | 🔴 严重 | coordinator 只加了 SDK 路径，没有独立 AG-UI 端点 | `add_langgraph_fastapi_endpoint` 注册每个 coordinator | `main.py` |
| 2 | GenUI 读错状态字段 | 🟡 主要 | 中间件读 `phase`/`plan_steps`，但 `CoordinatorState` 只有 `delegations` | 改读 `delegations` + 向下兼容 | `genui.py` |
| 3 | 子 agent 缺 running 状态 | 🟡 主要 | `_delegation_command` 只在 completed/failed 时发状态 | `_running_command` 先发 running 再发 completed | `agent_factory.py` |
| 4 | 同步 invoke 阻塞 | ⏸ 暂缓 | `agent.invoke()` 在 FastAPI 异步上下文 | LangGraph 工具同步设计特性 | `agent_factory.py` |
| 5 | 模型构建逻辑重复 | 🔵 中等 | `_build_model` 和 `build_v2_coordinator` 各写了一遍提供者参数 | 提取 `_build_model_kwargs` 共享函数 | `agent_factory.py` |
| 6 | 预设双端维护 | ⏸ 暂缓 | Python `presets.py` + TypeScript `agent-presets.ts` 各一份 | 加注释指引同步 | 两文件 |
| 7 | 死代码 V2AgentState | 🔵 中等 | 已废弃但未删除 | 删除 + 更新 `__init__.py` 和测试 | `state.py` |
| 8 | 测试覆盖 | 🔵 中等 | 仅 35 测试，核心路径无覆盖 | 新增 9 个 → 44 通过 | 多文件 |
| 9 | API 密钥明文 | 🟢 轻微 | 输入框 `type="text"` | 改为 `type="password"` | `page.tsx` |
| 10 | search 内存 | 🔵 中等 | 无文件大小限制，二进制直接读 | 10MB 上限 + 扩展白名单 | `workspace.py` |
| 11 | 路径暴露客户端 | 🟢 轻微 | `NEXT_PUBLIC_` 前缀打进浏览器包 | 去掉 `NEXT_PUBLIC_` | `page.tsx` |

---

## 四、已装机功能清单

### 前端

```
DelegationLog       — 📋⚡🧐 子 agent 委托日志（实时显示 delegations）
SubAgentActivityCard — 聊天内联彩色卡片（per tool, per status）
SupervisorBanner    — 运行时脉冲动画横幅
A2UI DiffPreview    — 文件 diff 对比组件
ToolCallCard        — 通用工具调用卡片
CopilotChat         — 多线程聊天（suggestion "always"）
TasksFilesSidebar   — todo + 文件管理侧栏
FileBrowser         — 工作区树浏览
ThreadList          — 会话历史
SettingsDialog      — 多 provider 密钥配置
                    — 支持同源 runtime-config 读写与 workspace root 热更新
RuntimeStatusBadge  — 运行时状态徽标（healthy/setup-required/degraded/offline）
RuntimeDiagnosticsDialog — 产品内运行时诊断弹窗，可刷新 backend/catalog/provider/workspace 状态
Runtime reconnect recovery — 同页 retry connection 后自动重挂 runtime bridge
Active-thread recovery shell — 可恢复故障下保留当前线程 timeline/results/workbench
ThreadList          — 支持线程重命名、删除与最近更新排序
FileViewDialog      — 文件内容预览
DiffViewer          — 内联 diff 查看器
ThemeToggle         — 明暗主题切换
SubAgentProgress    — (已废弃，被 DelegationLog 取代)
GenUIRenderer       — (已废弃，被 CopilotKitMiddleware 取代)
```

### 后端

```
V1 Agents:
  9 presets: openai/anthropic/google × read-only/balanced/full-access
  Workspace tools: list_workspace, search_workspace, read_text_file
                   write_text_file, replace_text_in_file, run_command
  Permission middlewares: interrupt_on for balanced mode (当前禁用)

V2 Coordinator:
  build_v2_coordinator: supervisor → planner/executor/reviewer
  Delegation state: running → completed/failed with operator.add reducer
  @tool wrappers: planner_tool, executor_tool, reviewer_tool

Middleware:
  CopilotKitMiddleware — state sync for V2
  GenUIMiddleware — legacy middleware for V1 (emits delegations + V2 fields)
  CORS middleware — localhost:3000

Endpoints:
  GET  /health                — agent 列表 + 数量
  GET  /config                — 当前 runtime 配置快照（不暴露 API key）
  GET  /presets               — 预设定义（供前端动态获取）
  GET  /api/runtime-diagnostics — 聚合 backend health/config + preset source 的产品内诊断快照
  POST /configure             — API 密钥 + workspace root 热更新（仅 runtime 内存态）
  GET  /workspace/files       — 目录浏览
  GET  /workspace/file        — 文件读取
  POST /{preset_id}           — AG-UI endpoint per agent
  POST /coordinator-{id}      — AG-UI endpoint per coordinator
  POST /copilotkit/{path}     — CopilotKitRemoteEndpoint SDK
```

### 运行时

```
CopilotRuntime (Next.js route handler):
  agents: LangGraphHttpAgent for each preset + coordinator
          A2AMiddlewareAgent for a2a-research
  runner: SqliteAgentRunner (`./data/threads.db` by default)
  a2ui:   {} (enabled)
  mcpApps: servers: [{workspace-tools}]
  openGenerativeUI: true

Python FastAPI:
  uvicorn on port 8123
  60 tests passing
```

---

## 五、已知未解决问题

| 问题 | 优先级 | 说明 | 必须修？ |
|------|--------|------|---------|
| 更广覆盖的 runtime restart/resume 验证仍待扩展 | 🟡 P1 | V26 已补齐真实重启后切到空 runtime store 的 history-gap replay 证明，但跨更多入口与更多 agent 组合的恢复场景仍可继续增强 | 建议继续补强 |
| #4 同步 invoke 阻塞事件循环 | 🟡 P2 | LangGraph 工具同步设计，长命令影响性能 | 否 — LangGraph 设计特性 |
| #6 预设双端维护 | 🟡 P3 | 新增预设需改 Python + TS 两处 | 否 — 有注释指引 |
| A2UI 仍只覆盖文本写入/替换 diff preview | 🟡 P3 | V27 已把 Python workspace 写工具接到 `DiffPreview`，但更多工具结果尚未扩展成 A2UI surface | 否 — 后续可扩展 |
| Coordinator 更多恢复入口仍可继续扩展 | 🟡 P2 | V22 已覆盖 reconnect 后同线程 replay 主路径，V25/V26 已补齐真实浏览器重启连续性与空 runtime store 后的同线程恢复，但 coordinator 在更多入口组合下仍可继续扩展 | 建议继续补强 |
| interrupt_on 已禁用 | 🟡 P3 | 去掉后才无 Console Error | 建议修 — 需审批流程时恢复 |
| Inspector `{}` 解析警告 | 🟢 P4 | `[CopilotKit Inspector] Failed to parse tool-call result content {}` | 否 — SDK 升级后解决 |
| 运行时恢复回归覆盖不足 | 🟡 P2 | 已切到 SQLite，但还缺“重启后继续线程”的更深 E2E | 建议补 — 属于 V4 后续验证 |
| 线程恢复与更深层入口回归覆盖仍可继续扩展 | 🟡 P1 | 当前已证明产品层可识别全空与部分历史漂移，并证明主运行时、主路由入口、coordinator 浏览器重启连续性以及空 runtime store 后的同线程 replay 都能在关键 fallback 场景下恢复消息；后续重点是扩展到更多入口与更复杂的恢复链路 | 建议继续补强 |

---

## 六、后续方向

### 什么算 "开发结束"（发布标准）

| 标准 | 当前 | 达标 |
|------|------|------|
| 后端测试 ≥ 50 | 63 ✅ | 已达标 |
| 前端测试 ≥ 20 | 96 ✅ | 已达标 |
| E2E ≥ 5 条 | 25 ✅ | 已达标 |
| 0 个 Console Error | 有 Inspector 警告 | SDK 升级 |
| Docker 部署 | ❌ | Dockerfile + compose |
| Windows 桌面壳 | ❌ | Electron wrapper |

### 建议优先级

```
P1: 扩展更多 runtime 入口与更深恢复交互场景下的 restart/resume 一致性验证
P1: CI 打通 E2E 测试（让 smoke/chat round-trip 自动运行）
P2: 补 Docker 部署方案
P3: 恢复 interrupt_on + 修复空结果
P4: Windows 桌面壳（Electron）
```

### 技术债摘要

- `GenUIMiddleware` 对 V1 是冗余的（V1 用 `create_deep_agent`，不用 middleware）
- `all_agents` 在 SDK 中同时包含 V1 + coordinator，但 coordinator 也有独立 AG-UI 端点（双重注册）
- `ConfigureRequest` 通过 HTTP 传 API 密钥（局域网可接受，生产需 HTTPS）
- `search_workspace` 仍读整个文件到内存（10MB 上限是软限制）

---

## 七、Git 历史关键点

```
v1-foundation  — 初始 7 阶段完成
v1-complete    — 全部基础功能就绪
gaps-complete  — 差距补齐 + 代码审计修复完成
```

V10 基线提交: `7558e16` — thread history gap recovery baseline
V12 基线提交: `d5b5508` — runtime persistence proof baseline
V13 基线提交: `898172a` — runtime catalog fallback baseline
V14 基线提交: `见最新提交` — coordinator workbench regression baseline
V15 基线提交: `见最新提交` — runtime config workspace-root baseline
V16 基线提交: `见最新提交` — coordinator restored-thread continuity baseline
V17 基线提交: `见最新提交` — thread management baseline
V18 基线提交: `见最新提交` — runtime diagnostics baseline
V19 基线提交: `见最新提交` — runtime bootstrap reconnect baseline
V20 基线提交: `见最新提交` — active-thread recovery shell baseline
V21 基线提交: `a24adc8` — contextual recovery actions baseline
V22 基线提交: `551e2e3` — coordinator recovery replay baseline
V23 基线提交: `f7d6e70` — true process restart persistence baseline
V24 基线提交: `186a349` — coordinator true process restart baseline

日志：
```
core.copilotkit.ai
    └─ feat/deepagents-foundation
         ├─ Phase 1: 底座 (CI/ADR/E2E)
         ├─ Phase 2: Subagent (supervisor+@tool)
         ├─ Phase 3-7: A2UI/A2A/MCP/生产
         ├─ Gap P1: 布局+精准渲染
         ├─ Gap P2: A2UI 目录
         ├─ Gap P3: 状态流清理
         ├─ Fix #1-3: 端点/running状态/GenUI
         ├─ Fix #5-11: 模型去重/死代码/安全/搜索
         ├─ feat(workbench): 混合场景任务工作台
         ├─ feat(v1): coordinator workbench runtime 完成
         └─ feat(v2): release hardening baseline
```

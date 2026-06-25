# Deep Agent 666 — 实施计划汇总（合并版）

> 合并日期：2026-06-25
> 合并来源：V1 计划 + V2 计划 + Gap Close + HttpAgent Fix
> 废弃来源：SDK Upgrade Plan（方向错误）、Frontend Merge Plan（已过时）

---

## 已完成的工作

### Phase 1: V1 基础设施

| Task | 文件 | 测试 | 状态 |
|------|------|------|------|
| FastAPI 后端框架 | `main.py`, `config.py`, `permissions.py` | — | ✅ |
| 9 Agent presets | `presets.py`, `agent_factory.py` | `test_agent_factory.py` | ✅ |
| 工作区工具集 | `tools/workspace.py` | `test_workspace_tools.py` (3) | ✅ |
| CopilotKit Runtime 路由 | `[...slug]/route.ts`, `copilot-runtime.ts` | `copilot-runtime.test.ts` (4) | ✅ |
| 前端 shadcn 组件库 | `components/ui/*`, `globals.css`, `layout.tsx` | — | ✅ |
| 主题/品牌系统 | `ThemeToggle.tsx`, 全局 CSS 变量 | — | ✅ |
| 34 后端测试 + 15 前端测试 | 全部通过 | — | ✅ |

### Phase 2: V2 Subagent + GenUI

| Task | 文件 | 测试 | 状态 |
|------|------|------|------|
| V2AgentState | `state.py` | `test_v2_state.py` (3) | ✅ |
| Coordinator (3 subagents) | `agent_factory.py` | `test_v2_coordinator.py` (10) | ✅ |
| Coordinator 端点注册 | `main.py` | `test_v2_endpoints.py` (5) | ✅ |
| GenUI Middleware | `middleware/genui.py` | `test_v2_genui.py` (8) | ✅ |
| SubAgentProgress 组件 | `SubAgentProgress.tsx` | — | ✅ |
| DiffViewer 组件 | `DiffViewer.tsx` | — | ✅ |

### Phase 3: Workspace File Browser

| Task | 文件 | 测试 | 状态 |
|------|------|------|------|
| 后端端点 | `main.py` (GET workspace) | `test_workspace_tools.py` (3) | ✅ |
| FileBrowser 组件 | `FileBrowser.tsx` | — | ✅ |
| FileViewDialog 组件 | `FileViewDialog.tsx` | — | ✅ |
| 浏览器直连 (HttpAgent) | `providers.tsx` | — | ✅ |

### Phase 4: 修复与调整

| Task | 文件 | 状态 |
|------|------|------|
| File changed 紫色圆点 | `FileBrowser.tsx` | ✅ |
| GenUIRenderer 面板 | `page.tsx` (内联) | ✅ |
| CORS 中间件 | `main.py` | ✅ |
| HttpAgent 替代 LangGraphHttpAgent | `copilot-runtime.ts`, `providers.tsx` | ✅ |
| SDK 升级尝试（废弃） | — | ❌ 方向错误 |
| UI 暗色主题 + 侧边栏 + 弹窗 | `globals.css`, `page.tsx` | ✅ 2026-06-25 |

---

## 未完成的工作

| Task | 优先级 | 说明 |
|------|--------|------|
| Chat 全链路打通 | P0 | Python JS SDK 协议不匹配，需专项攻关 |
| DataChart 组件 | P1 | V2 spec 可选组件 |
| Thread 持久化 | P1 | SqliteAgentRunner 后端已准备，未启用 |
| Windows 桌面壳 | P2 | 未来阶段 |

---

## 关键决策记录

| 决策 | 时间 | 原因 |
|------|------|------|
| 选用 `HttpAgent` 直连替代 CopilotKit Runtime | 2026-06-25 | Runtime 不转发 RUN_FINISHED，导致 INCOMPLETE_STREAM |
| 添加 CORS 中间件 | 2026-06-25 | HttpAgent 直连需要跨域支持 |
| 废弃 `CopilotKitRemoteEndpoint` 方案 | 2026-06-25 | 与 `LangGraphAGUIAgent` 接口不兼容 |
| 保留 `add_langgraph_fastapi_endpoint` | 2026-06-25 | 该模式 SSE 流完整，被 HttpAgent 正确消费 |
| `build_langgraph_agents` 返回 `LangGraphAGUIAgent` | 2026-06-25 | 同时兼容旧注册和新 `CopilotKitRemoteEndpoint` |

---

## 测试状态

| 套件 | 数量 | 状态 |
|------|------|------|
| 后端 (pytest) | 34 | ✅ 全部通过 |
| 前端 (vitest) | 15 | ✅ 全部通过 |
| E2E (playwright) | 1 | ⏭️ 跳过（SDK 兼容问题） |
| Build (next build) | — | ✅ 编译成功 |

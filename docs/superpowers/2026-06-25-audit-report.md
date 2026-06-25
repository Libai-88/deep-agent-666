# 开发文档 vs 实际实现差距审计

> 生成于 2026-06-25，涵盖所有 specs/ 和 plans/ 文件

---

## 1. V1 Spec: `specs/2026-06-24-deepagents-copilotkit-agent-design.md`

### 规划内容

四层架构：Agent Core (FastAPI+Deep Agents) → Copilot Bridge (Runtime route) → Web Client (Next.js+shadcn) → Future Windows Shell。9 个 presets（3 供应商 × 3 权限模式），单 agent 启动，本地优先。

### 实际实现

| 规划项 | 实际 | 差异 |
|--------|------|------|
| 四层架构 | Agent Core → Copilot Bridge → Web Client 三层就绪，Windows Shell 未开始 | **一致**，Shell 在 spec 中标注为未来项 |
| 9 个 presets | 9 个 presets 全部定义，但只有 `openai-*` 可实例化（另 6 个需要 API Key） | **一致**，按设计运行 |
| 权限模式 | read-only / balanced / full-access 三档 | **一致** |
| Deep Agents + CopilotKit | `deepagents==0.6.11`, `copilotkit==0.1.94`, `@copilotkit/react-core@1.61.1` | **一致**（版本号可能旧，但架构对） |
| 本地优先 | 全部本地运行，无云依赖 | **一致** |
| CopilotKit Runtime 代理 | 原设计用 `createCopilotRuntimeHandler` + `LangGraphHttpAgent`，实际改为浏览器 `HttpAgent` 直连后端 | ⚠️ **偏差**：Runtime 代理转发 RUN_FINISHED 失败，改用 `agents__unsafe_dev_only` + CORS |
| 聊天功能 | 页面可加载，发送消息会触发后端执行，但 `INCOMPLETE_STREAM` 导致前端报错 | ⚠️ **偏差**：SDK 协议不匹配，聊天全链路未打通 |

### 结论

架构设计总体准确，但两个偏差：Runtime 代理不可用（SDK 兼容问题），聊天流未完全打通。

---

## 2. V2 Spec: `specs/2026-06-25-deepagents-v2-subagent-genui-design.md`

### 规划内容

Plan→Do→Review 三层子 agent、GenUI middleware 推 phase/plan/diff/review 状态、前端 SubAgentProgress + DiffViewer + FileBrowser 组件、Workspace 文件浏览器端点。

### 实际实现

| 规划项 | 实际 | 差异 |
|--------|------|------|
| 三层子 agent (planner/executor/reviewer) | `build_v2_coordinator()` 实现，10 个测试通过 | ✅ **一致** |
| GenUI middleware | `middleware/genui.py` 实现，8 个测试通过 | ✅ **一致** |
| SubAgentProgress | `SubAgentProgress.tsx` 实现，页面集成 | ✅ **一致** |
| DiffViewer | `DiffViewer.tsx` 实现 | ✅ **一致** |
| FileBrowser + FileViewDialog | 两个组件实现，页面集成 | ✅ **一致** |
| 工作区后端端点 | `GET /workspace/files`, `GET /workspace/file` 实现，3 个测试 | ✅ **一致** |
| GenUIRenderer (gap close) | `page.tsx` 内联实现 | ✅ **一致**（非独立文件） |
| DataChart（P1 可选） | 未实现 | ⚠️ **缺失**（标为可选） |
| coordinator 端点注册 | 通过 `add_langgraph_fastapi_endpoint` 注册在 `/coordinator-{presetId}` | ✅ **一致** |
| 紫色圆点指示器 | `FileBrowser.changedPaths` prop 实现 | ✅ **一致** |

### 结论

V2 spec 覆盖率高，DataChart 是唯一未实现项（P1 可选）。

---

## 3. V1 Plan: `plans/2026-06-24-deepagents-copilotkit-v1-foundation.md` (1824 行)

### 实际完成度：~90%

| 区块 | 状态 |
|------|------|
| Python 后端 9 presets + 权限系统 | ✅ |
| 工作区工具实现 | ✅ |
| CopilotKit Runtime 路由 | ⚠️ 不可用（SDK 兼容问题），替代方案：HttpAgent 直连 |
| 前端 shadcn 组件 + CopilotChat | ✅ |
| 主题/品牌系统 | ✅ |
| 测试 (34 backend + 15 frontend) | ✅ |

---

## 4. V2 Plan: `plans/2026-06-25-deepagents-v2-implementation.md` (596 行)

### 实际完成度：~90%

| Task | 状态 |
|------|------|
| 1.1 V2AgentState | ✅ |
| 1.2 Coordinator + subagents | ✅ |
| 1.3 端点注册 | ✅ |
| 1.4 SubAgentProgress | ✅ |
| 2.1 GenUI middleware | ✅ |
| 2.2 DiffViewer | ✅ |
| 3.1 Workspace 后端 | ✅ |
| 3.2 FileBrowser + FileViewDialog | ✅ |
| 3.3 DataChart | ❌ （P1 可选，未做） |

---

## 5. 其他 Plans

| Plan | 状态 | 说明 |
|------|------|------|
| `v2-gap-close-plan.md` | ✅ 2/3 完成 | F-3 E2E 验证被 SDK 兼容问题 blocked |
| `frontend-merge-plan.md` | ✅ 废弃 | 合并 CopilotKit v2 包和 shadcn 的任务已过时，当前前端已独立运行 |
| `polish-plan.md` | ✅ 部分完成 | 品牌色/主题已落地，部分 UI 优化 pending |
| `sdk-upgrade-plan.md` | ❌ 废弃 | 方向错误，`CopilotKitRemoteEndpoint` 与 `LangGraphAGUIAgent` 不兼容 |
| `httpagent-fix-plan.md` | ✅ 100% | 已落地 |

---

## 关键差距汇总

### 需要修复的（技术债）

| 问题 | 严重度 | 说明 |
|------|--------|------|
| SDK 协议不匹配 → Chat 全链路不通 | P0 | Python `copilotkit==0.1.94` + `ag-ui-langgraph==0.0.42` 与前端 `@ag-ui/client@0.0.57` / `@copilotkit/runtime@1.61.1` 不兼容。需专项攻关 |
| DataChart 未实现 | P1 | V2 spec 中的可选组件 |

### 已接受的偏差（不修复）

| 偏差 | 原因 |
|------|------|
| `agents__unsafe_dev_only` 代替 `createCopilotRuntimeHandler` | Runtime 代理不转发 RUN_FINISHED。直接连接是正确方案 |
| CORS 直连模式 | 绕过 Runtime 代理的必要代价，CORS 已配置 |

### 过时文档

| 文件 | 原因 |
|------|------|
| `sdk-upgrade-plan.md` | 方向错误，CopilotKitRemoteEndpoint 方案不可行 |
| `frontend-merge-plan.md` | 合并任务已完成，前端已独立运行 |
| `polish-plan.md` | 品牌/主题已落地，剩余 UI 问题在 page.tsx 中可追溯 |

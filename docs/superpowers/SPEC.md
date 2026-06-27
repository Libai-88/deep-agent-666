# Deep Agent 666 — 设计规格

> 最后更新：2026-06-27

## 产品定位

本地优先的通用型 AI Agent，面向知识工作者。单 agent + 可选 coordinator 多子 agent 模式。Web 前端（Next.js + shadcn），架构预留 Windows 桌面壳。

## 架构

```
┌─ Web Client (Next.js 16 + React 19 + shadcn) ─────────┐
│ CopilotChat · SubAgentProgress · DiffViewer             │
│ FileBrowser · GenUIRenderer · 主题系统                  │
├─ Copilot Bridge (RuntimeUrl + HttpAgent proxy) ────────┤
│ Browser → runtimeUrl → [[...slug]] route handler       │
│  ├─ GET  /, /info     → backend agent list + "default"  │
│  ├─ POST /agent/:id/run → proxy 后端原始 SSE (透传)     │
│  └─ 其他 (connect, stop) → CopilotKit Runtime handler   │
├─ Agent Core (FastAPI + Deep Agents + LangGraph) ───────┤
│ V1: 单 agent (9 presets × 3 providers × 3 modes)       │
│ V2: Coordinator (Plan→Do→Review) + GenUI middleware     │
├─ Runtime Persistence (CopilotKit + SQLite runner) ─────┤
│ SqliteAgentRunner -> ./data/threads.db (configurable)   │
└────────────────────────────────────────────────────────┘
```

## 技术选型

| 层 | 技术 |
|----|------|
| 后端 | FastAPI + Deep Agents 0.6.11 + LangGraph 1.2.6 + copilotkit 0.1.94 |
| 运行时 | ag-ui-langgraph 0.0.42 (add_langgraph_fastapi_endpoint) |
| 前端 | Next.js 16 + React 19 + @copilotkit/react-core v2 |
| 代理层 | @ag-ui/client HttpAgent + createCopilotRuntimeHandler |
| UI | shadcn/ui + Tailwind v4 + lucide-react |
| 测试 | pytest (61) + vitest (85) + playwright (19) |

## 关键决策

- `HttpAgent` 替代 `LangGraphHttpAgent` — 通用 HTTP AG-UI 客户端，适合自托管后端
- `agents__unsafe_dev_only` → `runtimeUrl` — 用 CopilotKit Runtime 代理，保留扩展性
- 本地默认 runner 使用 `SqliteAgentRunner` — 线程运行时状态写入 `./data/threads.db`
- Provider 配置应 live 生效 — Settings 保存后无需重启后端即可激活对应 preset / coordinator
- Root runtime bootstrap 需同页可重入 — 首次配置后必须在当前 tab 内挂起 `CopilotKit` 并允许首条任务直接返回响应
- Provider 文案必须与默认模型/默认 base URL 一致 — `OpenAI` 预设不能再引用 OpenRouter 专属模型名
- Runtime config 应走应用自有同源路由 — UI 读取/写入 runtime 配置时优先经过 Next.js route，而不是浏览器直连后端端口
- Workspace root 应可在运行时切换 — 新手不应被迫为了改工作目录而手改 `.env` 或重启服务
- Local threads 应支持基础生命周期管理 — 新手必须能在产品内重命名和删除线程，而不是依赖浏览器 localStorage 清理
- Runtime diagnostics 应产品内可见 — 新手必须能在 UI 中看到 backend reachability、preset source 和 provider readiness，而不是只靠错误文案猜状态
- Runtime recovery must re-bootstrap the active tab — 页面不能只把状态刷新成 healthy，还必须让当前 tab 内的 CopilotKit runtime 真正重新挂载
- Recoverable active-thread failures should preserve local context — 只要线程本身有效，timeline/results/last prompt 不应因为 backend/runtime 可恢复故障而被 gate 挡住
- CORS middleware (Python) — 开发模式需要（已不再需要，因为不走浏览器直连）

## 已知技术债

| 问题 | P级 | 说明 |
|------|-----|------|
| 更广覆盖的 runtime restart/resume 仍待扩展 | P1 | V20 已补齐 active-thread recoverable error shell preservation，但跨更多入口与真实进程重启的覆盖仍可继续增强 |
| DataChart 组件 | P1 | V2 spec 可选组件，未实现 |
| 更广对话恢复验证 | P1 | 已启用 `SqliteAgentRunner`，并覆盖 prompt 重放、历史缺失、部分历史漂移提示、主运行时跨实例恢复证明、主路由 catalog fallback 恢复，以及 coordinator starter 主工作流回归；后续仍可扩展到更多入口与真实进程重启 |

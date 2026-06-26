# Deep Agent 666 — 设计规格

> 最后更新：2026-06-26

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
| 测试 | pytest (34) + vitest (15) |

## 关键决策

- `HttpAgent` 替代 `LangGraphHttpAgent` — 通用 HTTP AG-UI 客户端，适合自托管后端
- `agents__unsafe_dev_only` → `runtimeUrl` — 用 CopilotKit Runtime 代理，保留扩展性
- POST agent run 透传 — 绕过 SqliteAgentRunner 的 `finalizeRunEvents`，避免 INCOMPLETE_STREAM
- CORS middleware (Python) — 开发模式需要（已不再需要，因为不走浏览器直连）

## 已知技术债

| 问题 | P级 | 说明 |
|------|-----|------|
| Chat 全链路不通 (INCOMPLETE_STREAM) | P0 | Python SDK (0.1.x) 与 JS SDK (1.61.x) 协议不匹配。`finalizeRunEvents` 与 `HttpAgent` SSE 事件处理存在时序/格式冲突。当前 proxy 透传方案绕过此问题，但 Chat 消息客户端仍报 INCOMPLETE_STREAM |
| DataChart 组件 | P1 | V2 spec 可选组件，未实现 |
| SqliteAgentRunner 线程持久化 | P1 | 未启用（agent run 不走 runner） |

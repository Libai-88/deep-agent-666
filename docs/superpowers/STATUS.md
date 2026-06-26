# Deep Agent 666 — 当前状态

> 最后更新：2026-06-26

## 测试状态

| 套件 | 数量 | 状态 |
|------|------|------|
| 后端 (pytest) | 34 | ✅ |
| 前端 (vitest) | 15 | ✅ |
| Build (next build) | — | ✅ |
| E2E 代理透传 | — | ✅ RUN_FINISHED: 1 |

## 已完成

### Phase 1: V1 基础设施
- FastAPI 后端框架 + 9 presets + 3 权限模式
- 工作区工具集 (list/search/read/edit/run)
- 前端 shadcn 组件 + 主题系统
- 34 后端 + 15 前端测试

### Phase 2: V2 Subagent + GenUI
- Coordinator agent (Plan→Do→Review) + 10 测试
- GenUI middleware + 8 测试
- SubAgentProgress / DiffViewer / FileBrowser 组件
- GenUIRenderer 面板

### Phase 3: 协议对齐
- `HttpAgent` 替代 `LangGraphHttpAgent`
- Runtime proxy (`[[...slug]]/route.ts`)
- CORS middleware
- agent run 透传 (绕过 finalizeRunEvents)
- ThreadList 水合错位修复
- default agent 注入

## 未完成

| 任务 | P级 | 说明 |
|------|-----|------|
| Chat 全链路打通 | P0 | Python/JS SDK 协议不匹配，需专项攻关 |
| DataChart 组件 | P1 | V2 spec 可选组件 |
| Thread 持久化 (SqliteAgentRunner) | P1 | agent run 不走 runner |
| Windows 桌面壳 | P2 | 未来阶段 |

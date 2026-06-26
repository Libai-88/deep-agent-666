# Deep Agent 666 — 当前状态

> 最后更新：2026-06-26 (Phase 1 底座加固完成)

## 测试状态

| 套件 | 数量 | 状态 |
|------|------|------|
| 后端 (pytest) | 34 | ✅ |
| 前端 (vitest) | 15 | ✅ |
| Build (next build) | — | ✅ |
| E2E smoke (playwright) | 3 | 🔧 脚本就绪，待 CI 运行 |
| CI 自动化 | — | 🔧 .github/workflows/ci.yml 就绪 |

## 已完成

### Phase 1: 底座加固 ✅
- ADR 记录 3 条 (LangGraphHttpAgent / 路由模式 / Runner 选择)
- ONBOARDING.md 新人指南
- CI 配置 (.github/workflows/ci.yml) 三防线：pytest → vitest → build → playwright
- 回滚脚本 (scripts/reset-to-stable.sh)
- E2E smoke test (web/tests/e2e/smoke.spec.ts)
- 基线 tag: v1-foundation

### Previous
- V1 基础设施 (9 presets, 3 权限模式, 工作区工具)
- V2 Subagent + GenUI (coordinator, middleware, SubAgentProgress, DiffViewer, FileBrowser)
- 协议对齐 (LangGraphHttpAgent, [[...slug]] 路由, CORS)
- Page 200、Info 19 agents(default✅)、Run FINISHED: 1

## 未完成

| 任务 | P级 | 阶段 | 说明 |
|------|-----|------|------|
| Subagent 完整跑通 | P0 | P2 | 改造 coordinator 为官方 supervisor+@tool+Command 模式 |
| A2UI 动态渲染 | P1 | P3 | 注册自定义组件，sandbox 安全 |
| A2A 跨语言多 agent | P1 | P4 | A2A 协议编排 |
| MCP 工具扩展 | P1 | P5 | 外部 MCP 服务器 |
| 线程持久化 | P1 | P6 | SqliteAgentRunner + finalizeRunEvents 修复 |
| DataChart 组件 | P2 | — | V2 spec 可选 |

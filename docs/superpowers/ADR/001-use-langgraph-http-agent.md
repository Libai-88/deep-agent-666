# ADR-001: 使用 LangGraphHttpAgent 连接 Python 后端

**日期：** 2026-06-26  
**状态：** 已采纳  

## 背景

项目需要一个“桥梁”组件，将 Next.js 前端通过 CopilotKit Runtime 连接到 Python FastAPI 后端（`add_langgraph_fastapi_endpoint`）。

有两个可选方案：
- `HttpAgent`（来自 `@ag-ui/client`）—— 通用 HTTP AG-UI 客户端
- `LangGraphHttpAgent`（来自 `@copilotkit/runtime/langgraph`）—— 专为 FastAPI 端点设计

## 决策

使用 `LangGraphHttpAgent`。

## 理由

1. 与官方 `examples/integrations/langgraph-fastapi` 完全一致，该示例使用 `add_langgraph_fastapi_endpoint` + `LangGraphHttpAgent`
2. `LangGraphHttpAgent` 在 Runtime handler 的标准管道中正确产生 `RUN_FINISHED`，不需要 proxy 透传
3. `HttpAgent` 搭配 `SqliteAgentRunner` 时有 `finalizeRunEvents` 时序冲突，导致 `INCOMPLETE_STREAM`

## 后果

- 正面：agent run 走标准 Runtime 管道，无额外 proxy 层
- 负面：依赖 `@copilotkit/runtime/langgraph` 子包，升级时需关注兼容性

## 参考

- `examples/integrations/langgraph-fastapi/src/app/api/copilotkit/[[...slug]]/route.ts`
- `packages/runtime/src/v2/runtime/handlers/sse/run.ts`

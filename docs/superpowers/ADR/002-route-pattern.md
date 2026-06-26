# ADR-002: [[...slug]] 单路由模式 + createCopilotRuntimeHandler

**日期：** 2026-06-26  
**状态：** 已采纳  

## 背景

Next.js App Router 的路由文件组织方式影响请求分发逻辑。

可选方案：
- 两个独立文件：`route.ts`（根路径）+ `[...slug]/route.ts`（子路径）
- 单个文件：`[[...slug]]/route.ts`（可选 catch-all）

## 决策

使用 `[[...slug]]` 单个路由文件，结合 `createCopilotRuntimeHandler`。

## 理由

1. 官方 `examples/integrations/langgraph-fastapi` 使用 `[[...slug]]` — 单一入口，路径一致
2. 减少重复代码（不用在两个文件里复制 Runtime 构造逻辑）
3. `createCopilotRuntimeHandler` 内部通过 `matchRoute()` 按后缀匹配分发（/info → info 路由，/agent/:id/run → agent run 路由），单文件足以覆盖所有路径

## 后果

- 正面：路由逻辑集中在一处，易于维护
- 负面：需要 `@copilotkit/runtime/v2` 版本支持 `createCopilotRuntimeHandler`（当前 1.61.1 支持）

## 参考

- `examples/integrations/langgraph-fastapi/src/app/api/copilotkit/[[...slug]]/route.ts`
- `packages/runtime/src/v2/runtime/core/fetch-handler.ts`

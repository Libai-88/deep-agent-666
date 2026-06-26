# ADR-003: 使用 InMemoryAgentRunner 代替 SqliteAgentRunner

**日期：** 2026-06-26  
**状态：** 已采纳（临时）  

## 背景

种子项目的目标不是持久化，而是功能验证。AgentRunner 的选择影响线程存储和事件终结逻辑。

可选方案：
- `SqliteAgentRunner` — SQLite 持久化，调用 `finalizeRunEvents()` 校验终端事件
- `InMemoryAgentRunner` — 内存存储，无持久化，无 `finalizeRunEvents` 校验

## 决策

当前使用 `InMemoryAgentRunner`。计划在第六阶段（生产就绪）迁回 `SqliteAgentRunner`。

## 理由

1. `SqliteAgentRunner.run()` 在 `agent.runAgent()` 完成后调用 `finalizeRunEvents(currentRunEvents)`，检查事件列表是否包含 `RUN_FINISHED` 或 `RUN_ERROR`
2. 后端 SSE 流虽然包含 `RUN_FINISHED`，但 `finalizeRunEvents` 的检查与 `@ag-ui/client` 内部的 `verifyEvents` 存在时序/格式冲突，导致 `INCOMPLETE_STREAM`
3. `InMemoryAgentRunner` 同样有 `finalizeRunEvents`，但实测不会触发这个冲突
4. 当前阶段优先保证跑通，而非持久化

## 后果

- 正面：agent run 无报错，Chat 可收发
- 负面：页面刷新后线程丢失（无 SQLite 存储）
- 后续：第六阶段需要正面解决 `finalizeRunEvents` 冲突问题

## 迁移计划

第六阶段将：
1. 切回 `SqliteAgentRunner`
2. 如果 `finalizeRunEvents` 仍冲突，创建自定义 Runner 透传
3. 添加线程持久化 E2E 测试（刷新页面后对话还在）

## 参考

- `packages/sqlite-runner/src/sqlite-runner.ts` 第 328 行 `finalizeRunEvents`
- `packages/shared/src/finalize-events.ts`

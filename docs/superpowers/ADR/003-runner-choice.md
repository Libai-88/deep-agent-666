# ADR-003: 运行时线程存储从临时 InMemory 切换到 SqliteAgentRunner

**日期：** 2026-06-26  
**更新：** 2026-06-27  
**状态：** 已采纳（现行）  

## 背景

种子项目的目标不是持久化，而是功能验证。AgentRunner 的选择影响线程存储和事件终结逻辑。

可选方案：
- `SqliteAgentRunner` — SQLite 持久化，调用 `finalizeRunEvents()` 校验终端事件
- `InMemoryAgentRunner` — 内存存储，无持久化，无 `finalizeRunEvents` 校验

## 历史决策

项目在早期验证阶段曾临时使用 `InMemoryAgentRunner`，原因是当时需要先确保基础聊天链路和工作台链路可跑通，再处理持久化问题。

## 当时改用 InMemory 的理由

1. `SqliteAgentRunner.run()` 在 `agent.runAgent()` 完成后调用 `finalizeRunEvents(currentRunEvents)`，检查事件列表是否包含 `RUN_FINISHED` 或 `RUN_ERROR`
2. 后端 SSE 流虽然包含 `RUN_FINISHED`，但 `finalizeRunEvents` 的检查与 `@ag-ui/client` 内部的 `verifyEvents` 存在时序/格式冲突，导致 `INCOMPLETE_STREAM`
3. `InMemoryAgentRunner` 同样有 `finalizeRunEvents`，但实测不会触发这个冲突
4. 当前阶段优先保证跑通，而非持久化

## 当时后果

- 正面：agent run 无报错，Chat 可收发
- 负面：页面刷新后线程丢失（无 SQLite 存储）
- 后续：必须回到持久化 runner，否则产品达不到通用工作代理的连续性要求

## 现行决策

当前真实运行路由改为 `SqliteAgentRunner`，作为本地默认线程运行时存储方案。

实现方式：
1. `web/src/app/api/copilotkit/[[...slug]]/route.ts` 使用 `new SqliteAgentRunner({ dbPath })`
2. 默认数据库文件路径为 `./data/threads.db`
3. 允许通过 `COPILOTKIT_THREADS_DB_PATH` 覆盖

## 理由

1. `InMemoryAgentRunner` 只适合开发期临时验证，不适合作为本地通用 agent 的默认配置
2. 当前仓库已经具备 `@copilotkit/sqlite-runner` 和 `better-sqlite3` 依赖，不存在额外基础设施门槛
3. 本产品的第一性目标是像 Codex 一样持续操作工作线程，线程状态不能在常规重启后直接蒸发
4. 官方运行时文档明确将 `SqliteAgentRunner` 作为本地持久化推荐路径

## 后果

- 正面：线程运行时状态具备本地文件级持久化能力
- 正面：README、状态页、架构文档可以不再把“后端运行时天然不持久化”当成现状
- 风险：如果后续再次观察到事件终结冲突，需要补充更细的运行时回归测试或自定义 runner 包装层

## 后续要求

1. 保持路由层测试覆盖真实 runner 选择
2. 保持默认 `dbPath` 为显式文件路径，而不是隐式内存
3. 后续若扩展为多机部署，再单独评估持久化后端，不在本 ADR 范围内

## 参考

- `packages/sqlite-runner/src/sqlite-runner.ts` 第 328 行 `finalizeRunEvents`
- `packages/shared/src/finalize-events.ts`

# Deep Agent 666 — 集大成开发方案

> 生成于 2026-06-26
> 基于：CopilotKit 官方仓库 (`D:\AgentBuild\copilotkit-repo`) 所有示例的架构分析

---

## 核心理念

1. **官方示例优先** — 每个阶段的起点不是自己设计，而是克隆官方示例，改造成自己的需求。确保每一层都有经过验证的参考实现。
2. **增量吸收** — 不从零重写，在现有 V1+V2 基础之上，按阶段吸收官方的新模式。
3. **每阶段可回滚** — 每个阶段结束打 tag，出问题 `git reset --hard` 回到上阶段。
4. **稳定性 = 测试覆盖率** — 后端 pytest + 前端 vitest + E2E playwright，三层防线。

---

## 第一阶段：底座稳固（当前基线 → 稳定态）

### 目标

现有代码已经跑通（Page 200, Info 19 agents, Run FINISHED 1）。第一阶段就是把它加固成可重现可依赖的基座。

### 底座搭法

```
docs/superpowers/
├── SPEC.md           ← 架构文档（已有）
├── STATUS.md         ← 状态文档（已有）
├── PLAN.md           ← 本文件
├── ADR/              ← 架构决策记录（新增）
│   ├── 001-use-langgraph-http-agent.md
│   ├── 002-route-pattern.md
│   └── 003-runner-choice.md
├── DRI.md            ← 每个模块负责人/联系信息（新增）
└── ONBOARDING.md     ← 新人 30 分钟上手指南（新增）
```

### 稳定运行的标准

| 检查项 | 标准 | 验证方式 |
|--------|------|---------|
| 后端测试 | 34 pass | `uv run --project agent pytest` |
| 前端测试 | 15 pass | `npx vitest run` |
| Build | clean | `npx next build` |
| Page 加载 | 200, 无控制台报错 | 打开浏览器验证 |
| Info 端点 | 19 agents, has default | `curl /api/copilotkit` |
| Run 端点 | RUN_FINISHED: 1 | `curl /agent/openai-balanced/run` |
| ThreadList | 无 hydration 错误 | 浏览器加载侧边栏 |

### 底座交付物

- [ ] ADR 记录：当前每个架构决策的原因（为什么用 LangGraphHttpAgent、为什么用 v2 Runtime、为什么用 InMemoryAgentRunner）
- [ ] ONBOARDING.md：新开发者 30 分钟完成环境搭建、启动前后端、跑测试
- [ ] CI 配置：每次 PR 自动跑 pytest + vitest + build
- [ ] 回滚脚本：`scripts/reset-to-stable.sh` 一键回滚到上一阶段 tag
- [ ] 端到端基础测试：playwright 启动前后端、加载页面、检查无报错

---

## 后续阶段规划总览

| 阶段 | 名称 | 参考官方示例 | 核心吸收点 | 预计工作量 |
|------|------|-------------|-----------|----------|
| 1 | 底座加固 | — | CI、ADR、ONBOARDING、E2E | 2-3 天 |
| 2 | Subagent 完整跑通 | `showcase/integrations/langgraph-fastapi` | supervisor+@tool+Command 委托、delegations 状态同步 | 3-5 天 |
| 3 | A2UI 动态渲染 | `showcase/integrations/langgraph-fastapi` (a2ui_fixed/dynamic) | A2UIMiddleware、动态组件注册、sandbox functions | 3-5 天 |
| 4 | A2A 跨语言多 agent | `examples/integrations/a2a-middleware` | A2A 协议编排、跨进程 agent 通信 | 3-5 天 |
| 5 | MCP 工具扩展 | `examples/showcases/mcp-apps` | MCPAppsMiddleware、外部工具服务器 | 2-3 天 |
| 6 | 线程持久化 + 生产就绪 | `examples/integrations/langgraph-fastapi` (Intelligence 模式) | SqliteAgentRunner、认证、rate limiting | 3-5 天 |
| 7 | E2E + 桌面打包 | `Dockerfile`, `playwright.config.ts` | 完整 E2E 测试套件、Electron/Tauri 壳 | 5-7 天 |

---

## 第二阶段：Subagent 完整跑通

### 参考源

**目录：** `D:\AgentBuild\copilotkit-repo\showcase\integrations\langgraph-fastapi`

### 吸收哪些代码

| 官方文件 | 我们要做的 | 目标 |
|---------|-----------|------|
| `src/agents/src/subagents.py` | 用 supervisor+@tool+Command 模式改写我们的 coordinator | 去掉 hand-coded 子 agent 循环，改为官方 LLM 驱动的委托 |
| `src/agents/src/subagents.py` 的 `Delegation` + `AgentState` | 统一 V2AgentState 的 phase/plan/complete 到 delegations 模式 | 前端统一订阅 `state.delegations` |
| `src/app/demos/subagents/page.tsx` 的 `useAgent` + `useRenderTool` | 替换现有 SubAgentProgress + GenUIRenderer | 前后端数据流对齐官方 |
| `src/app/demos/subagents/delegation-log.tsx` | 参考实现 DelegationLog 组件 | 实时显示子 agent 执行进度 |
| `src/app/demos/subagents/subagent-activity-card.tsx` | 聊天内联子 agent 卡片 | 每条委托在聊天流中可见 |

### 验证标准

- [ ] 25s 内 supervisor 完成 research → write → critique 完整流程
- [ ] `state.delegations` 实时同步到前端 DelegationLog
- [ ] 每个子 agent 在聊天中渲染独立活动卡片
- [ ] 后端测试通过（新增 subagent 测试）+ 前端测试通过
- [ ] 打 tag `v2-subagent`

### 如何确保不偏离主线

1. **不改动 V1 单 agent 功能** — 只在新的 coordinator endpoint 上实验
2. **ADL 记录：** 每个设计决策（为什么用 `Command` 而不是直接调、为什么用 `operator.add` 归约器）写入 `docs/superpowers/ADR/`
3. **每完成一个子任务 commit，commit message 格式：** `feat(subagent): xxx`
4. **阶段结束才合并入主分支** — 全程在 feature branch 开发

---

## 第三阶段：A2UI 动态渲染

### 参考源

**目录：** `D:\AgentBuild\copilotkit-repo\showcase\integrations\langgraph-fastapi`
- `src/agents/src/a2ui_fixed.py` — 固定 A2UI 组件
- `src/agents/src/a2ui_dynamic.py` — 动态 A2UI 组件
- `src/agents/src/a2ui_schemas/` — 组件 schemas
- `src/app/api/a2ui/route.ts` — A2UI sandbox 端点

### 吸收哪些代码

| 官方文件 | 我们要做的 | 目标 |
|---------|-----------|------|
| `a2ui_fixed.py` 的 `A2UIMiddleware` 注册 | 在我们的 coordinator 上启用 A2UIMiddleware | LLM 可以渲染 UI 组件（图表、表单、卡片） |
| `a2ui_dynamic.py` 的组件注册 | 注册自定义组件 | 文件 diff 视图、进度条、确认对话框 |
| `page.tsx` 的 `sandboxFunctions` | 实现 sandbox 安全沙箱 | A2UI 组件安全执行 |
| `route.ts` 的 A2UI 端点 | 添加 A2UI API 路由 | sandbox 功能的后端支持 |

### 验证标准

- [ ] LLM 在聊天中渲染一个 A2UI 组件（如 DataChart 替代方案）
- [ ] 自定义组件（DiffViewer）可作为 A2UI 组件注册
- [ ] sandbox functions 安全隔离，不会执行危险操作
- [ ] 打 tag `v3-a2ui`

---

## 第四阶段：A2A 跨语言多 agent

### 参考源

**目录：** `D:\AgentBuild\copilotkit-repo\examples\integrations\a2a-middleware`

### 吸收哪些代码

| 官方文件 | 我们要做的 | 目标 |
|---------|-----------|------|
| `route.ts` 的 `A2AMiddlewareAgent` 注册 | 在我们的 Runtime 中添加 A2AMiddlewareAgent | 可以编排 Python 子 agent + JS 工具 + 外部服务 |
| `agents/orchestrator.py` | 参考协调器设计 | 理解 A2A 协议的 agent 间通信 |
| a2a 子 agent 的 Python 实现 | 将部分子 agent 拆分为独立 A2A 服务 | 模块化、可独立部署 |

### 验证标准

- [ ] coordinator agent 可以通过 A2A 调用一个外部子 agent
- [ ] 子 agent 的返回结果被协调器正确消费
- [ ] 打 tag `v4-a2a`

---

## 第五阶段：MCP 工具扩展

### 参考源

**目录：** `D:\AgentBuild\copilotkit-repo\examples\showcases\mcp-apps`
**目录：** `D:\AgentBuild\copilotkit-repo\examples\integrations\mcp-apps`

### 吸收哪些代码

| 官方文件 | 我们要做的 | 目标 |
|---------|-----------|------|
| `mcp-apps` 的 `MCPAppsMiddleware` 配置 | 在 CopilotRuntime 中添加 MCP apps | agent 可以使用外部工具服务器 |
| MCP server 注册模式 | 配置 MCP 服务器列表 | 文件系统、数据库、API 工具 |

### 验证标准

- [ ] agent 可以调用一个 MCP 工具（如文件搜索）
- [ ] MCP 工具结果正确返回
- [ ] 打 tag `v5-mcp`

---

## 第六阶段：线程持久化 + 生产就绪

### 参考源

**目录：** `D:\AgentBuild\copilotkit-repo\examples\integrations\langgraph-fastapi`
- Intelligence 模式配置（`route.ts` 中 `CopilotKitIntelligence` 块）

### 要做的

| 改动 | 目标 |
|------|------|
| 切换回 `SqliteAgentRunner` | 线程持久化，刷新不丢对话 |
| 解决 `finalizeRunEvents` 冲突 | 之前用 `InMemoryAgentRunner` 绕过了，需要正面修复 |
| 添加认证层 | API Key 保护后端 |
| Rate limiting | 防止滥用 |
| 环境变量配置 | 所有依赖外部服务都在 `.env` 中 |

### 验证标准

- [ ] 刷新页面后对话历史还在
- [ ] 无 INCOMPLETE_STREAM 错误
- [ ] 配置了环境变量校验
- [ ] 打 tag `v6-production`

---

## 第七阶段：E2E + 桌面打包

### 参考源

- `D:\AgentBuild\copilotkit-repo\showcase\integrations\langgraph-fastapi\Dockerfile`
- `D:\AgentBuild\copilotkit-repo\showcase\integrations\langgraph-fastapi\playwright.config.ts`

### 要做的事

| 任务 | 目标 |
|------|------|
| Playwright E2E 测试 | 启动前后端 → 发送消息 → 验证响应 |
| Docker 镜像 | 一键部署 |
| Electron/Tauri 壳 | 桌面应用打包 |

### 验证标准

- [ ] E2E 测试覆盖核心流程
- [ ] Docker 镜像可构建、可运行
- [ ] 打 tag `v7-desktop`

---

## 贯穿所有阶段的工程准则

### 1. 版本管理

```
v1-foundation       ← tags/v1 (当前)
v2-subagent         ← tags/v2 (第二阶段结束)
v3-a2ui             ← tags/v3
v4-a2a              ← tags/v4
v5-mcp              ← tags/v5
v6-production       ← tags/v6
v7-desktop          ← tags/v7

出问题: git reset --hard tags/vX
```

每个阶段的 commit 规范：

```
feat(subagent): 实现 supervisor+@tool 委托模式
- 参考官方 showcase/integrations/langgraph-fastapi
- 将 coordinator 改为 LLM 驱动的委托
- 新增 Delegation 类型 + operator.add 归约器
- 前端 useAgent 订阅实时 delegations
```

### 2. 三防线测试策略

| 防线 | 工具 | 覆盖率目标 | 运行时间 |
|------|------|-----------|---------|
| 单元测试 | pytest + vitest | 后端 80%+、前端 60%+ | < 2min |
| 集成测试 | pytest + 前端 mock | 关键路径 100% | < 5min |
| E2E 测试 | Playwright | 核心用户流程 | < 10min |

CI 流程：`pytest → vitest → build → playwright`

### 3. 团队交接保障

| 文档 | 内容 | 更新频率 |
|------|------|---------|
| `ONBOARDING.md` | 30 分钟上手：环境搭建、启动、测试、提交 | 每阶段更新 |
| `docs/superpowers/ADR/` | 每个架构决策的 why 和 trade-off | 每次决策记录 |
| `docs/superpowers/SPEC.md` | 当前架构全景 | 每阶段更新 |
| `docs/superpowers/STATUS.md` | 当前进度 + 技术债 | 持续更新 |
| `docs/api/` | API 文档（OpenAPI 导出 + 前端组件 Storybook）| 发布前 |

新人接手流程：
1. 读 `ONBOARDING.md`（30min）
2. 跑通测试（15min）
3. 读 `SPEC.md` + `ADR/*.md`（1h）
4. 完成一个小 issue（2h）

### 4. 版本兼容性基线

对官方的依赖版本需要锁定，避免升级破坏：

| 包 | 当前版本 | 锁定方式 |
|---|---------|---------|
| Python `copilotkit` | 0.1.94 | `pyproject.toml` |
| Python `ag-ui-langgraph` | 0.0.42 | `pyproject.toml` |
| JS `@copilotkit/runtime` | 4.0.1 | `package.json` |
| JS `@ag-ui/client` | 0.0.57 | `package.json` |
| JS `@copilotkit/react-core` | 1.61.1 | `package.json` |

版本升级策略：**先读 changelog，在 feature branch 上升级，跑全量测试，合并后才算升级完成。**

---

## 时间线预估

| 阶段 | 保守 | 激进 | 并行性 |
|------|------|------|--------|
| P1 底座 | 3d | 2d | 单线 |
| P2 Subagent | 5d | 3d | 单线 |
| P3 A2UI | 5d | 3d | 可和 P2 并行（不同人） |
| P4 A2A | 5d | 3d | 依赖 P2 |
| P5 MCP | 3d | 2d | 可和 P2-P4 并行 |
| P6 生产就绪 | 5d | 3d | 依赖 P2-P5 |
| P7 E2E+桌面 | 7d | 4d | 可和 P6 并行 |
| **总计** | **33d** | **20d** | |

---

## 决策检查清单（每个阶段开始前回答）

- [ ] 这个阶段的参考示例是哪个？明确到文件路径和行号
- [ ] 要吸收的具体代码是哪些行？不要"参考一下"，要"复制 xxx 文件的 yyy 模式"
- [ ] 完成后如何验证？标准是什么？谁来做验证？
- [ ] 如果这个阶段失败了（超过预估时间 2x），放弃什么？保留什么？
- [ ] 这个阶段引入的技术债是什么？记录到 `STATUS.md`

---

## 附录：官方示例速查表

| 要解决的问题 | 最佳参考 | 文件 |
|------------|---------|------|
| Subagent 委托模式 | `showcase/integrations/langgraph-fastapi` | `src/agents/src/subagents.py` |
| 前端实时状态订阅 | 同上 | `demos/subagents/page.tsx` |
| A2UI 动态组件 | 同上 | `src/agents/src/a2ui_dynamic.py` |
| A2A 跨语言协调 | `examples/integrations/a2a-middleware` | `route.ts` + `agents/orchestrator.py` |
| MCP 工具扩展 | `examples/showcases/mcp-apps` | `route.ts` |
| v2 Runtime (createCopilotEndpoint) | `examples/integrations/langgraph-fastapi` | `route.ts` |
| v1 Runtime (copilotRuntimeNextJSAppRouterEndpoint) | `showcase/integrations/langgraph-fastapi` | `route.ts` |
| Docker + Playwright | `showcase/integrations/langgraph-fastapi` | `Dockerfile`, `playwright.config.ts` |

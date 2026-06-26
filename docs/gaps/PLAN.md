# Deep Agent 666 — 差距补齐方案

> 生成于 2026-06-26
> 基于：`D:\AgentBuild\copilotkit-repo` 官方示例全面审计

---

## 差距速览

| P级 | 差距 | 说明 | 参考官方文件 |
|-----|------|------|-------------|
| P0 | A2UI 动态渲染 | agent 只吐文字，不会渲染交互组件 | `a2ui_dynamic.py`, `a2ui_schemas/` |
| P0 | 精确 tool 渲染 | 通配符 `*` 渲染，不是每个工具独立卡片 | `subagents/page.tsx:48-94` |
| P0 | CopilotKitMiddleware 状态同步 | delegations 未在前端实时显示 | `subagents.py:231` |
| P1 | StateStreamingMiddleware | 复杂状态（文件、todos）无统一同步 | 多个 showcase demo |
| P1 | Dual-panel 布局 | DelegationLog 已复制但未集成进页面 | `demo-layout.tsx` |
| P1 | Suggestion 常驻 | 发消息后 suggestion 消失 | `suggestions.ts` |
| P2 | Supervisor 活动横幅 | 运行时无脉冲动画提示 | `supervisor-activity-banner.tsx` |
| P2 | 主题色对齐 | 子 agent 颜色体系未应用到全局 | `delegation-log.tsx`, `subagent-activity-card.tsx` |

---

## 阶段划分

| 阶段 | 名称 | 关闭的差距 | 参考官方 | 预估 |
|------|------|-----------|---------|------|
| P1 | 前端布局 + 状态同步 | Dual-panel, CopilotKitMiddleware, Suggestion, 精确 tool 渲染 | `demo-layout.tsx`, `subagents/page.tsx` | 3-5d |
| P2 | A2UI 动态渲染 | A2UI catalog + render + sandbox | `a2ui_fixed.py`, `a2ui_dynamic.py`, `a2ui_schemas/` | 5-7d |
| P3 | StateStreamingMiddleware | 文件/todos/steps 统一状态流 | 多个 showcase demo | 3-5d |
| P4 | 生产打磨 | 主题、横幅、interrupt 恢复、Suggestion 常驻 | 各处小改进 | 2-3d |

---

## 第一阶段：前端布局 + 状态同步 (P1)

### 参考源

**主参考：** `D:\AgentBuild\copilotkit-repo\showcase\integrations\langgraph-fastapi\src\app\demos\subagents\`

| 文件 | 吸收内容 |
|------|---------|
| `page.tsx` (line 1-41) | `useAgent({updates: [OnStateChanged, OnRunStatusChanged]})` 精确订阅模式 |
| `page.tsx` (line 48-94) | 三个独立的 `useRenderTool({name:"research_agent", ...})` 调用 |
| `demo-layout.tsx` (全部) | `flex-col md:flex-row` 双面板布局 + DelegationLog + CopilotChat |
| `delegation-log.tsx` | 已复制，需集成到页面 |
| `subagent-activity-card.tsx` | 已复制，需通过独立 `useRenderTool` 接入 |
| `supervisor-activity-banner.tsx` | 运行时脉冲动画横幅 |
| `suggestions.ts` (全部) | `useConfigureSuggestions` 的 `available: "always"` 模式 |

**次参考：** `D:\AgentBuild\copilotkit-repo\examples\integrations\langgraph-fastapi\src\app\api\copilotkit\[[...slug]]\route.ts`

| 文件 | 吸收内容 |
|------|---------|
| `route.ts` (line 20-51) | `CopilotRuntime` 配置模式（`a2ui: {}`, `openGenerativeUI: true`, `runner: InMemoryAgentRunner()`） |
| `route.ts` (line 53-61) | `createCopilotEndpoint` + `handle(app)`—现代 Hono 端点模式 |

### 实施任务

```
P1-1: 修改 page.tsx 布局
  → 从当前 ResizablePanelGroup 改为 dual-panel 布局
  → 左侧 DelegationLog（接收 delegations 数据）
  → 右侧 CopilotChat
  → 顶部 SupervisorActivityBanner（运行时条件渲染）
  
P1-2: 修改 useRenderTool 使用精确匹配
  → 删掉 name: "*" 通配符
  → 改为三个独立调用：
    useRenderTool({ name: "planner_tool", render: <SubAgentActivityCard subAgent="planner"> })
    useRenderTool({ name: "executor_tool", render: <SubAgentActivityCard subAgent="executor"> })
    useRenderTool({ name: "reviewer_tool", render: <SubAgentActivityCard subAgent="reviewer"> })
  → 保留一个兜底渲染器给所有其他工具
  
P1-3: 修改 useAgent 订阅
  → 添加 updates: [OnStateChanged, OnRunStatusChanged]
  → 提取 agent.state.delegations 传给 DelegationLog
  
P1-4: 修改 Suggestion 模式
  → 从 available: "before-first-message" 改为 "always"
  
P1-5: 对接 coordinator 后端 delegations
  → 确认 build_v2_coordinator 的 CopilotKitMiddleware 正确 emit delegations
  → 前端 useAgent().state.delegations 能收到实时更新
```

### 验证标准

- [ ] 左侧面板显示 DelegationLog，右侧面板显示 CopilotChat
- [ ] 发送任务后 delegations 实时出现在左侧面板
- [ ] 每个子 agent（planner/executor/reviewer）在聊天流中渲染独立彩色卡片
- [ ] Supervisor 运行时顶部横幅脉冲动画
- [ ] 建议 chips 始终可见（发消息后不消失）
- [ ] 后端 35+ tests pass，前端 15+ tests pass，Build clean
- [ ] 打 tag `gap-v1-layout`

---

## 第二阶段：A2UI 动态渲染 (P2)

### 参考源

**主参考：** `D:\AgentBuild\copilotkit-repo\showcase\integrations\langgraph-fastapi\src\agents\src\`

| 文件 | 吸收内容 |
|------|---------|
| `a2ui_fixed.py` (line 1-80) | `a2ui.load_schema()`, `a2ui.render(operations=[...])`, `a2ui.create_surface()` |
| `a2ui_fixed.py` (line 52-80) | `@tool` 返回 `a2ui.render(...)` 的完整模式 |
| `a2ui_dynamic.py` (全部) | 动态 A2UI 组件注册、`A2UIMiddleware` 配置 |
| `a2ui_schemas/flight_schema.json` | JSON schema 定义方式 |

**次参考：** `D:\AgentBuild\copilotkit-repo\showcase\integrations\langgraph-fastapi\src\app\demos\a2ui-fixed-schema\`

| 文件 | 吸收内容 |
|------|---------|
| `page.tsx` (line 20-32) | `CopilotKit` 的 `a2ui={{ catalog }}` 配置 |
| `a2ui/catalog.ts` | 组件目录注册（fixed + basic 组件） |
| `a2ui/renderers.tsx` | React 组件实现 |
| `a2ui/definitions.ts` | Zod schema 定义 |

**主参考：** `D:\AgentBuild\copilotkit-repo\examples\integrations\langgraph-fastapi\src\app\api\copilotkit\[[...slug]]\route.ts`

| 文件 | 吸收内容 |
|------|---------|
| `route.ts` (line 38-51) | `a2ui: {}` 配置，`openGenerativeUI: true` (已在 P1 完成) |

### 实施任务

```
P2-1: 创建 A2UI 组件目录
  → web/src/a2ui/ 目录
  → catalog.ts：注册 DiffViewer + FileBrowser 为 A2UI 组件
  → renderers.tsx：React 组件实现
  → definitions.ts：Zod schema

P2-2: 启用 A2UI 渲染器
  → providers.tsx: CopilotKit 添加 a2ui={{ catalog }}
  → CopilotChat 配置 a2ui 渲染支持

P2-3: Python 后端 A2UI 工具
  → 添加一个简单的 A2UI 工具（如 display_diff）
  → 使用 a2ui.render(operations=[...]) 模式
  → 在 coordinator 中注册

P2-4: Sandbox 安全
  → 实现 sandbox functions（参考 a2ui/sandbox 端点）
  → 确保 A2UI 组件在安全沙箱中执行
```

### 验证标准

- [ ] Agent 可以渲染一个 A2UI 组件（如 DiffViewer 卡片）
- [ ] A2UI 组件在聊天流中内联显示
- [ ] Sandbox functions 安全隔离
- [ ] 后端 35+ tests pass，前端 tests pass
- [ ] 打 tag `gap-v2-a2ui`

---

## 第三阶段：StateStreamingMiddleware (P3)

### 参考源

**主参考：** `D:\AgentBuild\copilotkit-repo\showcase\integrations\langgraph-fastapi\src\agents\src\`

| 文件 | 吸收内容 |
|------|---------|
| 多个状态相关的 demo | `CopilotKitMiddleware` 自动同步自定义状态字段 |
| `shared_state_read_write.py` | 读写共享状态的模式 |
| `readonly_state_agent_context.py` | 只读状态上下文模式 |

### 实施任务

```
P3-1: 统一状态中间件
  → 替换 GenUIMiddleware 为基于 CopilotKitMiddleware 的统一方案
  → 所有状态字段（files, todos, steps, diff）通过 copilotkit_emit_state 同步

P3-2: 前端状态订阅
  → useAgent({ updates: [OnStateChanged] }) 接收所有状态变更
  → DiffViewer / FileBrowser 从 agent.state 读取数据
  → 移除手动 queueMicrotask 的 state tracking

P3-3: 测试
  → 新增状态同步测试
  → 验证前端收到后端的每个状态变更
```

### 验证标准

- [ ] 文件变更自动显示在 DiffViewer（不再手动推送）
- [ ] todo 列表自动更新
- [ ] 移除所有手动 state tracking 代码
- [ ] 打 tag `gap-v3-streaming`

---

## 第四阶段：生产打磨 (P4)

### 实施任务

```
P4-1: supervisor 活动横幅
  → 集成 SupervisorActivityBanner 组件
  → 运行时显示当前活跃 sub-agent + 脉冲动画

P4-2: 主题色对齐
  → 将子 agent 颜色体系（📋 #BEC2FF, ⚡ #85ECCE, 🧐 #FFAC4D）应用到全局
  → shadcn 主题变量覆盖

P4-3: interrupt 恢复
  → 重新启用 interrupt_on
  → 确保中断时返回非空结果（修复 {} 问题）

P4-4: Suggestion 常驻 + 多样化
  → 添加更多预配置建议
  → 支持根据上下文动态建议
```

### 验证标准

- [ ] Supervisor 横幅在运行时正确显示
- [ ] 主题色统一
- [ ] interrupt 恢复后无报错
- [ ] 打 tag `gap-v4-polish`

---

## 贯穿原则

### 版本管理

```
gap-v1-layout   ← 第一阶段完成 tag
gap-v2-a2ui     ← 第二阶段完成 tag
gap-v3-streaming ← 第三阶段完成 tag
gap-v4-polish   ← 第四阶段完成 tag

回滚: git reset --hard gap-vX
```

### 三防线测试

| 防线 | 覆盖率 | 阶段 |
|------|--------|------|
| pytest (后端) | 35+ → 40+ | 每个阶段新增测试 |
| vitest (前端) | 15 → 20+ | P1 增组件测试 |
| Playwright E2E | 3 → 8+ | 每个核心流程一条 E2E |

### 团队交接保障

```
docs/gaps/
├── ADR/              ← 本阶段新增架构决策
│   ├── 004-a2ui-catalog-pattern.md
│   ├── 005-state-streaming-middleware.md
│   └── 006-dual-panel-layout.md
├── GAP-STATUS.md     ← 差距补齐进度
├── GAP-ONBOARDING.md ← 新增功能介绍（两个文件：旧能力 + 新能力）
└── GAP-E2E.md       ← E2E 测试覆盖说明
```

### 避免偏离主线的检查清单

每个阶段开始前：

- [ ] 参考示例文件是哪个？具体到行号
- [ ] 要吸收/复制的代码是哪些？
- [ ] 完成后验证标准是什么？
- [ ] 失败时保留什么、放弃什么？
- [ ] 引入的新技术债记录了吗？

### 时间线

| 阶段 | 预估 | 并行性 |
|------|------|--------|
| P1 布局+状态 | 3-5d | 单线 |
| P2 A2UI | 5-7d | 可和 P1 并行（不同人） |
| P3 Streaming | 3-5d | 依赖 P1 |
| P4 打磨 | 2-3d | 依赖 P1-P3 |
| **总计** | **13-20d** | |

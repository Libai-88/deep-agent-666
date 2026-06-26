# Code Review — 修复方案

> 生成于 2026-06-26
> 基于全面代码审计结果，按严重程度降序排列

---

## 阶段划分

| 阶段 | 修复项 | 预估 |
|------|--------|------|
| P1 | #1 Coordinator 端点缺失 + #3 缺 running 状态 | 2-3d |
| P2 | #2 GenUI 状态字段错误 + #4 同步 invoke 阻塞 | 1-2d |
| P3 | #5 模型构建逻辑重复 + #6 预设双端维护 | 1d |
| P4 | #7 死代码清理 + #9 API 密钥 type=password | 0.5d |
| P5 | #10 search_workspace 内存 + #11 路径暴露 | 1d |
| P6 | #8 测试覆盖补全 | 2-3d |

---

## P1: Coordinator 端点 + running 状态

### #1 Coordinator AG-UI 端点不存在

**根因：** `main.py` 用 `add_langgraph_fastapi_endpoint` 只注册了 V1 代理。Coordinator 被加到了 `CopilotKitRemoteEndpoint` 的 `/copilotkit` 路径下，但这个 SDK 路径和前端用的 `LangGraphHttpAgent` 协议不兼容。

**修复：**
```
main.py: 把 coordinator 也注册独立的 add_langgraph_fastapi_endpoint
         路径格式: /coordinator-{preset_id}
```

### #3 子 agent 永不发 running 状态

**根因：** `_delegation_command` 只在 completed/failed 时发状态，没有 running 阶段。

**修复：**
```
agent_factory.py:
  1. 在 _invoke_sub_agent 之前先发一个 running 的 delegation entry
  2. 用 try/finally 确保无论成功失败都更新最终状态
```

---

## P2: GenUI 状态 + 同步阻塞

### #2 GenUI 中间件读错状态字段

**根因：** `genui_middleware` 读 `phase`/`plan_steps`/`file_changes`/`review_result`，但 `CoordinatorState` 只有 `delegations`。

**修复：**
```
genui.py: 改为消费 delegations 字段
         或者根据代理类型（V1 vs V2）条件判断
```

### #4 同步 invoke 阻塞事件循环

**根因：** `agent.invoke()` 是同步调用，在 FastAPI 异步上下文中阻塞事件循环。

**修复：**
```
agent_factory.py: asyncio.to_thread(agent.ainvoke, ...) 或直接用 ainvoke
```

---

## P3: 重复逻辑

### #5 模型构建逻辑重复

**根因：** `_build_model` 和 `build_v2_coordinator` 各自写了一遍 provider 参数构建逻辑。

**修复：**
```
agent_factory.py: 提取共享的 _build_model_kwargs(preset, settings) 函数
```

### #6 预设双端维护

**根因：** `presets.py` (Python) 和 `agent-presets.ts` (TypeScript) 各维护一份预设列表。

**修复：**
```
agent-presets.ts: 改为从后端 /presets 端点动态获取
                  或添加同步脚本
```

---

## P4: 死代码 + 安全

### #7 死代码清理
- 删除 `env-check.ts`（无人调用）
- 删除 `copilot-runtime.ts`（无人调用）
- 删除 `V2AgentState`（已废弃）

### #9 API 密钥 type=password
- `page.tsx:700-706` 输入框加 `type="password"`

---

## 开始执行：P1

先修最紧迫的 #1 和 #3。让我先看 main.py 的当前代码。

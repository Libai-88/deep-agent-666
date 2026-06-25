# SDK 版本对齐与协议升级计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 对齐前端 JS SDK (v1.61.x) 与后端 Python SDK (v0.1.x) 的 AG-UI 协议版本，解决 "Run ended without emitting a terminal event / INCOMPLETE_STREAM" 报错，确保 chat 全链路可通。

**根因诊断（已确认）：**
后端原始 AG-UI SSE 流包含正确的 `RUN_FINISHED` 事件，但 `@ag-ui/client@0.0.57` 在处理 `LangGraphHttpAgent` 转发后的流时，认为流不完整（`INCOMPLETE_STREAM`）。原因是 Python SDK (`copilotkit==0.1.94`) 的 AG-UI 协议版本与 JS SDK (`@copilotkit/runtime@^1.61.1`) 的 `@ag-ui/client` 不完全对齐。

**Architecture:**
- 后端：从旧 `LangGraphAGUIAgent` + `add_langgraph_fastapi_endpoint` 迁移到新 `CopilotKitRemoteEndpoint` + `add_fastapi_endpoint`
- 前端：保持 v2 导入路径不变，升级 `@ag-ui/client` 到最新
- Deep Agents：升级到最新版本

**Tech Stack:** Python 3.11+, copilotkit 0.1.94 (latest), ag-ui-langgraph 0.0.42 (latest), deepagents latest, Next.js 16.2.9+, `@copilotkit/react-core@^1.61.1`, `@ag-ui/client` latest.

**官方参考源（MCP 文档确认）：**
- [Migrate to AG-UI](https://docs.copilotkit.ai/integrations/langgraph/troubleshooting/migrate-to-agui) — `CopilotKitRemoteEndpoint` + `add_fastapi_endpoint`
- [Migrate to V2](https://docs.copilotkit.ai/migrate/v2) — 前端 v2 导入 (已就绪)
- [Deep Agents Quickstart](https://docs.copilotkit.ai/integrations/deepagents/quickstart) — `CopilotKitState` + 中间件
- `copilotkit==0.1.94` (PyPI, 2026-06-04) — latest
- `ag-ui-langgraph==0.0.42` (PyPI, 2026-06-19) — latest
- `@ag-ui/client` — 需升级到与 runtime 匹配的最新版本

---

## 差距分析：当前 vs 目标

| 层面 | 当前 | 目标 |
|------|------|------|
| **后端集成模式** | `LangGraphAGUIAgent` + `add_langgraph_fastapi_endpoint` 单独注册 | `CopilotKitRemoteEndpoint` + `add_fastapi_endpoint` 统一注册 |
| **后端 agent 包装** | 每个 agent 在 `agent_factory.py` 中手动包装 | 统一在 `main.py` 的 `_build_all_agents()` 中包装 |
| **前端 Runtime** | `createCopilotRuntimeHandler` (v2) | 保持 v2 不变 |
| **@ag-ui/client** | `0.0.57` | `0.0.57` (latest) |
| **Deep Agents** | `deepagents==0.6.11` | `deepagents>=0.6.11` (latest) |
| **V2 coordinator** | 用单独 `_register_coordinators()` 注册 | 合并到 `CopilotKitRemoteEndpoint` 统一管理 |
| **测试** | 34 测试用旧路径断言 | 更新为新 SDK agent 名称断言 |
| **开发文档** | 引用旧 API | 引用新 API |

---

### Task U1: 升级前端 @ag-ui/client

**分析：** `@ag-ui/client` 是 AG-UI 协议客户端，版本 `0.0.57` 可能与新版 runtime 不完全对齐。

**Files:**
- Modify: `web/package.json`

**Step 1: 升级 @ag-ui/client**

```bash
cd D:\AgentBuild\.worktrees\deepagents-foundation\web
npm install @ag-ui/client@latest
```

**Step 2: 验证兼容性**

```bash
npm ls @ag-ui/client
```
Expected: 最新版本

**Step 3: Build 验证**

```bash
npx next build 2>&1 | tail -5
```
Expected: Build passes

**Step 4: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore: upgrade @ag-ui/client to latest for AG-UI protocol alignment"
```

---

### Task U2: 后端集成模式迁移

**官方依据：** [Migrate to AG-UI](https://docs.copilotkit.ai/integrations/langgraph/troubleshooting/migrate-to-agui) — 新模式：

```python
from copilotkit.integrations.fastapi import add_fastapi_endpoint
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAgent

sdk = CopilotKitRemoteEndpoint(
    agents=[
        LangGraphAgent(
            name="sample_agent",
            description="my agent",
            graph=graph,
        ),
    ],
)
add_fastapi_endpoint(app, sdk, "/copilotkit")
```

**关键变化：**
| 旧 | 新 |
|---|----|
| `from ag_ui_langgraph import add_langgraph_fastapi_endpoint` | `from copilotkit.integrations.fastapi import add_fastapi_endpoint` |
| 每个 agent 单独注册端点 (`/openai-balanced`, `/coordinator-...`) | 统一通过 `CopilotKitRemoteEndpoint` 管理，路由 `/copilotkit/{path:path}` |
| `_register_coordinators()` 单独注册 V2 | `_build_all_agents()` 统一构建 V1+V2 |

**Files:**
- Rewrite: `agent/app/main.py` — 替换为 `CopilotKitRemoteEndpoint` + `add_fastapi_endpoint`
- Modify: `agent/app/agent_factory.py` — `build_langgraph_agents` 返回原始 compiled graph

**Step 1: 验证 `add_fastapi_endpoint` 和 `CopilotKitRemoteEndpoint` 可用性**

```bash
cd D:\AgentBuild\.worktrees\deepagents-foundation
uv run --project agent python -c "
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAgent
from copilotkit.integrations.fastapi import add_fastapi_endpoint
print('New API available')
"
```
Expected: "New API available"

**Step 2: 修改 agent_factory.py**

将 `build_langgraph_agents` 和 `build_v2_coordinator` 的返回值从 `LangGraphAGUIAgent` 包装改为返回原始 compiled graph。

```python
# 改前: build_langgraph_agents 返回 dict[str, LangGraphAGUIAgent]
# 改后: build_langgraph_agents 返回 dict[str, compiled_graph]

# 改前:
agents[preset_id] = LangGraphAGUIAgent(
    name=preset_id,
    description=f"Agent ({preset.label})",
    graph=graph,
)

# 改后:
agents[preset_id] = graph  # raw compiled graph
```

同样修改 coordinator：
```python
# 改前:
coordinator_agent = LangGraphAGUIAgent(
    name=f"coordinator-{preset_id}",
    description=f"Coordinator ({preset.label})",
    graph=coordinator_graph,
)

# 改后:
agents[f"coordinator-{preset_id}"] = coordinator_graph
```

**Step 3: 重写 main.py 的端点注册**

```python
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAgent
from copilotkit.integrations.fastapi import add_fastapi_endpoint

# 构建所有 agents（V1 + V2 coordinator）
all_agents: list[LangGraphAgent] = []

for preset_id, graph in agents.items():
    preset = presets_by_id.get(preset_id.replace("coordinator-", ""))
    desc = f"Agent ({preset.label})" if preset else preset_id
    all_agents.append(LangGraphAgent(
        name=preset_id,
        description=desc,
        graph=graph,
    ))

for preset_id, coord_graph in coordinator_agents.items():
    all_agents.append(LangGraphAgent(
        name=f"coordinator-{preset_id}",
        description=f"Coordinator ({preset_id})",
        graph=coord_graph,
    ))

sdk = CopilotKitRemoteEndpoint(agents=all_agents)
add_fastapi_endpoint(app, sdk, "/copilotkit")
```

注意：`_register_coordinators()` 和 `_reload_agents()` 也需要相应更新。

**Step 4: 更新测试**

`agent/tests/test_v2_endpoints.py` 中的端点路径测试需要匹配新格式。新模式下所有 agent 通过 `/copilotkit` 路由，不再有 `/openai-balanced` 等单独端点。

**Step 5: 运行测试**

```bash
cd D:\AgentBuild\.worktrees\deepagents-foundation
uv run --project agent pytest agent/tests/ -v
```
Expected: All tests pass (可能需要更新 mock)

**Step 6: Commit**

```bash
git add agent/app/main.py agent/app/agent_factory.py agent/tests/
git commit -m "refactor: migrate backend to CopilotKitRemoteEndpoint integration pattern"
```

---

### Task U3: 更新 V2 Coordinator 集成

**分析：** Task U2 改了 agent 包装方式，coordinator 也需要统一到新模式。

**Files:**
- Modify: `agent/app/main.py` — coordinator 注册合并到 CopilotKitRemoteEndpoint

coordinator 不再需要单独用 `_register_coordinators()` 注册端点，而是通过 `CopilotKitRemoteEndpoint` 统一管理。

**Step 1: 修改 main.py**

移除旧的 `_register_coordinators()` 函数和模块级注册循环。将所有 agent（V1 + V2 coordinator）统一通过 `CopilotKitRemoteEndpoint` 注册。

**Step 2: Commit**

```bash
git add agent/app/main.py
git commit -m "refactor(v2): unify coordinator registration with CopilotKitRemoteEndpoint"
```

---

### Task U4: 更新开发文档

**分析：** 所有开发文档引用了旧的 API 名称，需要更新为新模式。

**Files:**
- Modify: `docs/superpowers/specs/2026-06-24-deepagents-copilotkit-agent-design.md`
- Modify: `docs/superpowers/specs/2026-06-25-deepagents-v2-subagent-genui-design.md`
- Modify: `docs/superpowers/plans/2026-06-24-deepagents-copilotkit-v1-foundation.md`
- Modify: `docs/superpowers/plans/2026-06-25-deepagents-frontend-merge-plan.md`
- Modify: `docs/superpowers/plans/2026-06-25-deepagents-polish-plan.md`
- Modify: `docs/superpowers/plans/2026-06-25-deepagents-v2-implementation.md`
- Modify: `docs/superpowers/plans/2026-06-25-deepagents-v2-gap-close-plan.md`

**需要更新的内容：**
- `LangGraphAGUIAgent` → `LangGraphAgent` (from copilotkit)
- `add_langgraph_fastapi_endpoint` → `add_fastapi_endpoint` (from copilotkit.integrations.fastapi)
- `CopilotKitRemoteEndpoint` 新模式说明
- 确保所有文档中的代码示例与实际代码一致

**Step 1: 全局替换 + 人工审核**

```bash
cd D:\AgentBuild
grep -rn "LangGraphAGUIAgent\|add_langgraph_fastapi_endpoint" docs/ 2>/dev/null
```

对于每个匹配的文件：
1. 更新 API 名称
2. 更新代码示例
3. 更新架构描述
4. 在文件顶部添加 "Last updated: 2026-06-25" 标记

**Step 2: Commit**

```bash
git add docs/
git commit -m "docs: align API references with CopilotKitRemoteEndpoint integration pattern"
```

---

### Task U5: E2E 验证

**分析：** 所有代码变更后，需要启动前后端进行完整的 chat 流程验证。

**Step 1: 启动后端**

```bash
cd /d/AgentBuild/.worktrees/deepagents-foundation
uv run --project agent uvicorn app.main:app --host 127.0.0.1 --port 8123 --reload
```

**Step 2: 启动前端**

```bash
cd /d/AgentBuild/.worktrees/deepagents-foundation/web
npm run dev
```

**Step 3: 验证清单**

- [ ] `curl http://127.0.0.1:8123/copilotkit` → 返回 agent 列表
- [ ] 浏览器打开 http://localhost:3000 — 无 404/500 错误
- [ ] 在聊天窗口发送消息 — 无 "INCOMPLETE_STREAM" 报错
- [ ] agent 返回回答
- [ ] 工作区文件浏览器可用
- [ ] Settings 可配置 API Key

---

## 执行顺序

```
Task U1: 升级 @ag-ui/client         → ~10 min
Task U2: 后端集成模式迁移             → ~60 min (核心改造)
Task U3: V2 Coordinator 统一          → ~15 min
Task U4: 更新开发文档                 → ~30 min
Task U5: E2E 验证                     → ~15 min
─────────────────────────────────────────
总计                                  → ~2 小时
```

## 验证标准

- [ ] 所有 34+ 后端测试通过
- [ ] 所有 15 前端测试通过
- [ ] `npm run build` 无错误
- [ ] 后端 `/copilotkit` 端点返回 agent 列表
- [ ] 前端发送消息后 agent 正常响应，无 INCOMPLETE_STREAM 报错
- [ ] 所有 7 个开发文档更新到新 API 名称

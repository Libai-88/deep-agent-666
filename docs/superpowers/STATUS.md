# Deep Agent 666 — 当前状态

> 最后更新：2026-06-27 (V1 完成，V2 release hardening 完成，V3 首用引导完成，V4 本地持久化线程运行时完成，V5 live provider activation 完成，V6 first response roundtrip 完成，V7 provider alignment/runtime recovery 完成，V8 runtime failure normalization 完成，V9 retry replay recovery 完成，V10 thread history gap recovery 完成，V11 thread history drift recovery 完成)

## 当前结论

- V1 不再是“未完成”状态，已在 `6a33da3` 完成 coordinator workbench runtime。
- V2 发布加固已在 `69d6d96` 完成，分支 `feat/deepagents-foundation` 已推送到 `origin`。
- V3 首用引导已在 `380b84c` 完成并推送远端。
- 当前产品基线是：一个本地工作区、一个 Web、一个 FastAPI/Deep Agents 服务，支持工程和研究混合场景，并已补齐“同页配置后即可启动首条任务并收到首条响应”的首用闭环。

## 测试状态

| 套件 | 数量 | 状态 |
|------|------|------|
| 后端 (pytest) | 59 | ✅ 全通过 |
| 前端 (vitest) | 63 | ✅ 全通过 |
| Build (next build) | — | ✅ |
| E2E (playwright) | 12 | ✅ 全通过 |
| Docker Compose 配置校验 | — | ⚠️ 当前机器未安装 `docker`，未执行命令级验证 |

## 已完成

### V1: Unified Workspace Agent ✅
- 9 个单 agent 预设 (3 providers x 3 permission modes)
- 工程 / 研究 / 通用任务共享线程模型
- 持久化工作台：timeline、artifacts、final summary
- coordinator workbench runtime 跑通
- 前后端基础测试、构建、E2E 基线齐备

### V2: Release Hardening ✅
- 生产启动链路整理：`npm run start`
- README / `.env.example` / 启动方式补齐
- Web route/runtime 测试补强
- Playwright 改为生产启动路径验证
- Dockerfile + `docker-compose.yml` 基线
- CI 配置对齐当前仓库结构

### V3: First-Run Onboarding ✅
- 首次打开引导层：未配置 / 可恢复错误 / 无线程三态入口
- Starter templates：engineering / research / general 一键起步
- Workbench 内可恢复运行时告警
- 首用路径单测、组件测试、E2E 路径覆盖

### V4: Local Durable Thread Runtime ✅
- `[[...slug]]` 运行时路由已切到 `SqliteAgentRunner`
- 默认数据库路径：`./data/threads.db`
- 环境变量覆盖：`COPILOTKIT_THREADS_DB_PATH`
- 线程运行时具备本地文件级持久化能力

### V5: Live Provider Activation ✅
- Settings 保存 provider key 后，无需重启后端即可立即启动对应 agent / coordinator
- 后端已切到 live runtime registry，统一 `/presets`、`/health`、`/copilotkit` 和直连 AG-UI 路由的 agent surface
- 前端启动路径已增加 runtime 可用性闸门，避免“preset 已显示但 runtime 尚不可用”时直接白屏

### V6: First Response Roundtrip ✅
- Root `Providers` 在 Settings 保存成功后会同页重新 bootstrap `CopilotKit`
- 首用路径已覆盖：未配置 -> 保存 provider -> starter -> assistant 首条响应
- 浏览器回归使用确定性的 AG-UI text-response fixture，不依赖外部模型可用性

### V7: Provider Alignment And Runtime Recovery ✅
- OpenAI 预设不再指向 `openrouter/free`，改为真实 OpenAI 模型 `gpt-4.1-mini`
- 运行时错误从单一 `runtime_request_failed` 扩展为配额受限 / 模型不匹配 / 鉴权失败等可恢复状态
- 首个真实 provider run 的错误诊断不再与 provider 文案自相矛盾

### V8: Runtime Failure Normalization ✅
- 真实 provider 异常不再让 Python 直连 AG-UI 路由直接崩流，而是规范地以 `RUN_ERROR` 结束
- 路由会在异常时补齐未关闭的 text/tool/reasoning frame，再发终止事件，满足 AG-UI 生命周期要求
- 当前环境下真实 `403` 区域/访问拒绝错误已验证会落成 `RUN_ERROR(code=provider_access_denied)`

### V9: Retry Replay Recovery ✅
- `Retry last task` 不再依赖易失的运行时内存状态，而是把最后一条可重放用户任务持久化到 thread workbench state
- starter template 首次启动时会先种下重放 prompt，因此首条任务即使早期失败也能直接恢复
- 浏览器回归已证明：恢复线程在刷新后收到可恢复错误时，可以点击 `Retry last task` 重放存储的 prompt 并收到新响应

### V10: Thread History Gap Recovery ✅
- 恢复线程如果仍有本地 workbench 上下文、但 runtime connect 后消息历史为空，现在会被识别为 `thread_history_unavailable`
- 产品不再把这类场景静默渲染成“像是空线程”，而是明确提示这通常来自 backend restart 或线程数据库重置
- 浏览器回归已证明：用户可直接从该状态点击 `Retry last task` 或新建线程继续工作

### V11: Thread History Drift Recovery ✅
- 如果 runtime 只恢复出部分旧消息、但缺少本地持久化的最后一条任务，页面现在也会识别为 `thread_history_unavailable`
- 产品不再把“恢复出一些旧消息”误判为线程已经健康，而是继续提示这是一个可恢复的历史漂移场景
- 浏览器回归已证明：用户可从部分历史漂移状态直接重放最后一条任务

## 关键提交

| Commit | 说明 |
|--------|------|
| `2943aaa` | `feat(workbench): 增加混合场景任务工作台` |
| `6a33da3` | `feat(v1): complete coordinator workbench runtime` |
| `69d6d96` | `feat(v2): add release hardening baseline` |
| `380b84c` | `test(v3): cover onboarding launch path` |
| `6788bd5` | `feat(v4): add durable local thread runtime` |
| `c1217ee` | `feat(v5): activate providers live without restart` |
| `03171bc` | `feat(v6): prove first-run response roundtrip` |

## 下一步

- 下一阶段重点不再是恢复线程的产品层提示，而是把真实 backend restart/resume、完整线程消息恢复验证、以及更深层 runtime path 的一致性继续补齐。
- 完成标准是：真实模型失败与成功路径在所有主要入口都能稳定结束，并且新手能基于产品内提示完成恢复而不是靠猜。
- 文档中若仍出现旧的 `openrouter/free`、或把 OpenAI 默认路径与 OpenRouter 混写的表述，应以本页和最新提交为准。

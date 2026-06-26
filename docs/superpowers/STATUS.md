# Deep Agent 666 — 当前状态

> 最后更新：2026-06-27 (V1 完成，V2 release hardening 完成，V3 首用引导完成，V4 本地持久化线程运行时进行中)

## 当前结论

- V1 不再是“未完成”状态，已在 `6a33da3` 完成 coordinator workbench runtime。
- V2 发布加固已在 `69d6d96` 完成，分支 `feat/deepagents-foundation` 已推送到 `origin`。
- V3 首用引导已在 `380b84c` 完成并推送远端。
- 当前产品基线是：一个本地工作区、一个 Web、一个 FastAPI/Deep Agents 服务，支持工程和研究混合场景，并正在补齐本地持久化线程运行时。

## 测试状态

| 套件 | 数量 | 状态 |
|------|------|------|
| 后端 (pytest) | 52 | ✅ 全通过 |
| 前端 (vitest) | 30 | ✅ 全通过 |
| Build (next build) | — | ✅ |
| E2E (playwright) | 6 | ✅ 全通过 |
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

### V4: Local Durable Thread Runtime 🚧
- 目标：把当前 `[[...slug]]` 运行时路由从 `InMemoryAgentRunner` 切到 `SqliteAgentRunner`
- 默认数据库路径：`./data/threads.db`
- 环境变量覆盖：`COPILOTKIT_THREADS_DB_PATH`
- 当前阶段重点不再是 UI，而是线程/运行时连续性

## 关键提交

| Commit | 说明 |
|--------|------|
| `2943aaa` | `feat(workbench): 增加混合场景任务工作台` |
| `6a33da3` | `feat(v1): complete coordinator workbench runtime` |
| `69d6d96` | `feat(v2): add release hardening baseline` |
| `380b84c` | `test(v3): cover onboarding launch path` |

## 下一步

- 下一阶段已经不是“补完 V1”，而是继续推进 V4 本地持久化线程运行时。
- 完成标准是：真实运行路由改为 SQLite 持久化、相关单测通过、README/ADR/摘要同步更新。
- 文档中若仍出现旧的 “V1 未完成 / 下一步是 V3 / runtime 仍是纯内存” 表述，应以本页和最新提交为准。
